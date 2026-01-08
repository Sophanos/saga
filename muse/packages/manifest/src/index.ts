/**
 * @mythos/manifest
 *
 * Cross-platform manifest tree logic for the side panel.
 * Supports chapters/scenes, entities, and Story Bible (memories).
 */

// Types
export type {
  TreeNodeType,
  TreeNode,
  ManifestSectionType,
  ManifestSection,
  ManifestData,
  ManifestFilters,
  ManifestInput,
  ManifestMemory,
  MemoryCategory,
  TreeExpansionState,
  TreeSelectionState,
} from "./types";

// Builders
export { buildManifestTree } from "./builders";

// Hooks
export {
  useManifestTree,
  useTreeExpansion,
  useTreeSelection,
  useManifestSearch,
  type UseManifestTreeOptions,
  type ManifestSearchState,
} from "./hooks";

// Utils
export {
  matchesSearch,
  entityMatchesSearch,
  documentMatchesSearch,
  memoryMatchesSearch,
  sortByOrderIndex,
  sortMemories,
} from "./utils";
