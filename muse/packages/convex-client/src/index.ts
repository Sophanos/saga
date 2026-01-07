/**
 * @mythos/convex-client
 *
 * Convex client utilities for Saga with offline-first support.
 *
 * This package provides:
 * - Offline cache layer (TanStack Query + IndexedDB)
 * - Offline mutation queue with automatic retry
 * - Last-write-wins conflict resolution
 * - Convex React hooks with caching
 */

// Core exports
export { ConvexOfflineProvider, useConvexOffline } from "./provider";
export { useConvexQueryWithCache } from "./hooks/useConvexQueryWithCache";
export { useConvexMutationWithQueue } from "./hooks/useConvexMutationWithQueue";

// Offline utilities
export {
  OfflineMutationQueue,
  getMutationQueue,
  type OfflineMutation,
} from "./offline/mutationQueue";
export {
  persistQueryCache,
  restoreQueryCache,
  clearQueryCache,
  getCachedQuery,
  setCachedQuery,
} from "./offline/cache";

// Types
export type { ConvexOfflineConfig, OfflineState, CachedQuery } from "./types";
