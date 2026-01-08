/**
 * Build Story Bible tree from memories.
 * Groups by category: Canon (decision), Style, Preferences.
 */

import type { TreeNode, ManifestSection, ManifestMemory, MemoryCategory } from "../types";
import { sortMemories } from "../utils/sorting";
import { memoryMatchesSearch } from "../utils/search";

export interface StoryBibleTreeInput {
  memories: ManifestMemory[];
  searchQuery?: string;
  memoryCategories?: MemoryCategory[];
}

export interface StoryBibleTreeResult {
  section: ManifestSection | null;
  memoryCount: number;
}

/**
 * Get display label for memory category.
 */
function getCategoryLabel(category: MemoryCategory): string {
  switch (category) {
    case "decision":
      return "Canon";
    case "style":
      return "Style";
    case "preference":
      return "Preferences";
    case "session":
      return "Session";
    default:
      return category;
  }
}

/**
 * Get first line of content as label, truncated.
 */
function getMemoryLabel(memory: ManifestMemory): string {
  const text = memory.content.trim();
  if (!text) return "Untitled memory";
  const firstLine = text.split("\n")[0] ?? text;
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

/**
 * Build a tree node for a memory.
 */
function buildMemoryNode(memory: ManifestMemory): TreeNode {
  return {
    id: memory.id,
    name: getMemoryLabel(memory),
    type: "memory",
    memoryCategory: memory.category,
    memory,
  };
}

/**
 * Build the Story Bible section with categorized memories.
 */
export function buildStoryBibleTree(input: StoryBibleTreeInput): StoryBibleTreeResult {
  const { memories, searchQuery, memoryCategories } = input;

  // Filter memories by search and category
  let filtered = memories;
  if (searchQuery) {
    filtered = filtered.filter((m) => memoryMatchesSearch(m, searchQuery));
  }
  if (memoryCategories && memoryCategories.length > 0) {
    filtered = filtered.filter((m) => memoryCategories.includes(m.category));
  }

  // Exclude session memories from Story Bible (they're ephemeral)
  filtered = filtered.filter((m) => m.category !== "session");

  if (filtered.length === 0) {
    return {
      section: null,
      memoryCount: 0,
    };
  }

  // Group by category
  const byCategory = new Map<MemoryCategory, ManifestMemory[]>();
  for (const memory of filtered) {
    const existing = byCategory.get(memory.category) || [];
    existing.push(memory);
    byCategory.set(memory.category, existing);
  }

  // Build folder nodes for each category
  const children: TreeNode[] = [];

  // Order: Canon, Style, Preferences
  const categoryOrder: MemoryCategory[] = ["decision", "style", "preference"];

  for (const category of categoryOrder) {
    const categoryMemories = byCategory.get(category);
    if (!categoryMemories || categoryMemories.length === 0) continue;

    const sortedMemories = sortMemories(categoryMemories);

    children.push({
      id: `story-bible-${category}`,
      name: getCategoryLabel(category),
      type: "folder",
      children: sortedMemories.map(buildMemoryNode),
    });
  }

  return {
    section: {
      id: "story-bible",
      title: "Story Bible",
      type: "story-bible",
      children,
      collapsible: true,
      defaultExpanded: true,
      count: filtered.length,
    },
    memoryCount: filtered.length,
  };
}
