/**
 * @mythos/manifest - Types
 *
 * Tree node types for the Manifest side panel.
 * Supports chapters/scenes, entities, and Story Bible (memories).
 */

import type { EntityType, Entity } from "@mythos/core";
import type { Document, DocumentType } from "@mythos/core/schema";

/**
 * Memory category for Story Bible entries.
 * Re-exported here to avoid direct agent-protocol dependency.
 */
export type MemoryCategory = "style" | "decision" | "preference" | "session";

/**
 * Memory record for Story Bible entries.
 * Simplified from @mythos/agent-protocol for manifest use.
 */
export interface ManifestMemory {
  id: string;
  category: MemoryCategory;
  content: string;
  createdAt: string;
  metadata?: {
    pinned?: boolean;
    redacted?: boolean;
  };
}

/**
 * Type discriminator for tree nodes.
 */
export type TreeNodeType =
  | "folder"
  | "chapter"
  | "scene"
  | "entity"
  | "memory"
  | "note"
  | "outline"
  | "worldbuilding";

/**
 * A single node in the manifest tree.
 * Used for all item types: chapters, scenes, entities, memories, etc.
 */
export interface TreeNode {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Node type for rendering and behavior */
  type: TreeNodeType;

  /** Entity type (when type === 'entity') */
  entityType?: EntityType;
  /** Document type (when type is a document-based node) */
  documentType?: DocumentType;
  /** Memory category (when type === 'memory') */
  memoryCategory?: MemoryCategory;

  /** Parent node ID (for scenes under chapters) */
  parentId?: string | null;
  /** Child nodes (for expandable items) */
  children?: TreeNode[];

  /** Word count (for documents) */
  wordCount?: number;
  /** Icon name (from ENTITY_TYPE_CONFIG or custom) */
  icon?: string;
  /** Hex color for display */
  color?: string;

  /** Source entity data reference */
  entity?: Entity;
  /** Source document data reference */
  document?: Document;
  /** Source memory data reference */
  memory?: ManifestMemory;
}

/**
 * Section type for top-level manifest sections.
 */
export type ManifestSectionType =
  | "story-bible"
  | "chapters"
  | "characters"
  | "locations"
  | "items"
  | "magic-systems"
  | "factions"
  | "notes"
  | "outlines"
  | "worldbuilding";

/**
 * A top-level section in the manifest.
 */
export interface ManifestSection {
  /** Unique identifier */
  id: string;
  /** Display title */
  title: string;
  /** Section type for styling and behavior */
  type: ManifestSectionType;
  /** Child nodes in this section */
  children: TreeNode[];
  /** Whether section can be collapsed */
  collapsible?: boolean;
  /** Whether section is expanded by default */
  defaultExpanded?: boolean;
  /** Total item count (for display) */
  count?: number;
}

/**
 * Complete manifest data structure.
 */
export interface ManifestData {
  /** All sections to display */
  sections: ManifestSection[];
  /** Total word count across all documents */
  totalWordCount: number;
  /** Total entity count */
  entityCount: number;
  /** Total chapter count */
  chapterCount: number;
  /** Total scene count */
  sceneCount: number;
}

/**
 * Filters for manifest tree building.
 */
export interface ManifestFilters {
  /** Filter by document types */
  documentTypes?: DocumentType[];
  /** Filter by entity types */
  entityTypes?: EntityType[];
  /** Filter by memory categories */
  memoryCategories?: MemoryCategory[];
}

/**
 * Input data for building the manifest tree.
 */
export interface ManifestInput {
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
 * Tree expansion state.
 */
export interface TreeExpansionState {
  /** Set of expanded node IDs */
  expandedIds: Set<string>;
  /** Check if a node is expanded */
  isExpanded: (id: string) => boolean;
  /** Toggle a node's expansion state */
  toggle: (id: string) => void;
  /** Expand a specific node */
  expand: (id: string) => void;
  /** Collapse a specific node */
  collapse: (id: string) => void;
  /** Expand all nodes */
  expandAll: () => void;
  /** Collapse all nodes */
  collapseAll: () => void;
}

/**
 * Tree selection state.
 */
export interface TreeSelectionState {
  /** Currently selected node ID */
  selectedId: string | null;
  /** Select a node */
  select: (id: string | null) => void;
  /** Check if a node is selected */
  isSelected: (id: string) => boolean;
}
