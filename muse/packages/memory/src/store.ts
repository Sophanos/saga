/**
 * @mythos/memory - Memory Cache Store (MLP 2.x)
 *
 * Platform-agnostic hot/warm cache for memories.
 * Uses zustand with a storage adapter pattern.
 *
 * MLP 2.x improvements:
 * - Conversation-scoped session cache (isolated by conversationId)
 * - Proper separation of session memories from other categories
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StorageAdapter } from "@mythos/storage";
import type { MemoryRecord, MemoryCategory } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface ProjectMemoryCache {
  /** Most recently used memories (excluding session) */
  recent: MemoryRecord[];
  /** Memories organized by category (excluding session) */
  byCategory: Partial<Record<Exclude<MemoryCategory, "session">, MemoryRecord[]>>;
  /** Session memories by conversation ID */
  sessionByConversation: Record<string, MemoryRecord[]>;
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

  /** Set entire category cache (non-session categories only) */
  setCategoryCache: (
    projectId: string,
    category: Exclude<MemoryCategory, "session">,
    memories: MemoryRecord[]
  ) => void;

  /** Set session cache for a specific conversation */
  setSessionCache: (
    projectId: string,
    conversationId: string,
    memories: MemoryRecord[]
  ) => void;

  /** Get session memories for a conversation */
  getSession: (projectId: string, conversationId: string) => MemoryRecord[];

  /** Clear all caches for a project */
  invalidateProject: (projectId: string) => void;

  /** Clear session cache for a specific conversation */
  invalidateSession: (projectId: string, conversationId: string) => void;

  /** Clear all caches */
  clearAll: () => void;

  /** Get memories for a project by category (non-session) */
  getByCategory: (
    projectId: string,
    category: Exclude<MemoryCategory, "session">
  ) => MemoryRecord[];

  /** Get recent memories for a project (non-session) */
  getRecent: (projectId: string) => MemoryRecord[];

  /** Prune expired caches (call periodically or on memory pressure) */
  pruneExpired: () => void;

  /** Last prune timestamp (internal) */
  lastPruneTime: number;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_RECENT_MEMORIES = 20;
const MAX_CATEGORY_MEMORIES = 50;
const MAX_SESSION_MEMORIES = 20;
const MAX_CONVERSATIONS_PER_PROJECT = 10;
const MAX_PROJECTS_IN_CACHE = 20;
const CACHE_TTL_DAYS = 7;
const AUTO_PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Helpers
// =============================================================================

