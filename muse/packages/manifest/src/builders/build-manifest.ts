/**
 * Main manifest tree builder.
 * Orchestrates all section builders to create complete manifest data.
 */

import type { ManifestInput, ManifestData, ManifestSection } from "../types";
import { buildChaptersTree } from "./build-chapters-tree";
import { buildEntitiesTree } from "./build-entities-tree";
import { buildStoryBibleTree } from "./build-story-bible-tree";
import { buildNotesTree } from "./build-notes-tree";

/**
 * Build the complete manifest tree from input data.
 *
 * Section order:
 * 1. Story Bible (Canon, Style, Preferences)
 * 2. Chapters (with nested scenes)
 * 3. Characters
 * 4. Locations
 * 5. Items
 * 6. Magic Systems
 * 7. Factions
 * 8. Notes
 * 9. Outlines
 * 10. Worldbuilding
 */
export function buildManifestTree(input: ManifestInput): ManifestData {
  const { documents, entities, memories, searchQuery, filters } = input;

  const sections: ManifestSection[] = [];

  // 1. Story Bible
  const storyBibleResult = buildStoryBibleTree({
    memories,
    searchQuery,
    memoryCategories: filters?.memoryCategories,
  });
  if (storyBibleResult.section) {
    sections.push(storyBibleResult.section);
  }

  // 2. Chapters (with nested scenes)
  const chaptersResult = buildChaptersTree({
    documents,
    searchQuery,
  });
  if (chaptersResult.section) {
    sections.push(chaptersResult.section);
  }

  // 3-7. Entity sections (Characters, Locations, Items, Magic Systems, Factions)
  const entitiesResult = buildEntitiesTree({
    entities,
    searchQuery,
    entityTypes: filters?.entityTypes,
  });
  sections.push(...entitiesResult.sections);

  // 8-10. Notes, Outlines, Worldbuilding
  const notesResult = buildNotesTree({
    documents,
    searchQuery,
  });
  sections.push(...notesResult.sections);

  return {
    sections,
    totalWordCount: chaptersResult.totalWordCount,
    entityCount: entitiesResult.entityCount,
    chapterCount: chaptersResult.chapterCount,
    sceneCount: chaptersResult.sceneCount,
  };
}
