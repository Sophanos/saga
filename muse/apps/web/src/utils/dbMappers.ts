/**
 * Centralized DB <-> Core type mappers
 */

import type { Database } from "@mythos/db";
import type {
  Project,
  Document,
  Entity,
  Character,
  Location,
  Item,
  MagicSystem,
  Faction,
  PropertyValue,
  Relationship,
  RelationType,
  TemplateId,
  TemplateOverrides,
} from "@mythos/core";

export type DbProject = Database["public"]["Tables"]["projects"]["Row"];
export type DbDocument = Database["public"]["Tables"]["documents"]["Row"];
export type DbEntity = Database["public"]["Tables"]["entities"]["Row"];
export type DbEntityInsert = Database["public"]["Tables"]["entities"]["Insert"];
export type DbEntityUpdate = Database["public"]["Tables"]["entities"]["Update"];
export type DbRelationship = Database["public"]["Tables"]["relationships"]["Row"];
export type DbRelationshipInsert = Database["public"]["Tables"]["relationships"]["Insert"];
export type DbRelationshipUpdate = Database["public"]["Tables"]["relationships"]["Update"];

function getProp<T>(obj: Record<string, unknown> | null | undefined, key: string): T | undefined {
  if (!obj) return undefined;
  return obj[key] as T | undefined;
}

export function mapDbProjectToProject(dbProject: DbProject): Project {
  const styleConfig = dbProject.style_config as Record<string, unknown> | null;

  // Build templateOverrides if any config exists (Migration 005)
  let templateOverrides: TemplateOverrides | undefined;
  const hasEntityKinds = dbProject.entity_kinds_config && dbProject.entity_kinds_config.length > 0;
  const hasRelationshipKinds = dbProject.relationship_kinds_config && dbProject.relationship_kinds_config.length > 0;
  const hasDocumentKinds = dbProject.document_kinds_config && dbProject.document_kinds_config.length > 0;
  const hasUiConfig = dbProject.ui_config && Object.keys(dbProject.ui_config).length > 0;

  if (hasEntityKinds || hasRelationshipKinds || hasDocumentKinds || hasUiConfig) {
    templateOverrides = {};
    if (hasEntityKinds) {
      templateOverrides.customEntityKinds = dbProject.entity_kinds_config as TemplateOverrides["customEntityKinds"];
    }
    if (hasRelationshipKinds) {
      templateOverrides.customRelationshipKinds = dbProject.relationship_kinds_config as TemplateOverrides["customRelationshipKinds"];
    }
    if (hasDocumentKinds) {
      templateOverrides.customDocumentKinds = dbProject.document_kinds_config as TemplateOverrides["customDocumentKinds"];
    }
    if (hasUiConfig) {
      templateOverrides.uiModuleOverrides = dbProject.ui_config as TemplateOverrides["uiModuleOverrides"];
    }
  }

  return {
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description ?? undefined,
    templateId: (dbProject.template_id as TemplateId) ?? undefined,
    templateOverrides,
    config: {
      genre: dbProject.genre as Project["config"]["genre"],
      styleMode: getProp<Project["config"]["styleMode"]>(styleConfig, "styleMode") ?? "manga",
      arcTemplate: getProp<Project["config"]["arcTemplate"]>(styleConfig, "arcTemplate") ?? "three_act",
      linterConfig: (dbProject.linter_config as Project["config"]["linterConfig"]) ?? {},
    },
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at),
  };
}

export function mapDbDocumentToDocument(dbDoc: DbDocument): Document {
  return {
    id: dbDoc.id,
    projectId: dbDoc.project_id,
    parentId: dbDoc.parent_id ?? undefined,
    type: dbDoc.type as Document["type"],
    title: dbDoc.title ?? undefined,
    content: dbDoc.content,
    orderIndex: dbDoc.order_index,
    wordCount: dbDoc.word_count,
    createdAt: new Date(dbDoc.created_at),
    updatedAt: new Date(dbDoc.updated_at),
  };
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

export function mapDbRelationshipToRelationship(dbRelationship: DbRelationship): Relationship {
  return {
    id: dbRelationship.id,
    sourceId: dbRelationship.source_id,
    targetId: dbRelationship.target_id,
    type: dbRelationship.type as RelationType,
    bidirectional: dbRelationship.bidirectional,
    strength: dbRelationship.strength ?? undefined,
    metadata: dbRelationship.metadata as Record<string, PropertyValue> | undefined,
    createdAt: new Date(dbRelationship.created_at),
  };
}

/**
 * Maps a core Relationship to DB insert format.
 */
export function mapCoreRelationshipToDbInsert(
  relationship: Relationship,
  projectId: string
): DbRelationshipInsert {
  return {
    id: relationship.id,
    project_id: projectId,
    source_id: relationship.sourceId,
    target_id: relationship.targetId,
    type: relationship.type,
    bidirectional: relationship.bidirectional,
    strength: relationship.strength ?? null,
    metadata: relationship.metadata ?? null,
  };
}

/**
 * Maps a complete relationship to DB update format.
 * Use this when you have the full merged relationship state.
 */
export function mapCoreRelationshipToDbFullUpdate(
  relationship: Relationship
): DbRelationshipUpdate {
  return {
    source_id: relationship.sourceId,
    target_id: relationship.targetId,
    type: relationship.type,
    bidirectional: relationship.bidirectional,
    strength: relationship.strength ?? null,
    metadata: relationship.metadata ?? null,
  };
}
