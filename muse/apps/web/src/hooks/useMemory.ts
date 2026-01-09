/**
 * useMemory Hook
 *
 * Provides access to the Writer Memory Layer using Convex.
 * Wraps Convex queries/mutations with caching.
 */

import { useCallback, useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  MemoryRecord,
  MemoryCategory,
  MemoryWriteRequest,
  MemoryReadRequest,
} from "@mythos/memory";
import { useMemoryStore } from "../stores/memory";
import type { MemoryCacheState } from "@mythos/memory";
import { useLayoutStore } from "@mythos/state";

// =============================================================================
// Types
// =============================================================================

export interface UseMemoryOptions {
  autoFetch?: boolean;
  categories?: MemoryCategory[];
}

export interface UseMemoryResult {
  memories: MemoryRecord[];
  byCategory: (category: MemoryCategory) => MemoryRecord[];
  write: (params: Omit<MemoryWriteRequest, "projectId">) => Promise<MemoryRecord | null>;
  read: (params?: Omit<MemoryReadRequest, "projectId">) => Promise<MemoryRecord[]>;
  remove: (memoryIds: string[]) => Promise<number>;
  forget: (memoryIds: string[]) => Promise<number>;
  pin: (memoryId: string, pinned: boolean) => Promise<boolean>;
  redact: (memoryId: string, reason?: string) => Promise<boolean>;
  learnStyle: (documentId: string, content: string) => Promise<Array<{ id: string; content: string }>>;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function mapCategoryToType(category: MemoryCategory): string {
  const map: Record<MemoryCategory, string> = {
    decision: "decision",
    style: "style",
    preference: "preference",
    session: "session",
  };
  return map[category] ?? "decision";
}

function mapTypeToCategory(type: string): MemoryCategory {
  const map: Record<string, MemoryCategory> = {
    decision: "decision",
    fact: "decision",
    style: "style",
    preference: "preference",
    session: "session",
    context: "session",
  };
  return map[type] ?? "decision";
}

interface ConvexMemory {
  _id: Id<"memories">;
  projectId: Id<"projects">;
  userId?: string;
  text: string;
  type: string;
  confidence: number;
  source: string;
  entityIds?: string[];
  documentId?: Id<"documents">;
  pinned: boolean;
  expiresAt?: number;
  vectorId?: string;
  createdAt: number;
  updatedAt: number;
}

function toMemoryRecord(mem: ConvexMemory): MemoryRecord {
  return {
    id: mem._id,
    projectId: mem.projectId,
    category: mapTypeToCategory(mem.type),
    scope: mem.type === "session" ? "conversation" : "project",
    ownerId: mem.userId,
    content: mem.text,
    metadata: {
      source: mem.source as "user" | "ai" | "system",
      confidence: mem.confidence,
      entityIds: mem.entityIds,
      documentId: mem.documentId,
      pinned: mem.pinned,
      expiresAt: mem.expiresAt ? new Date(mem.expiresAt).toISOString() : undefined,
    },
    createdAt: new Date(mem.createdAt).toISOString(),
    updatedAt: new Date(mem.updatedAt).toISOString(),
  };
}

// =============================================================================
// Hook
// =============================================================================

export function useMemory(options?: UseMemoryOptions): UseMemoryResult {
  const { autoFetch = false, categories } = options ?? {};

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentProjectId = useLayoutStore((s) => s.currentProjectId);
  const projectId = currentProjectId as Id<"projects"> | null;

  // Cache store
  const upsertLocal = useMemoryStore((s: MemoryCacheState) => s.upsertLocal);
  const removeLocal = useMemoryStore((s: MemoryCacheState) => s.removeLocal);
  const setCategoryCache = useMemoryStore((s: MemoryCacheState) => s.setCategoryCache);
  const getByCategory = useMemoryStore((s: MemoryCacheState) => s.getByCategory);
  const getRecent = useMemoryStore((s: MemoryCacheState) => s.getRecent);

  // Convex queries and mutations
  const convexMemories = useQuery(
    api.memories.list,
    projectId ? { projectId, limit: 100 } : "skip"
  );

  const createMemory = useMutation(api.memories.create);
  const updateMemory = useMutation(api.memories.update);
  const removeMemory = useMutation(api.memories.remove);

  // Convert Convex memories to MemoryRecord format
  const memories = useMemo(() => {
    if (!convexMemories || !projectId) return [];
    return convexMemories.map(toMemoryRecord);
  }, [convexMemories, projectId]);

  // Update cache when Convex data changes
  useEffect(() => {
    if (memories.length > 0 && projectId) {
      const grouped = new Map<MemoryCategory, MemoryRecord[]>();
      for (const mem of memories) {
        if (mem.category === "session") continue;
        const list = grouped.get(mem.category) ?? [];
        list.push(mem);
        grouped.set(mem.category, list);
      }
      for (const [cat, mems] of grouped) {
        setCategoryCache(projectId, cat, mems);
      }
    }
  }, [memories, projectId, setCategoryCache]);

  const byCategory = useCallback(
    (category: MemoryCategory): MemoryRecord[] => {
      if (!projectId) return [];
      if (category === "session") return [];
      return getByCategory(projectId, category);
    },
    [projectId, getByCategory]
  );

  const write = useCallback(
    async (params: Omit<MemoryWriteRequest, "projectId">): Promise<MemoryRecord | null> => {
      if (!projectId) {
        setError("No project selected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const id = await createMemory({
          projectId,
          text: params.content,
          type: mapCategoryToType(params.category),
          confidence: params.metadata?.confidence,
          source: params.metadata?.source,
          entityIds: params.metadata?.entityIds,
          pinned: params.metadata?.pinned,
          expiresAt: params.metadata?.expiresAt
            ? new Date(params.metadata.expiresAt).getTime()
            : undefined,
        });

        const memory: MemoryRecord = {
          id,
          projectId,
          category: params.category,
          scope: params.scope ?? "project",
          content: params.content,
          metadata: params.metadata,
          createdAt: new Date().toISOString(),
        };

        upsertLocal(projectId, memory);
        return memory;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to write memory";
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, createMemory, upsertLocal]
  );

  const read = useCallback(
    async (_params?: Omit<MemoryReadRequest, "projectId">): Promise<MemoryRecord[]> => {
      // Convex queries are reactive, so we just return current memories
      return memories;
    },
    [memories]
  );

  const remove = useCallback(
    async (memoryIds: string[]): Promise<number> => {
      if (!projectId || memoryIds.length === 0) return 0;

      setIsLoading(true);
      setError(null);

      try {
        let count = 0;
        for (const id of memoryIds) {
          await removeMemory({ id: id as Id<"memories"> });
          count++;
        }
        removeLocal(projectId, memoryIds);
        return count;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete memories";
        setError(message);
        return 0;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, removeMemory, removeLocal]
  );

  const forget = useCallback(
    async (memoryIds: string[]): Promise<number> => {
      return remove(memoryIds);
    },
    [remove]
  );

  const pin = useCallback(
    async (memoryId: string, pinned: boolean): Promise<boolean> => {
      if (!projectId) return false;

      try {
        await updateMemory({
          id: memoryId as Id<"memories">,
          pinned,
        });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to pin memory";
        setError(message);
        return false;
      }
    },
    [projectId, updateMemory]
  );

  const redact = useCallback(
    async (memoryId: string, _reason?: string): Promise<boolean> => {
      if (!projectId) return false;

      try {
        // For redaction, we delete the memory
        await removeMemory({ id: memoryId as Id<"memories"> });
        removeLocal(projectId, [memoryId]);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to redact memory";
        setError(message);
        return false;
      }
    },
    [projectId, removeMemory, removeLocal]
  );

  const learnStyle = useCallback(
    async (_documentId: string, _content: string): Promise<Array<{ id: string; content: string }>> => {
      // Style learning is handled server-side via Convex actions
      // This is a no-op on the client - the AI will learn style during interactions
      return [];
    },
    []
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