function createEmptyProjectCache(): ProjectMemoryCache {
  return {
    recent: [],
    byCategory: {},
    sessionByConversation: {},
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

/**
 * Prune old conversations to limit memory usage.
 * Keeps only the most recently updated conversations.
 */
function pruneOldConversations(
  sessionByConversation: Record<string, MemoryRecord[]>
): Record<string, MemoryRecord[]> {
  const entries = Object.entries(sessionByConversation);
  if (entries.length <= MAX_CONVERSATIONS_PER_PROJECT) {
    return sessionByConversation;
  }

  // Sort by most recent memory in each conversation
  const sorted = entries.sort((a, b) => {
    const aLatest = a[1][0]?.createdAt ?? "";
    const bLatest = b[1][0]?.createdAt ?? "";
    return bLatest.localeCompare(aLatest);
  });

  // Keep only the most recent conversations
  return Object.fromEntries(sorted.slice(0, MAX_CONVERSATIONS_PER_PROJECT));
}

/**
 * Prune old projects to limit memory usage.
 * Keeps only the most recently updated projects.
 */
function pruneOldProjects(
  byProject: Record<string, ProjectMemoryCache>
): Record<string, ProjectMemoryCache> {
  const entries = Object.entries(byProject);
  if (entries.length <= MAX_PROJECTS_IN_CACHE) {
    return byProject;
  }

  // Sort by most recently updated
  const sorted = entries.sort((a, b) => {
    return b[1].updatedAt.localeCompare(a[1].updatedAt);
  });

  return Object.fromEntries(sorted.slice(0, MAX_PROJECTS_IN_CACHE));
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
        lastPruneTime: 0,

        upsertLocal: (projectId, memory) => {
          // Check if we should auto-prune (every 5 minutes)
          const now = Date.now();
          const lastPrune = get().lastPruneTime;
          if (now - lastPrune > AUTO_PRUNE_INTERVAL_MS) {
            set((state) => ({
              byProject: pruneOldProjects(pruneExpiredCaches(state.byProject)),
              lastPruneTime: now,
            }));
          }
          set((state) => {
            const projectCache =
              state.byProject[projectId] ?? createEmptyProjectCache();

            // Handle session memories separately
            if (memory.category === "session") {
              const conversationId = memory.metadata?.conversationId;
              if (!conversationId) {
                console.warn(
                  "[memory-store] Session memory missing conversationId, skipping"
                );
                return state;
              }

              const existingSession =
                projectCache.sessionByConversation[conversationId] ?? [];
              const sessionWithoutThis = existingSession.filter(
                (m) => m.id !== memory.id
              );
              const newSession = [memory, ...sessionWithoutThis].slice(
                0,
                MAX_SESSION_MEMORIES
              );

              const updatedByProject = {
                ...state.byProject,
                [projectId]: {
                  ...projectCache,
                  sessionByConversation: pruneOldConversations({
                    ...projectCache.sessionByConversation,
                    [conversationId]: newSession,
                  }),
                  updatedAt: new Date().toISOString(),
                },
              };

              return {
                byProject: pruneOldProjects(updatedByProject),
              };
            }

            // Handle non-session memories
            // Update recent list (exclude session memories)
            const recentWithoutThis = projectCache.recent.filter(
              (m) => m.id !== memory.id
            );
            const newRecent = [memory, ...recentWithoutThis].slice(
              0,
              MAX_RECENT_MEMORIES
            );

            // Update category cache (exclude session)
            const category = memory.category as Exclude<MemoryCategory, "session">;
            const categoryMemories = projectCache.byCategory[category] ?? [];
            const categoryWithoutThis = categoryMemories.filter(
              (m) => m.id !== memory.id
            );
            const newCategoryMemories = [memory, ...categoryWithoutThis].slice(
              0,
              MAX_CATEGORY_MEMORIES
            );

            const updatedByProject = {
              ...state.byProject,
              [projectId]: {
                ...projectCache,
                recent: newRecent,
                byCategory: {
                  ...projectCache.byCategory,
                  [category]: newCategoryMemories,
                },
                updatedAt: new Date().toISOString(),
              },
            };

            return {
              byProject: pruneOldProjects(updatedByProject),
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
            const newByCategory: Partial<
              Record<Exclude<MemoryCategory, "session">, MemoryRecord[]>
            > = {};
            for (const [category, memories] of Object.entries(
              projectCache.byCategory
            )) {
              if (memories) {
                newByCategory[category as Exclude<MemoryCategory, "session">] =
                  memories.filter((m) => !idsToRemove.has(m.id));
              }
            }

            // Filter session caches
            const newSessionByConversation: Record<string, MemoryRecord[]> = {};
            for (const [convId, memories] of Object.entries(
              projectCache.sessionByConversation
            )) {
              const filtered = memories.filter((m) => !idsToRemove.has(m.id));
              if (filtered.length > 0) {
                newSessionByConversation[convId] = filtered;
              }
            }

            return {
              byProject: {
                ...state.byProject,
                [projectId]: {
                  recent: newRecent,
                  byCategory: newByCategory,
                  sessionByConversation: newSessionByConversation,
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

        setSessionCache: (projectId, conversationId, memories) => {
          set((state) => {
            const projectCache =
              state.byProject[projectId] ?? createEmptyProjectCache();

            return {
              byProject: {
                ...state.byProject,
                [projectId]: {
                  ...projectCache,
                  sessionByConversation: pruneOldConversations({
                    ...projectCache.sessionByConversation,
                    [conversationId]: memories.slice(0, MAX_SESSION_MEMORIES),
                  }),
                  updatedAt: new Date().toISOString(),
                },
              },
            };
          });
        },

        getSession: (projectId, conversationId) => {
          const projectCache = get().byProject[projectId];
          if (!projectCache) return [];
          return projectCache.sessionByConversation[conversationId] ?? [];
        },

        invalidateProject: (projectId) => {
          set((state) => {
            const { [projectId]: _, ...rest } = state.byProject;
            return { byProject: rest };
          });
        },

        invalidateSession: (projectId, conversationId) => {
          set((state) => {
            const projectCache = state.byProject[projectId];
            if (!projectCache) return state;

            const { [conversationId]: _, ...restSessions } =
              projectCache.sessionByConversation;

            return {
              byProject: {
                ...state.byProject,
                [projectId]: {
                  ...projectCache,
                  sessionByConversation: restSessions,
                  updatedAt: new Date().toISOString(),
                },
              },
            };
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

        pruneExpired: () => {
          set((state) => ({
            byProject: pruneOldProjects(pruneExpiredCaches(state.byProject)),
            lastPruneTime: Date.now(),
          }));
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
