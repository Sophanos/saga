/**
 * Sorting utilities for manifest tree.
 */

import type { Document } from "@mythos/core/schema";
import type { ManifestMemory } from "../types";

/**
 * Sort documents by orderIndex.
 */
export function sortByOrderIndex<T extends { orderIndex: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}

/**
 * Sort memories by pinned status first, then by createdAt (newest first).
 */
export function sortMemories(memories: ManifestMemory[]): ManifestMemory[] {
  return [...memories].sort((a, b) => {
    const pinnedDelta =
      Number(Boolean(b.metadata?.pinned)) - Number(Boolean(a.metadata?.pinned));
    if (pinnedDelta !== 0) return pinnedDelta;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/**
 * Sort documents with chapters first, then scenes.
 */
export function sortChaptersAndScenes(documents: Document[]): Document[] {
  const chapters = documents.filter((d) => d.type === "chapter");
  const scenes = documents.filter((d) => d.type === "scene");
  const others = documents.filter((d) => d.type !== "chapter" && d.type !== "scene");

  return [
    ...sortByOrderIndex(chapters),
    ...sortByOrderIndex(scenes),
    ...sortByOrderIndex(others),
  ];
}
