/**
 * useMemory Hook
 *
 * Provides access to the Writer Memory Layer with caching.
 * Wraps the memory client and cache store for easy use.
 */

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  createMemoryClient,
  type MemoryClient,
  type MemoryRecord,
  type MemoryCategory,
  type MemoryWriteRequest,
  type MemoryReadRequest,
  MemoryApiError,
} from "@mythos/memory";
import { getSupabaseClient } from "@mythos/db";
import { useMemoryStore } from "../stores/memory";
import { useMythosStore } from "../stores";
import { useApiKey } from "./useApiKey";

// =============================================================================
// Constants
// =============================================================================

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

// =============================================================================
// Types
// =============================================================================

export interface UseMemoryOptions {
  /** Auto-fetch memories on mount */
  autoFetch?: boolean;
  /** Categories to fetch */
  categories?: MemoryCategory[];
}

export interface UseMemoryResult {
  /** All cached memories for the current project */
  memories: MemoryRecord[];
  /** Memories by category */
  byCategory: (category: MemoryCategory) => MemoryRecord[];
  /** Write a new memory */
  write: (params: Omit<MemoryWriteRequest, "projectId">) => Promise<MemoryRecord | null>;
  /** Read memories (refreshes cache) */
  read: (params?: Omit<MemoryReadRequest, "projectId">) => Promise<MemoryRecord[]>;
  /** Delete memories */
  remove: (memoryIds: string[]) => Promise<number>;
  /** Learn style from content */
  learnStyle: (documentId: string, content: string) => Promise<Array<{ id: string; content: string }>>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Clear error */
  clearError: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useMemory(options?: UseMemoryOptions): UseMemoryResult {
  const { autoFetch = false, categories } = options ?? {};

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store access
  const currentProject = useMythosStore((s) => s.project.currentProject);
  const projectId = currentProject?.id;
  const { key: apiKey } = useApiKey();

  // Cache store
  const upsertLocal = useMemoryStore((s) => s.upsertLocal);
  const setCategoryCache = useMemoryStore((s) => s.setCategoryCache);
  const getByCategory = useMemoryStore((s) => s.getByCategory);
  const getRecent = useMemoryStore((s) => s.getRecent);

  // Create client with auth headers
  const client = useMemo<MemoryClient | null>(() => {
    if (!SUPABASE_URL) return null;

    return createMemoryClient({
      supabaseUrl: SUPABASE_URL,
      getAuthHeaders: async () => {
        const headers: Record<string, string> = {};

        // Add API key if available
        if (apiKey) {
          headers["x-openrouter-key"] = apiKey;
        }

        // Add auth token
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        return headers;
      },
    });
  }, [apiKey]);

  // Get cached memories for current project
  const memories = useMemo(() => {
    if (!projectId) return [];
    return getRecent(projectId);
  }, [projectId, getRecent]);

  // Get memories by category
  const byCategory = useCallback(
    (category: MemoryCategory): MemoryRecord[] => {
      if (!projectId) return [];
      return getByCategory(projectId, category);
    },
    [projectId, getByCategory]
  );

  // Write a memory
  const write = useCallback(
    async (params: Omit<MemoryWriteRequest, "projectId">): Promise<MemoryRecord | null> => {
      if (!client || !projectId) {
        setError("Memory system not available");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const memory = await client.write({ ...params, projectId });
        upsertLocal(projectId, memory);
        return memory;
      } catch (err) {
        const message = err instanceof MemoryApiError
          ? err.message
          : "Failed to write memory";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [client, projectId, upsertLocal]
  );

  // Read memories
  const read = useCallback(
    async (params?: Omit<MemoryReadRequest, "projectId">): Promise<MemoryRecord[]> => {
      if (!client || !projectId) {
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        const memories = await client.read({ ...params, projectId });

        // Update cache by category
        if (params?.categories?.length === 1) {
          setCategoryCache(projectId, params.categories[0], memories);
        } else {
          // Group and cache by category
          const grouped = new Map<MemoryCategory, MemoryRecord[]>();
          for (const mem of memories) {
            const list = grouped.get(mem.category) ?? [];
            list.push(mem);
            grouped.set(mem.category, list);
          }
          for (const [cat, mems] of grouped) {
            setCategoryCache(projectId, cat, mems);
          }
        }

        return memories;
      } catch (err) {
        const message = err instanceof MemoryApiError
          ? err.message
          : "Failed to read memories";
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [client, projectId, setCategoryCache]
  );

  // Delete memories
  const remove = useCallback(
    async (memoryIds: string[]): Promise<number> => {
      if (!client || !projectId || memoryIds.length === 0) {
        return 0;
      }

      setIsLoading(true);
      setError(null);

      try {
        const count = await client.delete({ projectId, memoryIds });
        return count;
      } catch (err) {
        const message = err instanceof MemoryApiError
          ? err.message
          : "Failed to delete memories";
        setError(message);
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [client, projectId]
  );

  // Learn style
  const learnStyle = useCallback(
    async (documentId: string, content: string): Promise<Array<{ id: string; content: string }>> => {
      if (!client || !projectId) {
        setError("Memory system not available");
        return [];
      }

      setIsLoading(true);
      setError(null);

      try {
        const learned = await client.learnStyle({ projectId, documentId, content });

        // Cache the learned style memories
        for (const item of learned) {
          upsertLocal(projectId, {
            id: item.id,
            projectId,
            category: "style",
            scope: "user",
            content: item.content,
            createdAt: new Date().toISOString(),
          });
        }

        return learned;
      } catch (err) {
        const message = err instanceof MemoryApiError
          ? err.message
          : "Failed to learn style";
        setError(message);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [client, projectId, upsertLocal]
  );

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-fetch on mount if enabled
  useEffect(() => {
    if (autoFetch && projectId && client) {
      read({ categories });
    }
  }, [autoFetch, projectId, client, categories, read]);

  return {
    memories,
    byCategory,
    write,
    read,
    remove,
    learnStyle,
    isLoading,
    error,
    clearError,
  };
}
