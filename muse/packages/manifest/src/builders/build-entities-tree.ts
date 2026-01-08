/**
 * Build entity tree grouped by type.
 * Creates separate sections for Characters, Locations, Items, etc.
 */

import type { Entity, EntityType } from "@mythos/core";
import { ENTITY_TYPES, ENTITY_HEX_COLORS, getEntityLabel } from "@mythos/core/entities";
import type { TreeNode, ManifestSection, ManifestSectionType } from "../types";
import { entityMatchesSearch } from "../utils/search";

export interface EntitiesTreeInput {
  entities: Entity[];
  searchQuery?: string;
  entityTypes?: EntityType[];
}

export interface EntitiesTreeResult {
  sections: ManifestSection[];
  entityCount: number;
}

/**
 * Map EntityType to ManifestSectionType.
 */
function getEntitySectionType(entityType: EntityType): ManifestSectionType {
  switch (entityType) {
    case "character":
      return "characters";
    case "location":
      return "locations";
    case "item":
      return "items";
    case "magic_system":
      return "magic-systems";
    case "faction":
      return "factions";
    default:
      return "characters"; // fallback
  }
}

/**
 * Build a tree node for an entity.
 */
function buildEntityNode(entity: Entity): TreeNode {
  return {
    id: entity.id,
    name: entity.name,
    type: "entity",
    entityType: entity.type,
    entity,
    color: ENTITY_HEX_COLORS[entity.type],
  };
}

/**
 * Build entity sections grouped by type.
 */
export function buildEntitiesTree(input: EntitiesTreeInput): EntitiesTreeResult {
  const { entities, searchQuery, entityTypes } = input;

  // Filter entities by search and type
  let filtered = entities;
  if (searchQuery) {
    filtered = filtered.filter((e) => entityMatchesSearch(e, searchQuery));
  }
  if (entityTypes && entityTypes.length > 0) {
    filtered = filtered.filter((e) => entityTypes.includes(e.type));
  }

  // Group by type
  const byType = new Map<EntityType, Entity[]>();
  for (const entity of filtered) {
    const existing = byType.get(entity.type) || [];
    existing.push(entity);
    byType.set(entity.type, existing);
  }

  // Build sections for each type that has entities
  const sections: ManifestSection[] = [];

  // Use ENTITY_TYPES order for consistent ordering
  for (const entityType of ENTITY_TYPES) {
    const typeEntities = byType.get(entityType);
    if (!typeEntities || typeEntities.length === 0) continue;

    // Skip event and concept for now (less common)
    if (entityType === "event" || entityType === "concept") continue;

    const sectionType = getEntitySectionType(entityType);
    const label = getEntityLabel(entityType);

    // Sort entities alphabetically by name
    const sortedEntities = [...typeEntities].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    sections.push({
      id: entityType,
      title: `${label}s`,
      type: sectionType,
      children: sortedEntities.map(buildEntityNode),
      collapsible: true,
      defaultExpanded: entityType === "character",
      count: sortedEntities.length,
    });
  }

  return {
    sections,
    entityCount: filtered.length,
  };
}
