/**
 * SyncEngine
 *
 * DEPRECATED: This sync engine was designed for Supabase.
 * Convex handles real-time sync automatically via ConvexOfflineProvider.
 *
 * This file is kept for reference during migration but should not be used.
 * Use @mythos/convex-client for offline-first sync with Convex.
 */

import { v4 as uuidv4 } from "uuid";
import { useOfflineStore } from "@mythos/state";
import type {
  LocalDbAdapter,
  Mutation,
  QueuedAiRequest,
  SyncResult,
} from "./types";

/**
 * SyncEngine configuration
 */
export interface SyncEngineConfig {
  local: LocalDbAdapter;
  projectId: string;
  isOnline: boolean;
  syncIntervalMs?: number;
  batchSize?: number;
  maxRetries?: number;
}

/**
 * SyncEngine - Simplified for Convex migration
 *
 * Real-time sync is handled by Convex automatically.
 * This class now only manages local mutations and AI request queue
 * for offline scenarios before they're pushed to Convex.
 */
export class SyncEngine {
  private local: LocalDbAdapter;
  private projectId: string;

  constructor(config: SyncEngineConfig) {
    this.local = config.local;
    this.projectId = config.projectId;
    useOfflineStore.getState().setOnline(config.isOnline);
  }

  async start(): Promise<void> {
    await this.local.initialize();
    await this.updatePendingCounts();
  }

  async stop(): Promise<void> {
    // No-op - Convex handles connection management
  }

  setOnline(isOnline: boolean): void {
    useOfflineStore.getState().setOnline(isOnline);
  }

  async syncNow(): Promise<SyncResult> {
    // Convex handles real-time sync
    // This just updates pending counts
    await this.updatePendingCounts();

    return {
      pushed: 0,
      pulled: 0,
      conflicts: [],
      errors: [],
      syncedAt: new Date().toISOString(),
    };
  }

  async mutate(mutation: Omit<Mutation, "id" | "createdAt" | "projectId">): Promise<void> {
    const fullMutation: Mutation = {
      ...mutation,
      id: uuidv4(),
      projectId: this.projectId,
      createdAt: new Date().toISOString(),
    };

    await this.local.enqueueMutation(fullMutation);
    await this.updatePendingCounts();
  }

  async queueAi(request: Omit<QueuedAiRequest, "id" | "createdAt">): Promise<void> {
    const fullRequest: QueuedAiRequest = {
      ...request,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    await this.local.enqueueAiRequest(fullRequest);
    await this.updatePendingCounts();
  }

  private async updatePendingCounts(): Promise<void> {
    const [mutationCount, aiCount] = await Promise.all([
      this.local.getPendingMutationsCount(),
      this.local.getPendingAiRequestsCount(),
    ]);

    useOfflineStore.getState().updatePendingCounts(mutationCount, aiCount);
  }
}

export default SyncEngine;
