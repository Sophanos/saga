import { persistAnalysisRecord, type PersistAnalysisInput } from "./contentAnalysisRepository";

/**
 * Status of a queued persistence operation
 */
export type PersistenceOperationStatus = "pending" | "in_progress" | "completed" | "failed";

/**
 * A queued persistence operation
 */
export interface QueuedOperation {
  id: string;
  input: PersistAnalysisInput;
  status: PersistenceOperationStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  lastAttemptAt: Date | null;
}

/**
 * Snapshot of the queue state
 */
export interface PersistenceQueueState {
  pendingCount: number;
  failedCount: number;
  inProgressCount: number;
  errors: string[];
  operations: QueuedOperation[];
}

/**
 * Options for the persistence queue
 */
interface PersistenceQueueOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onStateChange?: (state: PersistenceQueueState) => void;
}

/**
 * Default configuration
 */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 30000;

/**
 * Generate a unique operation ID
 */
function generateOperationId(): string {
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  const delay = baseDelay * Math.pow(2, attempt - 1);
  // Add jitter (0-25% of delay)
  const jitter = delay * Math.random() * 0.25;
  return Math.min(delay + jitter, maxDelay);
}

/**
 * PersistenceQueue manages analysis persistence operations with retry logic
 * and state tracking to prevent data loss from fire-and-forget operations.
 */
class PersistenceQueue {
  private operations: Map<string, QueuedOperation> = new Map();
  private processingQueue: string[] = [];
  private isProcessing = false;
  private maxRetries: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private stateChangeCallback: ((state: PersistenceQueueState) => void) | null = null;
  private retryTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(options: PersistenceQueueOptions = {}) {
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.stateChangeCallback = options.onStateChange ?? null;
  }

  /**
   * Set the state change callback
   */
  setOnStateChange(callback: ((state: PersistenceQueueState) => void) | null): void {
    this.stateChangeCallback = callback;
  }

  /**
   * Get the current queue state
   */
  getState(): PersistenceQueueState {
    const operations = Array.from(this.operations.values());
    const pendingCount = operations.filter((op) => op.status === "pending").length;
    const failedCount = operations.filter((op) => op.status === "failed").length;
    const inProgressCount = operations.filter((op) => op.status === "in_progress").length;
    const errors = operations
      .filter((op) => op.status === "failed" && op.lastError)
      .map((op) => op.lastError as string);

    return {
      pendingCount,
      failedCount,
      inProgressCount,
      errors,
      operations,
    };
  }

  /**
   * Notify listeners of state change
   */
  private notifyStateChange(): void {
    if (this.stateChangeCallback) {
      this.stateChangeCallback(this.getState());
    }
  }

  /**
   * Enqueue a persistence operation
   */
  enqueue(input: PersistAnalysisInput): string {
    const id = generateOperationId();
    const operation: QueuedOperation = {
      id,
      input,
      status: "pending",
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      lastAttemptAt: null,
    };

    this.operations.set(id, operation);
    this.processingQueue.push(id);
    this.notifyStateChange();
    this.processQueue();

    return id;
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const operationId = this.processingQueue.shift();
      if (!operationId) continue;

      const operation = this.operations.get(operationId);
      if (!operation || operation.status === "completed" || operation.status === "failed") {
        continue;
      }

      await this.processOperation(operation);
    }

