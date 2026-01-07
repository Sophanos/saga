import type { ConvexReactClient } from "convex/react";

/**
 * Configuration for offline-first Convex client
 */
export interface ConvexOfflineConfig {
  /**
   * Convex client instance
   */
  client: ConvexReactClient;

  /**
   * Prefix for IndexedDB keys
   * @default "convex"
   */
  cachePrefix?: string;

  /**
   * How long to keep cached data before considering it stale (ms)
   * @default 5 * 60 * 1000 (5 minutes)
   */
  staleTime?: number;

  /**
   * How long to keep cached data in IndexedDB before garbage collection (ms)
   * @default 24 * 60 * 60 * 1000 (24 hours)
   */
  gcTime?: number;

  /**
   * Whether to automatically process queued mutations on reconnect
   * @default true
   */
  autoProcessQueue?: boolean;

  /**
   * Maximum number of retry attempts for failed mutations
   * @default 3
   */
  maxRetries?: number;

  /**
   * Base delay between retries (ms), uses exponential backoff
   * @default 1000
   */
  retryBaseDelay?: number;
}

/**
 * Offline state exposed to components
 */
export interface OfflineState {
  /**
   * Whether the browser is currently online
   */
  isOnline: boolean;

  /**
   * Number of mutations pending in the offline queue
   */
  pendingMutationCount: number;

  /**
   * Whether the offline queue is currently being processed
   */
  isProcessingQueue: boolean;

  /**
   * Last sync timestamp
   */
  lastSyncAt: number | null;

  /**
   * Any sync errors
   */
  syncError: Error | null;
}

/**
 * Query cache entry stored in IndexedDB
 */
export interface CachedQuery {
  queryKey: string;
  data: unknown;
  dataUpdatedAt: number;
  expiresAt: number;
}
