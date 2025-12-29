/**
 * SyncEngine
 * Handles offline-first sync between local database and Supabase
 */

import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { useOfflineStore } from "@mythos/state";
import type {
  LocalDbAdapter,
  Mutation,
  QueuedAiRequest,
  SyncEvent,
  SyncResult,
  ProjectSnapshot,
} from "./types";

/**
 * SyncEngine configuration
 */
export interface SyncEngineConfig {
  supabase: SupabaseClient;
  local: LocalDbAdapter;
  projectId: string;
  isOnline: boolean;
  /**
   * Interval in ms for background sync (default: 30000)
   */
  syncIntervalMs?: number;
  /**
   * Max mutations to push per sync batch (default: 50)
   */
  batchSize?: number;
  /**
   * Max retries for failed mutations (default: 3)
   */
  maxRetries?: number;
}

/**
 * SyncEngine handles bidirectional sync between local storage and Supabase
 */
export class SyncEngine {
  private supabase: SupabaseClient;
  private local: LocalDbAdapter;
  private projectId: string;
  private isOnline: boolean;
  private syncIntervalMs: number;
  private batchSize: number;

  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private isSyncing = false;

  constructor(config: SyncEngineConfig) {
    this.supabase = config.supabase;
    this.local = config.local;
    this.projectId = config.projectId;
    this.isOnline = config.isOnline;
    this.syncIntervalMs = config.syncIntervalMs ?? 30000;
    this.batchSize = config.batchSize ?? 50;
    // Note: maxRetries is available via config.maxRetries for future retry logic
  }