    this.isProcessing = false;
  }

  /**
   * Process a single operation with retry logic
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    operation.status = "in_progress";
    operation.attempts += 1;
    operation.lastAttemptAt = new Date();
    this.notifyStateChange();

    try {
      await persistAnalysisRecord(operation.input);
      operation.status = "completed";
      operation.lastError = null;
      this.notifyStateChange();

      // Clean up completed operations after a delay
      setTimeout(() => {
        this.operations.delete(operation.id);
        this.notifyStateChange();
      }, 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      operation.lastError = errorMessage;

      if (operation.attempts < this.maxRetries) {
        // Schedule retry with exponential backoff
        operation.status = "pending";
        const delay = calculateBackoff(operation.attempts, this.baseDelayMs, this.maxDelayMs);
        console.warn(
          `[PersistenceQueue] Operation ${operation.id} failed (attempt ${operation.attempts}/${this.maxRetries}), ` +
            `retrying in ${Math.round(delay)}ms:`,
          errorMessage
        );

        const timeoutId = setTimeout(() => {
          this.retryTimeouts.delete(operation.id);
          this.processingQueue.push(operation.id);
          this.processQueue();
        }, delay);

        this.retryTimeouts.set(operation.id, timeoutId);
      } else {
        // Mark as failed after max retries
        operation.status = "failed";
        console.error(
          `[PersistenceQueue] Operation ${operation.id} failed permanently after ${operation.attempts} attempts:`,
          errorMessage
        );
      }

      this.notifyStateChange();
    }
  }

  /**
   * Force-flush all pending operations immediately
   * Returns a promise that resolves when all current operations are processed
   */
  async flush(): Promise<{ succeeded: number; failed: number }> {
    // Cancel all pending retry timeouts
    for (const [opId, timeoutId] of this.retryTimeouts) {
      clearTimeout(timeoutId);
      this.retryTimeouts.delete(opId);

      const operation = this.operations.get(opId);
      if (operation && operation.status === "pending") {
        this.processingQueue.push(opId);
      }
    }

    // Process all pending and failed operations
    const operationsToRetry: string[] = [];
    for (const [id, operation] of this.operations) {
      if (operation.status === "pending" || operation.status === "failed") {
        // Reset failed operations for retry
        if (operation.status === "failed") {
          operation.status = "pending";
          operation.attempts = Math.max(0, operation.attempts - 1); // Give one more attempt
        }
        if (!this.processingQueue.includes(id)) {
          operationsToRetry.push(id);
        }
      }
    }

    this.processingQueue.push(...operationsToRetry);
    this.notifyStateChange();

    // Wait for queue to finish processing
    await this.waitForProcessing();

    // Count results
    let succeeded = 0;
    let failed = 0;
    for (const operation of this.operations.values()) {
      if (operation.status === "completed") succeeded++;
      if (operation.status === "failed") failed++;
    }

    return { succeeded, failed };
  }

  /**
   * Wait for all current processing to complete
   */
  private waitForProcessing(): Promise<void> {
    return new Promise((resolve) => {
      const checkProcessing = () => {
        if (!this.isProcessing && this.processingQueue.length === 0) {
          resolve();
        } else {
          setTimeout(checkProcessing, 100);
        }
      };
      checkProcessing();
    });
  }

  /**
   * Retry all failed operations
   */
  async retryFailed(): Promise<{ succeeded: number; stillFailed: number }> {
    const failedIds: string[] = [];

    for (const [id, operation] of this.operations) {
      if (operation.status === "failed") {
        operation.status = "pending";
        operation.attempts = Math.max(0, operation.attempts - 1); // Give more attempts
        failedIds.push(id);
      }
    }

    this.processingQueue.push(...failedIds);
    this.notifyStateChange();

    await this.waitForProcessing();

    // Count results
    let succeeded = 0;
    let stillFailed = 0;
    for (const id of failedIds) {
      const operation = this.operations.get(id);
      if (operation?.status === "completed") succeeded++;
      if (operation?.status === "failed") stillFailed++;
    }

    return { succeeded, stillFailed };
  }

  /**
   * Clear all failed operations (acknowledge data loss)
   */
  clearFailed(): number {
    let cleared = 0;
    for (const [id, operation] of this.operations) {
      if (operation.status === "failed") {
        this.operations.delete(id);
        cleared++;
      }
    }
    this.notifyStateChange();
    return cleared;
  }

  /**
   * Check if there are any pending or in-progress operations
   */
  hasPendingOperations(): boolean {
    for (const operation of this.operations.values()) {
      if (operation.status === "pending" || operation.status === "in_progress") {
        return true;
      }
    }
    return false;
  }

  /**
   * Dispose of the queue, clearing all timeouts
   */
  dispose(): void {
    for (const timeoutId of this.retryTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.retryTimeouts.clear();
    this.operations.clear();
    this.processingQueue = [];
    this.isProcessing = false;
  }
}

/**
 * Singleton instance of the persistence queue
 */
let queueInstance: PersistenceQueue | null = null;

/**
 * Get the singleton persistence queue instance
 */
export function getAnalysisPersistenceQueue(): PersistenceQueue {
  if (!queueInstance) {
    queueInstance = new PersistenceQueue();
  }
  return queueInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetAnalysisPersistenceQueue(): void {
  if (queueInstance) {
    queueInstance.dispose();
    queueInstance = null;
  }
}
