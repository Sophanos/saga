/**
 * Build notes, outlines, and worldbuilding sections.
 */

import type { Document } from "@mythos/core/schema";
import type { TreeNode, ManifestSection } from "../types";
import { sortByOrderIndex } from "../utils/sorting";
import { documentMatchesSearch } from "../utils/search";

export interface NotesTreeInput {
  documents: Document[];
  searchQuery?: string;
}

export interface NotesTreeResult {
  sections: ManifestSection[];
}

/**
 * Build a tree node for a document (note, outline, worldbuilding).
 */
function buildDocumentNode(doc: Document): TreeNode {
  return {
    id: doc.id,
    name: doc.title || "Untitled",
    type: doc.type as TreeNode["type"],
    documentType: doc.type,
    document: doc,
    wordCount: doc.wordCount || 0,
  };
}

/**
 * Build sections for notes, outlines, and worldbuilding.
 */
export function buildNotesTree(input: NotesTreeInput): NotesTreeResult {
  const { documents, searchQuery } = input;

  // Filter documents by search
  const filtered = searchQuery
    ? documents.filter((d) => documentMatchesSearch(d, searchQuery))
    : documents;

  // Group by type
  const notes = filtered.filter((d) => d.type === "note");
  const outlines = filtered.filter((d) => d.type === "outline");
  const worldbuilding = filtered.filter((d) => d.type === "worldbuilding");

  const sections: ManifestSection[] = [];

  // Notes section
  if (notes.length > 0) {
    const sortedNotes = sortByOrderIndex(notes);
    sections.push({
      id: "notes",
      title: "Notes",
      type: "notes",
      children: sortedNotes.map(buildDocumentNode),
      collapsible: true,
      defaultExpanded: false,
      count: notes.length,
    });
  }

  // Outlines section
  if (outlines.length > 0) {
    const sortedOutlines = sortByOrderIndex(outlines);
    sections.push({
      id: "outlines",
      title: "Outlines",
      type: "outlines",
      children: sortedOutlines.map(buildDocumentNode),
      collapsible: true,
      defaultExpanded: false,
      count: outlines.length,
    });
  }

  // Worldbuilding section
  if (worldbuilding.length > 0) {
    const sortedWorldbuilding = sortByOrderIndex(worldbuilding);
    sections.push({
      id: "worldbuilding",
      title: "Worldbuilding",
      type: "worldbuilding",
      children: sortedWorldbuilding.map(buildDocumentNode),
      collapsible: true,
      defaultExpanded: false,
      count: worldbuilding.length,
    });
  }

  return { sections };
}
