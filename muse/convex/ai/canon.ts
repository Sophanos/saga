/**
 * Canon / Policy Memory Helpers
 *
 * Fetches pinned project memories (canon decisions, style policies) from Qdrant
 * so AI tools can cite them via [M:<memoryId>] tags.
 */

import { isQdrantConfigured, scrollPoints, type QdrantFilter } from "../lib/qdrant";

export type DecisionCategory = "decision" | "policy";

export interface PinnedMemory {
  memoryId: string;
  category: DecisionCategory;
  text: string;
  createdAt?: string;
  createdAtTs?: number;
}

export interface FetchPinnedMemoriesOptions {
  limit?: number;
  categories?: DecisionCategory[];
}

export async function fetchPinnedProjectMemories(
  projectId: string,
  options?: FetchPinnedMemoriesOptions
): Promise<PinnedMemory[]> {
  if (!isQdrantConfigured()) return [];

  const limit = options?.limit ?? 25;
  const categories = options?.categories ?? ["decision"];

  const filter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: projectId } },
      { key: "type", match: { value: "memory" } },
      { key: "scope", match: { value: "project" } },
      { key: "pinned", match: { value: true } },
      { key: "category", match: { any: categories } },
    ],
  };

  const points = await scrollPoints(filter, limit, {
    orderBy: { key: "created_at_ts", direction: "desc" },
  }, { collection: "saga_vectors" });

  const memories: PinnedMemory[] = [];

  for (const point of points) {
    const payload = point.payload;
    const memoryId = String(payload["memory_id"] ?? point.id);
    const category = payload["category"];
    const text = payload["text"];

    if (typeof category !== "string" || (category !== "decision" && category !== "policy")) {
      continue;
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      continue;
    }

    memories.push({
      memoryId,
      category,
      text,
      createdAt: typeof payload["created_at"] === "string" ? payload["created_at"] : undefined,
      createdAtTs: typeof payload["created_at_ts"] === "number" ? payload["created_at_ts"] : undefined,
    });
  }

  return memories;
}

export function formatMemoriesForPrompt(memories: PinnedMemory[]): string {
  return memories.map((m) => `[M:${m.memoryId}] ${m.text}`).join("\n");
}

