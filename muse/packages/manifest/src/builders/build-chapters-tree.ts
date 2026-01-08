/**
 * Build chapter/scene tree structure.
 * Chapters contain nested scenes based on parentId relationship.
 */

import type { Document } from "@mythos/core/schema";
import type { TreeNode, ManifestSection } from "../types";
import { sortByOrderIndex } from "../utils/sorting";
import { documentMatchesSearch } from "../utils/search";

export interface ChaptersTreeInput {
  documents: Document[];
  searchQuery?: string;
}

export interface ChaptersTreeResult {
  section: ManifestSection | null;
  chapterCount: number;
  sceneCount: number;
  totalWordCount: number;
}

/**
 * Build a tree node for a chapter with nested scenes.
 */
function buildChapterNode(
  chapter: Document,
  scenes: Document[]
): TreeNode {
  const chapterScenes = scenes.filter((s) => s.parentId === chapter.id);
  const sortedScenes = sortByOrderIndex(chapterScenes);

  const chapterWordCount = chapter.wordCount || 0;
  const scenesWordCount = sortedScenes.reduce((sum, s) => sum + (s.wordCount || 0), 0);

  return {
    id: chapter.id,
    name: chapter.title || `Chapter ${chapter.orderIndex + 1}`,
    type: "chapter",
    documentType: "chapter",
    document: chapter,
    wordCount: chapterWordCount + scenesWordCount,
    children: sortedScenes.length > 0
      ? sortedScenes.map((scene) => ({
          id: scene.id,
          name: scene.title || `Scene ${scene.orderIndex + 1}`,
          type: "scene" as const,
          documentType: "scene" as const,
          document: scene,
          wordCount: scene.wordCount || 0,
          parentId: chapter.id,
        }))
      : undefined,
  };
}

/**
 * Build the chapters section with nested scenes.
 */
export function buildChaptersTree(input: ChaptersTreeInput): ChaptersTreeResult {
  const { documents, searchQuery } = input;

  // Filter documents by search
  const filteredDocs = searchQuery
    ? documents.filter((d) => documentMatchesSearch(d, searchQuery))
    : documents;

  // Separate chapters and scenes
  const chapters = filteredDocs.filter((d) => d.type === "chapter");
  const scenes = filteredDocs.filter((d) => d.type === "scene");

  // Get orphan scenes (no parent or parent not in chapters list)
  const chapterIds = new Set(chapters.map((c) => c.id));
  const orphanScenes = scenes.filter(
    (s) => !s.parentId || !chapterIds.has(s.parentId)
  );

  // If no chapters and no orphan scenes, return null
  if (chapters.length === 0 && orphanScenes.length === 0) {
    return {
      section: null,
      chapterCount: 0,
      sceneCount: 0,
      totalWordCount: 0,
    };
  }

  // Build chapter nodes with nested scenes
  const sortedChapters = sortByOrderIndex(chapters);
  const chapterNodes = sortedChapters.map((chapter) =>
    buildChapterNode(chapter, scenes)
  );

  // Add orphan scenes at root level
  const sortedOrphanScenes = sortByOrderIndex(orphanScenes);
  const orphanSceneNodes: TreeNode[] = sortedOrphanScenes.map((scene) => ({
    id: scene.id,
    name: scene.title || `Scene ${scene.orderIndex + 1}`,
    type: "scene",
    documentType: "scene",
    document: scene,
    wordCount: scene.wordCount || 0,
  }));

  const allChildren = [...chapterNodes, ...orphanSceneNodes];

  // Calculate totals
  const totalWordCount = allChildren.reduce(
    (sum, node) => sum + (node.wordCount || 0),
    0
  );
  const sceneCount = scenes.length;

  return {
    section: {
      id: "chapters",
      title: "Chapters",
      type: "chapters",
      children: allChildren,
      collapsible: true,
      defaultExpanded: true,
      count: chapters.length,
    },
    chapterCount: chapters.length,
    sceneCount,
    totalWordCount,
  };
}
