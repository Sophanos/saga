/**
 * Entity mappers: DB <-> Core type conversions
 */

import type { Database } from "../types/database";
import type {
  Entity,
  Character,
  Location,
  Item,
  MagicSystem,
  Faction,
  PropertyValue,
} from "@mythos/core";

// DB types
export type DbEntity = Database["public"]["Tables"]["entities"]["Row"];
export type DbEntityInsert = Database["public"]["Tables"]["entities"]["Insert"];
export type DbEntityUpdate = Database["public"]["Tables"]["entities"]["Update"];

function getProp<T>(obj: Record<string, unknown> | null | undefined, key: string): T | undefined {
  if (!obj) return undefined;
  return obj[key] as T | undefined;
}

function extractTypeData(entity: Entity): Record<string, unknown> {
  const baseProps: Record<string, unknown> = { ...entity.properties };
  if (entity["notes"]) baseProps["notes"] = entity["notes"];

  switch (entity.type) {
    case "character": {
      const char = entity as Character;
      return { ...baseProps, traits: char.traits, status: char.status, visualDescription: char.visualDescription, backstory: char.backstory, goals: char.goals, fears: char.fears, voiceNotes: char.voiceNotes };
    }
    case "location": {
      const loc = entity as Location;
      return { ...baseProps, parentLocation: loc.parentLocation, climate: loc.climate, atmosphere: loc.atmosphere, inhabitants: loc.inhabitants, connectedTo: loc.connectedTo };
    }
    case "item": {
      const item = entity as Item;
      return { ...baseProps, category: item.category, rarity: item.rarity, owner: item.owner, location: item.location, abilities: item.abilities };
    }
    case "magic_system": {
      const magic = entity as MagicSystem;
      return { ...baseProps, rules: magic.rules, limitations: magic.limitations, costs: magic.costs, users: magic.users, spells: magic.spells };
    }
    case "faction": {
      const faction = entity as Faction;
      return { ...baseProps, leader: faction.leader, members: faction.members, headquarters: faction.headquarters, goals: faction.goals, rivals: faction.rivals, allies: faction.allies };
    }
    default:
      return baseProps;
  }
}

export function mapDbEntityToEntity(dbEntity: DbEntity): Entity {
  const props = dbEntity.properties as Record<string, unknown>;
  const baseEntity: Entity = {
    id: dbEntity.id,
    name: dbEntity.name,
    aliases: dbEntity.aliases ?? [],
    type: dbEntity.type as Entity["type"],
    properties: dbEntity.properties as Record<string, PropertyValue>,
    mentions: [],
    createdAt: new Date(dbEntity.created_at),
    updatedAt: new Date(dbEntity.updated_at),
    notes: getProp<string>(props, "notes"),
  };

  switch (dbEntity.type) {
    case "character": {
      const character: Character = {
        ...baseEntity,
        type: "character",
        archetype: dbEntity.archetype as Character["archetype"],
        traits: getProp<Character["traits"]>(props, "traits") ?? [],
        status: getProp<Character["status"]>(props, "status") ?? {},
        visualDescription: getProp<Character["visualDescription"]>(props, "visualDescription") ?? {},
        backstory: getProp<string>(props, "backstory"),
        goals: getProp<string[]>(props, "goals"),
        fears: getProp<string[]>(props, "fears"),
        voiceNotes: getProp<string>(props, "voiceNotes"),
      };
      return character;
    }
    case "location": {
      const location: Location = {
        ...baseEntity,
        type: "location",
        parentLocation: getProp<string>(props, "parentLocation"),
        climate: getProp<string>(props, "climate"),
        atmosphere: getProp<string>(props, "atmosphere"),
        inhabitants: getProp<string[]>(props, "inhabitants"),
        connectedTo: getProp<string[]>(props, "connectedTo"),
      };
      return location;
    }
    case "item": {
      const item: Item = {
        ...baseEntity,
        type: "item",
        category: getProp<Item["category"]>(props, "category") ?? "other",
        rarity: getProp<Item["rarity"]>(props, "rarity"),
        owner: getProp<string>(props, "owner"),
        location: getProp<string>(props, "location"),
        abilities: getProp<string[]>(props, "abilities"),
      };
      return item;
    }
    case "magic_system": {
      const magicSystem: MagicSystem = {
        ...baseEntity,
        type: "magic_system",
        rules: getProp<string[]>(props, "rules") ?? [],
        limitations: getProp<string[]>(props, "limitations") ?? [],
        costs: getProp<string[]>(props, "costs"),
        users: getProp<string[]>(props, "users"),
        spells: getProp<MagicSystem["spells"]>(props, "spells"),
      };
      return magicSystem;
    }
    case "faction": {
      const faction: Faction = {
        ...baseEntity,
        type: "faction",
        leader: getProp<string>(props, "leader"),
        members: getProp<string[]>(props, "members"),
        headquarters: getProp<string>(props, "headquarters"),
        goals: getProp<string[]>(props, "goals"),
        rivals: getProp<string[]>(props, "rivals"),
        allies: getProp<string[]>(props, "allies"),
      };
      return faction;
    }
    default:
      return baseEntity;
  }
}

export function mapCoreEntityToDbInsert(entity: Entity, projectId: string): DbEntityInsert {
  let archetype: string | null = null;
  if (entity.type === "character") {
    archetype = (entity as Character).archetype ?? null;
  }
  return {
    id: entity.id,
    project_id: projectId,
    type: entity.type,
    name: entity.name,
    aliases: entity.aliases,
    properties: extractTypeData(entity),
    archetype,
  };
}

/**
 * Maps partial entity updates to DB update format.
 * Only includes fields that are present in the updates object.
 */
export function mapCoreEntityToDbUpdate(updates: Partial<Entity>): DbEntityUpdate {
  const dbUpdate: DbEntityUpdate = {};
  if (updates.name !== undefined) dbUpdate.name = updates.name;
  if (updates.aliases !== undefined) dbUpdate.aliases = updates.aliases;
  if (updates.type !== undefined) dbUpdate.type = updates.type;
  dbUpdate.updated_at = new Date().toISOString();
  return dbUpdate;
}

/**
 * Maps a complete entity to DB update format.
 * This ensures all entity data (including properties and archetype) is persisted.
 * Use this when you have the full merged entity state.
 */
export function mapCoreEntityToDbFullUpdate(entity: Entity): DbEntityUpdate {
  let archetype: string | null = null;
  if (entity.type === "character") {
    archetype = (entity as Character).archetype ?? null;
  }
  return {
    type: entity.type,
    name: entity.name,
    aliases: entity.aliases,
    properties: extractTypeData(entity),
    archetype,
    updated_at: new Date().toISOString(),
  };
}