  /**
   * Start the sync engine
   */
  async start(): Promise<void> {
    // Initialize local database
    await this.local.initialize();

    // Check if we need to bootstrap
    const lastVersion = await this.local.getLastSyncVersion(this.projectId);
    if (lastVersion === 0 && this.isOnline) {
      await this.bootstrapFromServer();
    }

    // Subscribe to realtime changes
    if (this.isOnline) {
      this.subscribeToRealtime();
    }

    // Start background sync interval
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncNow().catch(console.error);
      }
    }, this.syncIntervalMs);

    // Initial sync
    if (this.isOnline) {
      await this.syncNow();
    }

    // Update pending counts
    await this.updatePendingCounts();
  }

  /**
   * Stop the sync engine
   */
  async stop(): Promise<void> {
    // Clear sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Unsubscribe from realtime
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * Set online status
   */
  setOnline(isOnline: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = isOnline;

    if (isOnline && wasOffline) {
      // Coming back online - sync immediately
      this.subscribeToRealtime();
      this.syncNow().catch(console.error);
    } else if (!isOnline) {
      // Going offline - unsubscribe from realtime
      if (this.realtimeChannel) {
        this.supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    }
  }

  /**
   * Perform a sync now
   */
  async syncNow(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { pushed: 0, pulled: 0, conflicts: [], errors: [], syncedAt: new Date().toISOString() };
    }

    if (!this.isOnline) {
      return { pushed: 0, pulled: 0, conflicts: [], errors: [{ message: "Offline", retryable: true }], syncedAt: new Date().toISOString() };
    }

    this.isSyncing = true;
    useOfflineStore.getState().setSyncing(true);

    const result: SyncResult = {
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [],
      syncedAt: new Date().toISOString(),
    };

    try {
      // Push local mutations to server
      const pushResult = await this.pushMutations();
      result.pushed = pushResult.pushed;
      result.errors.push(...pushResult.errors);

      // Pull changes from server
      const pullResult = await this.pullChanges();
      result.pulled = pullResult.pulled;
      result.errors.push(...pullResult.errors);

      // Process queued AI requests
      await this.processAiRequests();

      // Update last sync time
      useOfflineStore.getState().setLastSyncAt(result.syncedAt);

      // Update pending counts
      await this.updatePendingCounts();

      if (result.errors.length > 0) {
        useOfflineStore.getState().setSyncError(result.errors[0].message);
      } else {
        useOfflineStore.getState().setSyncError(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      result.errors.push({ message, retryable: true });
      useOfflineStore.getState().setSyncError(message);
    } finally {
      this.isSyncing = false;
      useOfflineStore.getState().setSyncing(false);
    }

    return result;
  }

  /**
   * Enqueue a mutation for sync
   */
  async mutate(mutation: Omit<Mutation, "id" | "createdAt" | "projectId">): Promise<void> {
    const fullMutation: Mutation = {
      ...mutation,
      id: uuidv4(),
      projectId: this.projectId,
      createdAt: new Date().toISOString(),
    };

    // Apply locally first
    await this.applyMutationLocally(fullMutation);

    // Enqueue for sync
    await this.local.enqueueMutation(fullMutation);

    // Update pending counts
    await this.updatePendingCounts();

    // If online, trigger sync
    if (this.isOnline) {
      // Debounced sync - don't await
      setTimeout(() => this.syncNow().catch(console.error), 100);
    }
  }

  /**
   * Queue an AI request for processing
   */
  async queueAi(request: Omit<QueuedAiRequest, "id" | "createdAt">): Promise<void> {
    const fullRequest: QueuedAiRequest = {
      ...request,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    await this.local.enqueueAiRequest(fullRequest);
    await this.updatePendingCounts();

    // If online, process immediately
    if (this.isOnline) {
      setTimeout(() => this.processAiRequests().catch(console.error), 100);
    }
  }

  /**
   * Bootstrap project data from server
   */
  private async bootstrapFromServer(): Promise<void> {
    try {
      // Fetch all project data
      const [documents, entities, relationships, captures] = await Promise.all([
        this.supabase
          .from("documents")
          .select("*")
          .eq("project_id", this.projectId),
        this.supabase
          .from("entities")
          .select("*")
          .eq("project_id", this.projectId),
        this.supabase
          .from("relationships")
          .select("*")
          .eq("project_id", this.projectId),
        this.supabase
          .from("captures")
          .select("*")
          .eq("project_id", this.projectId),
      ]);

      if (documents.error) throw documents.error;
      if (entities.error) throw entities.error;
      if (relationships.error) throw relationships.error;
      if (captures.error) throw captures.error;

      const snapshot: ProjectSnapshot = {
        projectId: this.projectId,
        version: 1,
        documents: (documents.data || []).map(transformDbRow),
        entities: (entities.data || []).map(transformDbRow),
        relationships: (relationships.data || []).map(transformDbRow),
        mentions: [],
        captures: (captures.data || []).map(transformDbRow),
        syncedAt: new Date().toISOString(),
      };

      await this.local.bootstrapProject(this.projectId, snapshot);
    } catch (error) {
      console.error("[SyncEngine] Bootstrap failed:", error);
      throw error;
    }
  }

  /**
   * Subscribe to realtime changes
   */
  private subscribeToRealtime(): void {
    if (this.realtimeChannel) {
      return;
    }

    this.realtimeChannel = this.supabase
      .channel(`project:${this.projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => this.handleRealtimeChange("documents", payload)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entities",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => this.handleRealtimeChange("entities", payload)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationships",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => this.handleRealtimeChange("relationships", payload)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "captures",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => this.handleRealtimeChange("captures", payload)
      )
      .subscribe();
  }

  /**
   * Handle realtime change from Supabase
   */
  private async handleRealtimeChange(
    table: string,
    payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }
  ): Promise<void> {
    const event: SyncEvent = {
      id: uuidv4(),
      table: table as SyncEvent["table"],
      type: payload.eventType === "DELETE" ? "delete" : "upsert",
      row: payload.eventType === "DELETE" ? payload.old : transformDbRow(payload.new),
      version: Date.now(),
      userId: "",
      timestamp: new Date().toISOString(),
    };

    await this.local.applyActivity([event]);
  }

  /**
   * Push local mutations to server
   */
  private async pushMutations(): Promise<{ pushed: number; errors: SyncResult["errors"] }> {
    const mutations = await this.local.peekMutations(this.batchSize);
    let pushed = 0;
    const errors: SyncResult["errors"] = [];

    for (const mutation of mutations) {
      try {
        await this.pushMutation(mutation);
        await this.local.markMutationDone(mutation.id);
        pushed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Push failed";
        await this.local.markMutationFailed(mutation.id, message);
        errors.push({ mutationId: mutation.id, table: mutation.table, message, retryable: true });
      }
    }

    return { pushed, errors };
  }

  /**
   * Push a single mutation to the server
   */
  private async pushMutation(mutation: Mutation): Promise<void> {
    const tableMap: Record<string, string> = {
      documents: "documents",
      entities: "entities",
      relationships: "relationships",
      mentions: "mentions",
      captures: "captures",
    };

    const tableName = tableMap[mutation.table];
    if (!tableName) {
      throw new Error(`Unknown table: ${mutation.table}`);
    }

    if (mutation.type === "delete" && mutation.pk) {
      const { error } = await this.supabase.from(tableName).delete().eq("id", mutation.pk);
      if (error) throw error;
    } else if (mutation.row) {
      const dbRow = transformToDbRow(mutation.row);
      const { error } = await this.supabase.from(tableName).upsert(dbRow as never);
      if (error) throw error;
    }
  }

  /**
   * Pull changes from server since last sync
   */
  private async pullChanges(): Promise<{ pulled: number; errors: SyncResult["errors"] }> {
    // For simplicity, we rely on realtime for incremental updates
    // This could be enhanced with a proper versioning system
    return { pulled: 0, errors: [] };
  }

  /**
   * Process queued AI requests
   */
  private async processAiRequests(): Promise<void> {
    const requests = await this.local.peekAiRequests(5);

    for (const request of requests) {
      try {
        await this.processAiRequest(request);
        await this.local.markAiRequestDone(request.id);
      } catch (error) {
        console.error("[SyncEngine] AI request failed:", error);
        // Keep in queue for retry
      }
    }

    await this.updatePendingCounts();
  }

  /**
   * Process a single AI request
   */
  private async processAiRequest(request: QueuedAiRequest): Promise<void> {
    const functionMap: Record<string, string> = {
      lint: "ai-lint",
      coach: "ai-coach",
      detect: "ai-detect",
      dynamics: "ai-dynamics",
    };

    const functionName = functionMap[request.type];
    if (!functionName) {
      throw new Error(`Unknown AI request type: ${request.type}`);
    }

    const { error } = await this.supabase.functions.invoke(functionName, {
      body: request.payload,
    });

    if (error) throw error;
  }

  /**
   * Apply a mutation to local storage
   */
  private async applyMutationLocally(mutation: Mutation): Promise<void> {
    if (mutation.type === "delete" && mutation.pk) {
      switch (mutation.table) {
        case "documents":
          await this.local.deleteDocument(mutation.pk);
          break;
        case "entities":
          await this.local.deleteEntity(mutation.pk);
          break;
        case "relationships":
          await this.local.deleteRelationship(mutation.pk);
          break;
        case "captures":
          await this.local.deleteCapture(mutation.pk);
          break;
      }
    } else if (mutation.row) {
      switch (mutation.table) {
        case "documents":
          await this.local.upsertDocument(mutation.row);
          break;
        case "entities":
          await this.local.upsertEntity(mutation.row);
          break;
        case "relationships":
          await this.local.upsertRelationship(mutation.row);
          break;
        case "captures":
          await this.local.upsertCapture(mutation.row);
          break;
      }
    }
  }

  /**
   * Update pending counts in the offline store
   */
  private async updatePendingCounts(): Promise<void> {
    const [mutationCount, aiCount] = await Promise.all([
      this.local.getPendingMutationsCount(),
      this.local.getPendingAiRequestsCount(),
    ]);

    useOfflineStore.getState().updatePendingCounts(mutationCount, aiCount);
  }
}

/**
 * Transform database row (snake_case) to camelCase
 */
function transformDbRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }

  return result;
}

/**
 * Transform camelCase to database row (snake_case)
 */
function transformToDbRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }

  return result;
}

export default SyncEngine;
