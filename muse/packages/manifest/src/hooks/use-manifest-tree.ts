/**
 * Hook for building the manifest tree from data.
 */

import { useMemo } from "react";
import type { Entity } from "@mythos/core";
import type { Document } from "@mythos/core/schema";
import type { ManifestData, ManifestMemory, ManifestFilters } from "../types";
import { buildManifestTree } from "../builders/build-manifest";

export interface UseManifestTreeOptions {
  /** All documents in the project */
  documents: Document[];
  /** All entities in the project */
  entities: Entity[];
  /** All memories (Story Bible) in the project */
  memories: ManifestMemory[];
  /** Search query for filtering */
  searchQuery?: string;
  /** Filters to apply */
  filters?: ManifestFilters;
}

/**
 * Hook to build and memoize the manifest tree.
 *
 * @param options - Input data and options
 * @returns Computed manifest data with sections
 */
export function useManifestTree(options: UseManifestTreeOptions): ManifestData {
  const { documents, entities, memories, searchQuery, filters } = options;

  return useMemo(() => {
    return buildManifestTree({
      documents,
      entities,
      memories,
      searchQuery: searchQuery || "",
      filters,
    });
  }, [documents, entities, memories, searchQuery, filters]);
}
