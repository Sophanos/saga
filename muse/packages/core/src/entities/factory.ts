/**
 * Entity Factory
 *
 * Provides centralized entity building logic to avoid duplication
 * across components that need to create or update entities.
 */
import type {
  Entity,
  EntityType,
  Character,
  Location,
  Item,
  MagicSystem,
  Faction,
  JungianArchetype,
  Trait,
} from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * Input data for building an entity.
 * This is a superset of all type-specific fields.
 */
export interface EntityBuildData {
  // Base fields
  name: string;
  type: EntityType;
  aliases?: string[];
  notes?: string;

  // Character fields
  archetype?: JungianArchetype;
  traits?: Trait[];
  backstory?: string;
  goals?: string[];
  fears?: string[];
  voiceNotes?: string;

  // Location fields
  parentLocation?: string;
  climate?: string;
  atmosphere?: string;

  // Item fields
  category?: Item["category"];
  rarity?: Item["rarity"];
  abilities?: string[];

  // Magic System fields
  rules?: string[];
  limitations?: string[];
  costs?: string[];

  // Faction fields
  leader?: string;
  headquarters?: string;
  factionGoals?: string[]; // Separate from character goals
  rivals?: string[];
  allies?: string[];
}

/**
 * Options for entity building
 */
export interface EntityBuildOptions {
  /** Entity ID (defaults to crypto.randomUUID()) */
  id?: string;
  /** Creation timestamp (defaults to now) */
  createdAt?: Date;
  /** Update timestamp (defaults to now) */
  updatedAt?: Date;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Build a complete Entity from input data.
 * Handles all entity types and applies type-specific defaults.
 *
 * @param data - Entity data including type and type-specific fields
 * @param options - Optional configuration (id, timestamps)
 * @returns A fully constructed Entity of the appropriate type
 *
 * @example
 * ```ts
 * const character = buildEntity({
 *   name: "Aragorn",
 *   type: "character",
 *   archetype: "hero",
 *   traits: [{ name: "Brave", type: "strength" }],
 * });
 * ```
 */
export function buildEntity(
  data: EntityBuildData,
  options: EntityBuildOptions = {}
): Entity {
  const now = new Date();
  const {
    id = crypto.randomUUID(),
    createdAt = now,
    updatedAt = now,
  } = options;

  // Build base entity
  const baseEntity = {
    id,
    name: data.name,
    type: data.type,
    aliases: data.aliases ?? [],
    notes: data.notes,
    properties: {},
    createdAt,
    updatedAt,
    mentions: [],
  };

  // Apply type-specific fields
  switch (data.type) {
    case "character": {
      const character: Character = {
        ...baseEntity,
        type: "character",
        archetype: data.archetype,
        traits: data.traits ?? [],
        status: {},
        visualDescription: {},
        backstory: data.backstory,
        goals: data.goals ?? [],
        fears: data.fears ?? [],
        voiceNotes: data.voiceNotes,
      };
      return character;
    }

    case "location": {
      const location: Location = {
        ...baseEntity,
        type: "location",
        parentLocation: data.parentLocation,
        climate: data.climate,
        atmosphere: data.atmosphere,
      };
      return location;
    }

    case "item": {
      const item: Item = {
        ...baseEntity,
        type: "item",
        category: data.category ?? "other",
        rarity: data.rarity,
        abilities: data.abilities ?? [],
      };
      return item;
    }

    case "magic_system": {
      const magicSystem: MagicSystem = {
        ...baseEntity,
        type: "magic_system",
        rules: data.rules ?? [],
        limitations: data.limitations ?? [],
        costs: data.costs ?? [],
      };
      return magicSystem;
    }

    case "faction": {
      const faction: Faction = {
        ...baseEntity,
        type: "faction",
        leader: data.leader,
        headquarters: data.headquarters,
        goals: data.factionGoals ?? [],
        rivals: data.rivals ?? [],
        allies: data.allies ?? [],
      };
      return faction;
    }

    // For event, concept, or unknown types, return base entity
    default: {
      return baseEntity as Entity;
    }
  }
}

/**
 * Extract type-specific fields from entity build data for partial updates.
 * Useful when updating an existing entity.
 *
 * @param data - Entity data with type and type-specific fields
 * @returns Partial entity updates including type-specific fields
 *
 * @example
 * ```ts
 * const updates = getTypeSpecificUpdates({
 *   type: "character",
 *   name: "Aragorn",
 *   archetype: "hero",
 *   backstory: "A ranger from the North...",
 * });
 * // Returns: { name, archetype, backstory, ... }
 * ```
 */
export function getTypeSpecificUpdates(
  data: EntityBuildData
): Partial<Entity> {
  const baseUpdates: Partial<Entity> = {
    name: data.name,
    aliases: data.aliases,
    notes: data.notes,
    updatedAt: new Date(),
  };

  switch (data.type) {
    case "character":
      return {
        ...baseUpdates,
        archetype: data.archetype,
        traits: data.traits,
        backstory: data.backstory,
        goals: data.goals,
        fears: data.fears,
        voiceNotes: data.voiceNotes,
      } as Partial<Character>;

    case "location":
      return {
        ...baseUpdates,
        parentLocation: data.parentLocation,
        climate: data.climate,
        atmosphere: data.atmosphere,
      } as Partial<Location>;

    case "item":
      return {
        ...baseUpdates,
        category: data.category,
        rarity: data.rarity,
        abilities: data.abilities,
      } as Partial<Item>;

    case "magic_system":
      return {
        ...baseUpdates,
        rules: data.rules,
        limitations: data.limitations,
        costs: data.costs,
      } as Partial<MagicSystem>;

    case "faction":
      return {
        ...baseUpdates,
        leader: data.leader,
        headquarters: data.headquarters,
        goals: data.factionGoals,
        rivals: data.rivals,
        allies: data.allies,
      } as Partial<Faction>;

    default:
      return baseUpdates;
  }
}
