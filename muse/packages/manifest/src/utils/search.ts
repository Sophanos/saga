/**
 * Search and filter utilities for manifest tree.
 */

import type { Entity } from "@mythos/core";
import type { Document } from "@mythos/core/schema";
import type { ManifestMemory } from "../types";

/**
 * Check if a string matches a search query (case-insensitive).
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Check if an entity matches the search query.
 * Searches name and all aliases.
 */
export function entityMatchesSearch(entity: Entity, query: string): boolean {
  if (!query) return true;
  if (matchesSearch(entity.name, query)) return true;
  return entity.aliases.some((alias) => matchesSearch(alias, query));
}

/**
 * Check if a document matches the search query.
 * Searches title only.
 */
export function documentMatchesSearch(doc: Document, query: string): boolean {
  if (!query) return true;
  return matchesSearch(doc.title || "", query);
}

/**
 * Check if a memory matches the search query.
 * Searches content.
 */
export function memoryMatchesSearch(memory: ManifestMemory, query: string): boolean {
  if (!query) return true;
  return matchesSearch(memory.content, query);
}
