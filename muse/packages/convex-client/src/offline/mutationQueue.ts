/**
 * Offline Mutation Queue
 *
 * Queues mutations when offline and replays them on reconnect.
 * Uses last-write-wins conflict resolution.
 */

import { get, set, createStore } from "idb-keyval";
import type { ConvexReactClient } from "convex/react";
import type { FunctionReference } from "convex/server";

// Dedicated store for mutation queue
const queueStore = createStore("convex-cache", "mutations");

const QUEUE_KEY = "offline_mutation_queue";

/**
 * Represents a mutation queued while offline
 */
export interface OfflineMutation {
  /**
   * Unique identifier for this mutation
   */
  id: string;

  /**
   * Convex function name (e.g., "documents:create")
   */
  functionName: string;

  /**
   * Arguments to pass to the mutation
   */
  args: Record<string, unknown>;

  /**
   * Project ID for scoping
   */
  projectId: string;

  /**
   * When this mutation was created
   */
  createdAt: number;

  /**
   * Number of retry attempts
   */
  retryCount: number;

  /**
   * Last error message if failed
   */
  lastError?: string;

  /**
   * Status of this mutation
   */
  status: "pending" | "processing" | "failed";
}

/**
 * Manages offline mutations with automatic retry on reconnect
 */
export class OfflineMutationQueue {
  private isOnline: boolean;
  private isProcessing: boolean = false;
  private convex: ConvexReactClient | null = null;
  private maxRetries: number;
  private retryBaseDelay: number;
  private onStatusChange?: (count: number, isProcessing: boolean) => void;

  // Bound event handlers for proper cleanup
  private boundHandleOnline: () => void;
  private boundHandleOffline: () => void;

  constructor(options: {
    maxRetries?: number;
    retryBaseDelay?: number;
    onStatusChange?: (count: number, isProcessing: boolean) => void;
  } = {}) {
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryBaseDelay = options.retryBaseDelay ?? 1000;
    this.onStatusChange = options.onStatusChange;

    // Bind handlers once for proper addEventListener/removeEventListener pairing
    this.boundHandleOnline = this.handleOnline.bind(this);
    this.boundHandleOffline = this.handleOffline.bind(this);

    // Listen for online/offline events
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.boundHandleOnline);
      window.addEventListener("offline", this.boundHandleOffline);
    }
  }

  /**
   * Set the Convex client (called when provider mounts)
   */
  setClient(client: ConvexReactClient): void {
    this.convex = client;
  }

  /**
   * Add a mutation to the queue
   */
  async enqueue(
    functionName: string,
    args: Record<string, unknown>,
    projectId: string
  ): Promise<string> {
    const mutation: OfflineMutation = {
      id: crypto.randomUUID(),
      functionName,
      args,
      projectId,
      createdAt: Date.now(),
      retryCount: 0,
      status: "pending",
    };

    const queue = await this.getQueue();
    queue.push(mutation);
    await this.saveQueue(queue);

    this.notifyStatusChange();

    return mutation.id;
  }

  /**
   * Get all pending mutations
   */
  async getQueue(): Promise<OfflineMutation[]> {
    try {
      const queue = await get<OfflineMutation[]>(QUEUE_KEY, queueStore);
      return queue ?? [];
    } catch (error) {
      console.warn("[convex-client] Failed to get mutation queue:", error);
      return [];
    }
  }

  /**
   * Get count of pending mutations
   */
  async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.filter((m) => m.status === "pending").length;
  }

  /**
   * Process all pending mutations (called on reconnect)
   *
   * Uses last-write-wins: If a mutation fails with a conflict,
   * we discard it since server state is more recent.
   */
  async processQueue(): Promise<void> {
    if (!this.convex || this.isProcessing || !this.isOnline) {
      return;
    }

    this.isProcessing = true;
    this.notifyStatusChange();

    const queue = await this.getQueue();
    const pendingMutations = queue.filter((m) => m.status === "pending");

    for (const mutation of pendingMutations) {
      try {
        // Mark as processing
        mutation.status = "processing";
        await this.saveQueue(queue);

        // Execute the mutation
        // Note: We cast to any because we're dynamically calling functions
        await (this.convex as any).mutation(
          mutation.functionName as any,
          mutation.args
        );

        // Remove successful mutation from queue
        const updatedQueue = queue.filter((m) => m.id !== mutation.id);
        await this.saveQueue(updatedQueue);

        console.log(
          `[convex-client] Processed offline mutation: ${mutation.functionName}`
        );
      } catch (error) {
        mutation.retryCount++;
        mutation.lastError =
          error instanceof Error ? error.message : String(error);

        // Last-write-wins: If it's a conflict error, discard the mutation
        const isConflict =
          error instanceof Error &&
          (error.message.includes("conflict") ||
            error.message.includes("version") ||
            error.message.includes("stale"));

        if (isConflict || mutation.retryCount >= this.maxRetries) {
          // Remove failed mutation
          mutation.status = "failed";
          console.warn(
            `[convex-client] Discarding mutation ${mutation.id} (${isConflict ? "conflict" : "max retries"})`,
            mutation.lastError
          );

          const updatedQueue = queue.filter((m) => m.id !== mutation.id);
          await this.saveQueue(updatedQueue);
        } else {
          // Keep for retry
          mutation.status = "pending";
          await this.saveQueue(queue);

          // Exponential backoff
          const delay = this.retryBaseDelay * Math.pow(2, mutation.retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    this.isProcessing = false;
    this.notifyStatusChange();
  }

  /**
   * Clear all mutations from the queue
   */
  async clearQueue(): Promise<void> {
    await this.saveQueue([]);
    this.notifyStatusChange();
  }

  /**
   * Remove a specific mutation by ID
   */
  async removeMutation(id: string): Promise<void> {
    const queue = await this.getQueue();
    const updatedQueue = queue.filter((m) => m.id !== id);
    await this.saveQueue(updatedQueue);
    this.notifyStatusChange();
  }

  private async saveQueue(queue: OfflineMutation[]): Promise<void> {
    try {
      await set(QUEUE_KEY, queue, queueStore);
    } catch (error) {
      console.warn("[convex-client] Failed to save mutation queue:", error);
    }
  }

  private handleOnline(): void {
    this.isOnline = true;
    console.log("[convex-client] Back online, processing queue...");
    this.processQueue();
  }

  private handleOffline(): void {
    this.isOnline = false;
    console.log("[convex-client] Offline, mutations will be queued");
  }

  private async notifyStatusChange(): Promise<void> {
    if (this.onStatusChange) {
      const count = await this.getPendingCount();
      this.onStatusChange(count, this.isProcessing);
    }
  }

  /**
   * Cleanup event listeners
   */
  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.boundHandleOnline);
      window.removeEventListener("offline", this.boundHandleOffline);
    }
  }
}

// Singleton instance
let queueInstance: OfflineMutationQueue | null = null;

/**
 * Get the singleton mutation queue instance
 */
export function getMutationQueue(
  options?: ConstructorParameters<typeof OfflineMutationQueue>[0]
): OfflineMutationQueue {
  if (!queueInstance) {
    queueInstance = new OfflineMutationQueue(options);
  }
  return queueInstance;
}
