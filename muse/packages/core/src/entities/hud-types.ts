import type { Character, Location, Item, JungianArchetype, Trait, CharacterStatus } from "./types";

/**
 * Represents a narrative thread connecting the current entity to the story.
 * Used in Writer mode to show story connections and plot relevance.
 */
export interface NarrativeThread {
  id: string;
  /** Thread label/name */
  label: string;
  /** Description of how this entity relates to the thread */
  description: string;
  /** Type of narrative connection */
  type: "plot" | "subplot" | "character_arc" | "theme" | "foreshadowing" | "callback";
  /** Importance level (1-10) */
  importance: number;
  /** IDs of related entities in this thread */
  relatedEntityIds: string[];
  /** Current status of this narrative thread */
  status?: "active" | "dormant" | "resolved" | "abandoned";
}

/**
 * HUD data specific to Character entities.
 * Contains both DM stats and Writer narrative information.
 */
export interface CharacterHudData {
  entityType: "character";
  entity: Character;

  // DM Mode data
  stats: {
    archetype: JungianArchetype | undefined;
    health: CharacterStatus["health"];
    mood: string | undefined;
    location: string | undefined;
    activeQuest: string | undefined;
    powerLevel: number | undefined;
    traits: Trait[];
  };

  // Writer Mode data
  narrativeThreads: NarrativeThread[];

  // Visual description summary for both modes
  visualSummary: string | undefined;
}

/**
 * HUD data specific to Item entities.
 * Contains both DM stats and Writer narrative information.
 */
export interface ItemHudData {
  entityType: "item";
  entity: Item;

  // DM Mode data
  stats: {
    category: Item["category"];
    rarity: Item["rarity"];
    owner: string | undefined;
    currentLocation: string | undefined;
    abilities: string[];
  };

  // Writer Mode data
  narrativeThreads: NarrativeThread[];

  // Description summary
  description: string | undefined;
}

/**
 * HUD data specific to Location entities.
 * Contains both DM stats and Writer narrative information.
 */
export interface LocationHudData {
  entityType: "location";
  entity: Location;

  // DM Mode data
  stats: {
    parentLocation: string | undefined;
    climate: string | undefined;
    atmosphere: string | undefined;
    inhabitantCount: number;
    connectedLocationCount: number;
  };

  // Writer Mode data
  narrativeThreads: NarrativeThread[];

  // Description summary
  description: string | undefined;
}

/**
 * Union type for all HUD data types
 */
export type EntityHudData = CharacterHudData | ItemHudData | LocationHudData;

/**
 * Helper function to determine if HUD data is for a specific entity type
 */
export function isCharacterHudData(data: EntityHudData): data is CharacterHudData {
  return data.entityType === "character";
}

export function isItemHudData(data: EntityHudData): data is ItemHudData {
  return data.entityType === "item";
}

export function isLocationHudData(data: EntityHudData): data is LocationHudData {
  return data.entityType === "location";
}
