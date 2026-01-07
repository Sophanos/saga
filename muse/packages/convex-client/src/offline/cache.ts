/**
 * IndexedDB cache for TanStack Query
 *
 * Provides persistence layer for offline-first support.
 * Uses idb-keyval for simple key-value storage.
 */

import { get, set, del, keys, createStore } from "idb-keyval";
import type { QueryClient, Query } from "@tanstack/react-query";
import type { CachedQuery } from "../types";

// Create a dedicated store for Convex cache
const convexStore = createStore("convex-cache", "queries");

const CACHE_PREFIX = "query:";
const CACHE_VERSION = 1;

/**
 * Generate a cache key from query key
 */
function getCacheKey(queryHash: string): string {
  return `${CACHE_PREFIX}v${CACHE_VERSION}:${queryHash}`;
}

/**
 * Persist all queries from TanStack Query cache to IndexedDB
 *
 * @param queryClient - TanStack Query client
 * @param gcTime - Max age for cached data (ms)
 */
export async function persistQueryCache(
  queryClient: QueryClient,
  gcTime: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<void> {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();
  const now = Date.now();

  const persistPromises = queries.map(async (query: Query) => {
    // Only persist successful queries with data
    if (query.state.status !== "success" || query.state.data === undefined) {
      return;
    }

    const cacheKey = getCacheKey(query.queryHash);
    const entry: CachedQuery = {
      queryKey: query.queryHash,
      data: query.state.data,
      dataUpdatedAt: query.state.dataUpdatedAt,
      expiresAt: now + gcTime,
    };

    try {
      await set(cacheKey, entry, convexStore);
    } catch (error) {
      console.warn(`[convex-client] Failed to persist query ${cacheKey}:`, error);
    }
  });

  await Promise.all(persistPromises);
}

/**
 * Restore cached queries from IndexedDB to TanStack Query cache
 *
 * @param queryClient - TanStack Query client
 */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  const now = Date.now();

  try {
    const allKeys = await keys(convexStore);
    const queryKeys = allKeys.filter(
      (key): key is string =>
        typeof key === "string" && key.startsWith(CACHE_PREFIX)
    );

    const restorePromises = queryKeys.map(async (key) => {
      try {
        const entry = await get<CachedQuery>(key, convexStore);

        if (!entry) return;

        // Skip expired entries
        if (entry.expiresAt < now) {
          await del(key, convexStore);
          return;
        }

        // Restore to TanStack Query cache
        // Note: We use the raw queryHash as the key
        const queryKey = entry.queryKey;
        queryClient.setQueryData([queryKey], entry.data, {
          updatedAt: entry.dataUpdatedAt,
        });
      } catch (error) {
        console.warn(`[convex-client] Failed to restore query ${key}:`, error);
      }
    });

    await Promise.all(restorePromises);
  } catch (error) {
    console.warn("[convex-client] Failed to restore query cache:", error);
  }
}

/**
 * Clear all cached queries from IndexedDB
 */
export async function clearQueryCache(): Promise<void> {
  try {
    const allKeys = await keys(convexStore);
    const queryKeys = allKeys.filter(
      (key): key is string =>
        typeof key === "string" && key.startsWith(CACHE_PREFIX)
    );

    await Promise.all(queryKeys.map((key) => del(key, convexStore)));
  } catch (error) {
    console.warn("[convex-client] Failed to clear query cache:", error);
  }
}

/**
 * Get a single cached query
 */
export async function getCachedQuery<T>(
  queryHash: string
): Promise<T | undefined> {
  const now = Date.now();
  const key = getCacheKey(queryHash);

  try {
    const entry = await get<CachedQuery>(key, convexStore);

    if (!entry) return undefined;

    // Check expiration
    if (entry.expiresAt < now) {
      await del(key, convexStore);
      return undefined;
    }

    return entry.data as T;
  } catch (error) {
    console.warn(`[convex-client] Failed to get cached query ${key}:`, error);
    return undefined;
  }
}

/**
 * Set a single cached query
 */
export async function setCachedQuery<T>(
  queryHash: string,
  data: T,
  gcTime: number = 24 * 60 * 60 * 1000
): Promise<void> {
  const now = Date.now();
  const key = getCacheKey(queryHash);

  const entry: CachedQuery = {
    queryKey: queryHash,
    data,
    dataUpdatedAt: now,
    expiresAt: now + gcTime,
  };

  try {
    await set(key, entry, convexStore);
  } catch (error) {
    console.warn(`[convex-client] Failed to set cached query ${key}:`, error);
  }
}
