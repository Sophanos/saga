/**
 * Convex query hook with TanStack Query caching for offline support
 */

import { useQuery as useTanstackQuery } from "@tanstack/react-query";
import { useQuery as useConvexQuery } from "convex/react";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";
import { getCachedQuery, setCachedQuery } from "../offline/cache";

export interface UseConvexQueryWithCacheOptions {
  /**
   * How long the data is considered fresh (ms)
   * @default 5 * 60 * 1000 (5 minutes)
   */
  staleTime?: number;

  /**
   * How long to keep data in cache (ms)
   * @default 24 * 60 * 60 * 1000 (24 hours)
   */
  gcTime?: number;

  /**
   * Whether to enable the query
   * @default true
   */
  enabled?: boolean;

  /**
   * Whether to refetch on window focus
   * @default true
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Custom query key for caching
   * If not provided, a hash of the function and args will be used
   */
  queryKey?: string;
}

/**
 * Use a Convex query with TanStack Query caching for offline support.
 *
 * This hook combines Convex's real-time subscriptions with TanStack Query's
 * caching layer to provide offline-first behavior.
 *
 * When online: Uses Convex's reactive subscription for real-time updates
 * When offline: Falls back to cached data from IndexedDB
 *
 * @example
 * ```tsx
 * const documents = useConvexQueryWithCache(
 *   api.documents.list,
 *   { projectId },
 *   { staleTime: 5 * 60 * 1000, queryKey: "documents-list" }
 * );
 * ```
 */
export function useConvexQueryWithCache<
  Query extends FunctionReference<"query", "public", any, any>
>(
  query: Query,
  args: FunctionArgs<Query>,
  options: UseConvexQueryWithCacheOptions = {}
): {
  data: FunctionReturnType<Query> | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  isStale: boolean;
  refetch: () => void;
} {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 24 * 60 * 60 * 1000, // 24 hours
    enabled = true,
    refetchOnWindowFocus = true,
    queryKey: customQueryKey,
  } = options;

  // Generate a stable query key from args
  const argsHash = JSON.stringify(args);
  const queryHash = customQueryKey ?? `convex:${argsHash}`;
  const tanstackQueryKey = ["convex", queryHash];

  // Use Convex's native query for real-time subscription when online
  // Cast to any to work around complex type inference
  const convexData = useConvexQuery(
    query,
    enabled ? (args as any) : "skip"
  ) as FunctionReturnType<Query> | undefined;

  // Use TanStack Query for caching layer
  const tanstackQuery = useTanstackQuery({
    queryKey: tanstackQueryKey,
    queryFn: async () => {
      // If we have data from Convex subscription, use it
      if (convexData !== undefined) {
        // Persist to IndexedDB for offline access
        await setCachedQuery(queryHash, convexData, gcTime);
        return convexData;
      }

      // Otherwise, try to get from cache (offline mode)
      const cached = await getCachedQuery<FunctionReturnType<Query>>(queryHash);
      if (cached !== undefined) {
        return cached;
      }

      // No data available
      throw new Error("No data available (offline)");
    },
    staleTime,
    gcTime,
    enabled,
    refetchOnWindowFocus,
    networkMode: "offlineFirst",
  });

  return {
    // Prefer Convex data (real-time) over cached data
    data: convexData !== undefined ? convexData : tanstackQuery.data,
    isLoading: convexData === undefined && tanstackQuery.isLoading,
    isError: convexData === undefined && tanstackQuery.isError,
    error: tanstackQuery.error,
    isFetching: tanstackQuery.isFetching,
    isStale: tanstackQuery.isStale,
    refetch: tanstackQuery.refetch,
  };
}
