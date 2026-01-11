/**
 * Entity type configuration
 *
 * Provides UI configuration for entity types including icon names,
 * colors, and labels. Icons are specified as string names (not React components)
 * so this can be used in the core package without React dependencies.
 */
import type {
  GraphEntityType,
  GraphRelationType,
  WriterEntityType,
  WriterRelationType,
} from "./types";

/**
 * Icon names that map to lucide-react icons.
 * Components should map these to actual icon components.
 */
export type EntityIconName =
  | "User"
  | "MapPin"
  | "Sword"
  | "Wand2"
  | "Building2"
  | "Calendar"
  | "Sparkles"
  | "Flag"
  | "ListChecks"
  | "Gauge"
  | "Rocket"
  | "Server"
  | "Link"
  | "Database"
  | "AlertTriangle"
  | "BookOpen"
  | "Box"
  | "Monitor"
  | "Palette"
  | "Shapes"
  | "ClipboardList"
  | "Megaphone"
  | "MessageSquare"
  | "Image"
  | "Users"
  | "Radio";

/**
 * Configuration for a single entity type
 */
export interface EntityTypeConfig {
  /** Icon name from lucide-react */
  icon: EntityIconName;
  /** Human-readable label */
  label: string;
  /** Tailwind CSS color class */
  color: string;
}

export interface GraphTypeDisplay {
  type: string;
  displayName: string;
  icon?: string;
  color?: string;
}

export interface ProjectGraphRegistryDisplay {
  entityTypes: Record<string, GraphTypeDisplay>;
  relationshipTypes: Record<string, Omit<GraphTypeDisplay, "icon" | "color">>;
}

/**
 * Hex colors for entity types (for inline styles, canvas, etc.)
 * These are the canonical color values; Tailwind classes derive from these.
 */
export const WRITER_ENTITY_HEX_COLORS: Record<WriterEntityType, string> = {
  character: "#22d3ee", // cyan
  location: "#22c55e",  // green
  item: "#f59e0b",      // amber
  magic_system: "#8b5cf6", // violet
  faction: "#a855f7",   // purple
  event: "#f97316",     // orange
  concept: "#64748b",   // slate
};

/**
 * Complete configuration for all entity types
 */
export const WRITER_ENTITY_TYPE_CONFIG: Record<WriterEntityType, EntityTypeConfig> = {
  character: {
    icon: "User",
    label: "Character",
    color: "text-mythos-entity-character",
  },
  location: {
    icon: "MapPin",
    label: "Location",
    color: "text-mythos-entity-location",
  },
  item: {
    icon: "Sword",
    label: "Item",
    color: "text-mythos-entity-item",
  },
  magic_system: {
    icon: "Wand2",
    label: "Magic System",
    color: "text-mythos-entity-magic",
  },
  faction: {
    icon: "Building2",
    label: "Faction",
    color: "text-mythos-accent-purple",
  },
  event: {
    icon: "Calendar",
    label: "Event",
    color: "text-mythos-accent-amber",
  },
  concept: {
    icon: "Sparkles",
    label: "Concept",
    color: "text-mythos-accent-cyan",
  },
};

/**
 * All entity types in display order
 */
export const WRITER_ENTITY_TYPES: WriterEntityType[] = [
  "character",
  "location",
  "item",
  "magic_system",
  "faction",
  "event",
  "concept",
];

/**
 * Get the color class for an entity type
 * @param type - The entity type
 * @returns Tailwind CSS color class
 */
export function getEntityColor(type: GraphEntityType): string {
  return WRITER_ENTITY_TYPE_CONFIG[type as WriterEntityType]?.color ?? "text-mythos-text-muted";
}

/**
 * Get the human-readable label for an entity type
 * @param type - The entity type
 * @returns Human-readable label
 */
export function getEntityLabel(type: GraphEntityType): string {
  return WRITER_ENTITY_TYPE_CONFIG[type as WriterEntityType]?.label ?? type.replace("_", " ");
}

/**
 * Get the icon name for an entity type
 * @param type - The entity type
 * @returns Icon name from lucide-react
 */
export function getEntityIcon(type: GraphEntityType): EntityIconName {
  return WRITER_ENTITY_TYPE_CONFIG[type as WriterEntityType]?.icon ?? "Sparkles";
}

/**
 * Get the hex color for an entity type
 * @param type - The entity type
 * @returns Hex color string (e.g., "#22d3ee")
 */
export function getEntityHexColor(type: GraphEntityType): string {
  return WRITER_ENTITY_HEX_COLORS[type as WriterEntityType] ?? "#64748b";
}

export function getGraphEntityLabel(
  registry: ProjectGraphRegistryDisplay | null,
  type: GraphEntityType
): string {
  const def = registry?.entityTypes[type];
  if (def?.displayName) return def.displayName;
  return getEntityLabel(type);
}

