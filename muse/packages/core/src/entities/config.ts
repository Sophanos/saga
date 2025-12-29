/**
 * Entity type configuration
 *
 * Provides UI configuration for entity types including icon names,
 * colors, and labels. Icons are specified as string names (not React components)
 * so this can be used in the core package without React dependencies.
 */
import type { EntityType } from "./types";

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
  | "Sparkles";

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

/**
 * Complete configuration for all entity types
 */
export const ENTITY_TYPE_CONFIG: Record<EntityType, EntityTypeConfig> = {
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
export const ENTITY_TYPES: EntityType[] = [
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
export function getEntityColor(type: EntityType): string {
  return ENTITY_TYPE_CONFIG[type]?.color ?? "text-mythos-text-muted";
}

/**
 * Get the human-readable label for an entity type
 * @param type - The entity type
 * @returns Human-readable label
 */
export function getEntityLabel(type: EntityType): string {
  return ENTITY_TYPE_CONFIG[type]?.label ?? type.replace("_", " ");
}

/**
 * Get the icon name for an entity type
 * @param type - The entity type
 * @returns Icon name from lucide-react
 */
export function getEntityIcon(type: EntityType): EntityIconName {
  return ENTITY_TYPE_CONFIG[type]?.icon ?? "Sparkles";
}
