/**
 * @mythos/memory - Memory Cache Store
 *
 * Platform-agnostic hot/warm cache for memories.
 * Uses zustand with a storage adapter pattern.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StorageAdapter } from "@mythos/storage";
import type { MemoryRecord, MemoryCategory } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface ProjectMemoryCache {
  /** Most recently used memories */
  recent: MemoryRecord[];
  /** Memories organized by category */
  byCategory: Partial<Record<MemoryCategory, MemoryRecord[]>>;
  /** Last cache update timestamp */
  updatedAt: string;
}

export interface MemoryCacheState {
  /** Cache by project ID */
  byProject: Record<string, ProjectMemoryCache>;

  /** Upsert a memory into the local cache */
  upsertLocal: (projectId: string, memory: MemoryRecord) => void;

  /** Remove memories from the local cache */
  removeLocal: (projectId: string, memoryIds: string[]) => void;

  /** Set entire category cache */
  setCategoryCache: (
    projectId: string,
    category: MemoryCategory,
    memories: MemoryRecord[]
  ) => void;

  /** Clear all caches for a project */
  invalidateProject: (projectId: string) => void;

  /** Clear all caches */
  clearAll: () => void;

  /** Get memories for a project by category */
  getByCategory: (
    projectId: string,
    category: MemoryCategory
  ) => MemoryRecord[];

  /** Get recent memories for a project */
  getRecent: (projectId: string) => MemoryRecord[];
}

// =============================================================================
// Constants
// =============================================================================

const MAX_RECENT_MEMORIES = 20;
const MAX_CATEGORY_MEMORIES = 50;
const CACHE_TTL_DAYS = 7;

// =============================================================================
// Helpers
// =============================================================================

function createEmptyProjectCache(): ProjectMemoryCache {
  return {
    recent: [],
    byCategory: {},
    updatedAt: new Date().toISOString(),
  };
}

function isExpired(updatedAt: string): boolean {
  const cacheDate = new Date(updatedAt);
  const now = new Date();
  const diffMs = now.getTime() - cacheDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > CACHE_TTL_DAYS;
}

function pruneExpiredCaches(
  byProject: Record<string, ProjectMemoryCache>
): Record<string, ProjectMemoryCache> {
  const result: Record<string, ProjectMemoryCache> = {};
  for (const [projectId, cache] of Object.entries(byProject)) {
    if (!isExpired(cache.updatedAt)) {
      result[projectId] = cache;
    }
  }
  return result;
}

// =============================================================================
// Store Factory
// =============================================================================

/**
 * Create a memory cache store with the given storage adapter.
 */
export function createMemoryCacheStore(storage: StorageAdapter) {
  return create<MemoryCacheState>()(
    persist(
      (set, get) => ({
        byProject: {},

        upsertLocal: (projectId, memory) => {
          set((state) => {
            const projectCache =
              state.byProject[projectId] ?? createEmptyProjectCache();

            // Update recent list
            const recentWithoutThis = projectCache.recent.filter(
              (m) => m.id !== memory.id
            );
            const newRecent = [memory, ...recentWithoutThis].slice(
              0,
              MAX_RECENT_MEMORIES
            );

            // Update category cache
            const categoryMemories =
              projectCache.byCategory[memory.category] ?? [];
            const categoryWithoutThis = categoryMemories.filter(
              (m) => m.id !== memory.id
            );
            const newCategoryMemories = [memory, ...categoryWithoutThis].slice(
              0,
              MAX_CATEGORY_MEMORIES
            );

            return {
              byProject: {
                ...state.byProject,
                [projectId]: {
                  recent: newRecent,
                  byCategory: {
                    ...projectCache.byCategory,
                    [memory.category]: newCategoryMemories,
                  },
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          });
        },

        removeLocal: (projectId, memoryIds) => {
          set((state) => {
            const projectCache = state.byProject[projectId];
            if (!projectCache) return state;

            const idsToRemove = new Set(memoryIds);

            // Filter recent list
            const newRecent = projectCache.recent.filter(
              (m) => !idsToRemove.has(m.id)
            );

            // Filter all category caches
            const newByCategory: Partial<Record<MemoryCategory, MemoryRecord[]>> = {};
            for (const [category, memories] of Object.entries(projectCache.byCategory)) {
              if (memories) {
                newByCategory[category as MemoryCategory] = memories.filter(
                  (m) => !idsToRemove.has(m.id)
                );
              }
            }

            return {
              byProject: {
                ...state.byProject,
                [projectId]: {
                  recent: newRecent,
                  byCategory: newByCategory,
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          });
        },

        setCategoryCache: (projectId, category, memories) => {
          set((state) => {
            const projectCache =
              state.byProject[projectId] ?? createEmptyProjectCache();

            return {
              byProject: {
                ...state.byProject,
                [projectId]: {
                  ...projectCache,
                  byCategory: {
                    ...projectCache.byCategory,
                    [category]: memories.slice(0, MAX_CATEGORY_MEMORIES),
                  },
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          });
        },

        invalidateProject: (projectId) => {
          set((state) => {
            const { [projectId]: _, ...rest } = state.byProject;
            return { byProject: rest };
          });
        },

        clearAll: () => {
          set({ byProject: {} });
        },

        getByCategory: (projectId, category) => {
          const projectCache = get().byProject[projectId];
          if (!projectCache) return [];
          return projectCache.byCategory[category] ?? [];
        },

        getRecent: (projectId) => {
          const projectCache = get().byProject[projectId];
          if (!projectCache) return [];
          return projectCache.recent;
        },
      }),
      {
        name: "mythos-memory-cache",
        storage: createJSONStorage(() => ({
          getItem: async (key) => storage.getItem(key),
          setItem: async (key, value) => storage.setItem(key, value),
          removeItem: async (key) => storage.removeItem(key),
        })),
        partialize: (state) => ({
          byProject: pruneExpiredCaches(state.byProject),
        }),
      }
    )
  );
}

/**
 * Type for the created store.
 */
export type MemoryCacheStore = ReturnType<typeof createMemoryCacheStore>;