export function getGraphEntityIcon(
  registry: ProjectGraphRegistryDisplay | null,
  type: GraphEntityType
): EntityIconName {
  const def = registry?.entityTypes[type];
  if (def?.icon) return def.icon as EntityIconName;
  return getEntityIcon(type);
}

export function getGraphEntityColor(
  registry: ProjectGraphRegistryDisplay | null,
  type: GraphEntityType
): string {
  const def = registry?.entityTypes[type];
  if (def?.color) return def.color;
  return getEntityColor(type);
}

export function getRegistryEntityHexColor(
  registry: ProjectGraphRegistryDisplay | null,
  type: GraphEntityType
): string {
  const def = registry?.entityTypes[type];
  if (def?.color) return def.color;
  return getEntityHexColor(type);
}

// ============================================================================
// Relationship Configuration
// ============================================================================

/**
 * Relationship categories for grouping and styling
 */
export type RelationshipCategory =
  | "familial"
  | "romantic"
  | "social"
  | "conflict"
  | "ownership"
  | "professional"
  | "spatial"
  | "magical"
  | "mechanical"
  | "narrative";

/**
 * Configuration for a relationship type
 */
export interface RelationTypeConfig {
  /** Human-readable label */
  label: string;
  /** Category for grouping */
  category: RelationshipCategory;
  /** Tailwind CSS color class */
  color: string;
}

/**
 * Complete configuration for all relationship types
 */
export const WRITER_RELATION_TYPE_CONFIG: Record<WriterRelationType, RelationTypeConfig> = {
  // Familial
  parent_of: {
    label: "Parent Of",
    category: "familial",
    color: "text-blue-400",
  },
  child_of: {
    label: "Child Of",
    category: "familial",
    color: "text-blue-400",
  },
  sibling_of: {
    label: "Sibling Of",
    category: "familial",
    color: "text-blue-400",
  },
  married_to: {
    label: "Married To",
    category: "familial",
    color: "text-blue-400",
  },
  
  // Romantic
  loves: {
    label: "Loves",
    category: "romantic",
    color: "text-pink-400",
  },
  
  // Social
  knows: {
    label: "Knows",
    category: "social",
    color: "text-slate-400",
  },
  allied_with: {
    label: "Allied With",
    category: "social",
    color: "text-slate-400",
  },
  
  // Conflict
  hates: {
    label: "Hates",
    category: "conflict",
    color: "text-red-400",
  },
  enemy_of: {
    label: "Enemy Of",
    category: "conflict",
    color: "text-red-400",
  },
  killed: {
    label: "Killed",
    category: "conflict",
    color: "text-red-600",
  },
  
  // Ownership
  owns: {
    label: "Owns",
    category: "ownership",
    color: "text-amber-400",
  },
  guards: {
    label: "Guards",
    category: "ownership",
    color: "text-amber-400",
  },
  created: {
    label: "Created",
    category: "ownership",
    color: "text-amber-400",
  },
  
  // Professional
  member_of: {
    label: "Member Of",
    category: "professional",
    color: "text-purple-400",
  },
  rules: {
    label: "Rules",
    category: "professional",
    color: "text-purple-400",
  },
  serves: {
    label: "Serves",
    category: "professional",
    color: "text-purple-400",
  },
  
  // Mechanical (for items/systems)
  weakness: {
    label: "Weakness",
    category: "mechanical",
    color: "text-orange-400",
  },
  strength: {
    label: "Strength",
    category: "mechanical",
    color: "text-green-400",
  },
};

/**
 * Get the label for a relationship type
 * @param type - The relationship type
 * @returns Human-readable label
 */
export function getRelationLabel(type: GraphRelationType): string {
  return WRITER_RELATION_TYPE_CONFIG[type as WriterRelationType]?.label ?? type.replace("_", " ");
}

/**
 * Get the category for a relationship type
 * @param type - The relationship type
 * @returns Relationship category
 */
export function getRelationCategory(type: GraphRelationType): RelationshipCategory {
  return WRITER_RELATION_TYPE_CONFIG[type as WriterRelationType]?.category ?? "social";
}

/**
 * Get the color class for a relationship type
 * @param type - The relationship type
 * @returns Tailwind CSS color class
 */
export function getRelationColor(type: GraphRelationType): string {
  return WRITER_RELATION_TYPE_CONFIG[type as WriterRelationType]?.color ?? "text-slate-400";
}

/**
 * Color mapping for relationship categories (for graph edges)
 */
export const RELATIONSHIP_CATEGORY_COLORS: Record<RelationshipCategory, string> = {
  familial: "#60a5fa",    // blue-400
  romantic: "#f472b6",    // pink-400
  social: "#94a3b8",      // slate-400
  conflict: "#f87171",    // red-400
  ownership: "#fbbf24",   // amber-400
  professional: "#a78bfa", // purple-400
  spatial: "#34d399",     // emerald-400
  magical: "#a855f7",     // violet-500
  mechanical: "#fb923c",  // orange-400
  narrative: "#22d3ee",   // cyan-400
};
