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
  type MemoryCacheState,
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
  /** Forget memories (alias for remove) */
  forget: (memoryIds: string[]) => Promise<number>;
  /** Pin or unpin a memory */
  pin: (memoryId: string, pinned: boolean) => Promise<boolean>;
  /** Redact a memory */
  redact: (memoryId: string, reason?: string) => Promise<boolean>;
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
  const upsertLocal = useMemoryStore((s: MemoryCacheState) => s.upsertLocal);
  const removeLocal = useMemoryStore((s: MemoryCacheState) => s.removeLocal);
  const setCategoryCache = useMemoryStore((s: MemoryCacheState) => s.setCategoryCache);
  const getByCategory = useMemoryStore((s: MemoryCacheState) => s.getByCategory);
  const getRecent = useMemoryStore((s: MemoryCacheState) => s.getRecent);

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
  // Note: Session memories are conversation-scoped and require getSession(projectId, conversationId)
  const byCategory = useCallback(
    (category: MemoryCategory): MemoryRecord[] => {
      if (!projectId) return [];
      // Session memories are handled separately via store.getSession()
      if (category === "session") return [];
      return getByCategory(projectId, category);
    },
    [projectId, getByCategory]
  );

  const buildUpdatePayload = useCallback((memory: MemoryRecord) => {
    const metadata = memory.metadata ?? {};
    const {
      conversationId,
      source,
      confidence,
      entityIds,
      documentId,
      toolCallId,
      toolName,
      expiresAt,
      pinned,
      redacted,
      redactedAt,
      redactionReason,
    } = metadata;

    return {
      id: memory.id,
      category: memory.category,
      content: memory.content,
      scope: memory.scope,
      conversationId,
      metadata: {
        source,
        confidence,
        entityIds,
        documentId,
        toolCallId,
        toolName,
        expiresAt,
        pinned,
        redacted,
        redactedAt,
        redactionReason,
      },
    } satisfies Omit<MemoryWriteRequest, "projectId">;
  }, []);

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
      } catch (err: unknown) {
        const message = err instanceof MemoryApiError
          ? err.message
          : err instanceof Error
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

        // Update cache by category (session memories excluded - they're conversation-scoped)
        if (params?.["categories"]?.length === 1) {
          const cat = params["categories"][0];
          if (cat !== "session") {
            setCategoryCache(projectId, cat, memories);
          }
        } else {
          // Group and cache by category
          const grouped = new Map<MemoryCategory, MemoryRecord[]>();
          for (const mem of memories) {
            const list = grouped.get(mem.category) ?? [];
            list.push(mem);
            grouped.set(mem.category, list);
          }
          for (const [cat, mems] of grouped) {
            // Skip session - it's conversation-scoped and handled separately
            if (cat !== "session") {
              setCategoryCache(projectId, cat, mems);
            }
          }
        }

        return memories;
      } catch (err: unknown) {
        const message = err instanceof MemoryApiError
          ? err.message
          : err instanceof Error
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
        // Remove from local cache after successful delete
        if (count > 0) {
          removeLocal(projectId, memoryIds);
        }
        return count;
      } catch (err: unknown) {
        const message = err instanceof MemoryApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete memories";
        setError(message);
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [client, projectId, removeLocal]
  );

  const forget = useCallback(
    async (memoryIds: string[]): Promise<number> => {
      return remove(memoryIds);
    },
    [remove]
  );

  const pin = useCallback(
    async (memoryId: string, pinned: boolean): Promise<boolean> => {
      if (!projectId) {
        return false;
      }

      const memory = memories.find((item) => item.id === memoryId);
      if (!memory) {
        setError("Memory not found in cache");
        return false;
      }

      const payload = buildUpdatePayload(memory);
      const result = await write({
        ...payload,
        metadata: {
          ...payload.metadata,
          pinned,
        },
      });

      return Boolean(result);
    },
    [memories, projectId, buildUpdatePayload, write]
  );

  const redact = useCallback(
    async (memoryId: string, reason?: string): Promise<boolean> => {
      if (!projectId) {
        return false;
      }

      const memory = memories.find((item) => item.id === memoryId);
      if (!memory) {
        setError("Memory not found in cache");
        return false;
      }

      const payload = buildUpdatePayload(memory);
      const result = await write({
        ...payload,
        metadata: {
          ...payload.metadata,
          redacted: true,
          redactionReason: reason,
        },
      });

      return Boolean(result);
    },
    [memories, projectId, buildUpdatePayload, write]
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

        // Get userId for ownerId field
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        // Cache the learned style memories
        const now = new Date().toISOString();
        for (const item of learned) {
          upsertLocal(projectId, {
            id: item.id,
            projectId,
            ownerId: userId,
            category: "style",
            scope: "user",
            content: item.content,
            metadata: {
              source: "ai",
              documentId,
            },
            createdAt: now,
            updatedAt: now,
          });
        }

        return learned;
      } catch (err: unknown) {
        const message = err instanceof MemoryApiError
          ? err.message
          : err instanceof Error
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
    forget,
    pin,
    redact,
    learnStyle,
    isLoading,
    error,
    clearError,
  };
}
