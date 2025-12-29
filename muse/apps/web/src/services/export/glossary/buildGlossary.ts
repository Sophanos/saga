import type { Entity, EntityType } from "@mythos/core";

// ============================================================================
// Glossary Types
// ============================================================================

/**
 * A single entry in the glossary
 */
export interface GlossaryEntry {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  description?: string;
  /** Additional fields for display (label -> value) */
  fields?: Array<{ label: string; value: string }>;
}

/**
 * A section of the glossary (one per entity type)
 */
export interface GlossarySection {
  type: EntityType;
  title: string;
  entries: GlossaryEntry[];
}

/**
 * Options for building the glossary
 */
export interface BuildGlossaryOptions {
  /** Entity types to include */
  includeTypes: EntityType[];
  /** Only include entities referenced in the exported content */
  onlyReferenced: boolean;
  /** Set of entity IDs that are referenced (required if onlyReferenced is true) */
  referencedIds?: Set<string>;
}

// ============================================================================
// Entity Type Display Names
// ============================================================================

const ENTITY_TYPE_TITLES: Record<EntityType, string> = {
  character: "Characters",
  location: "Locations",
  item: "Items",
  magic_system: "Magic Systems",
  faction: "Factions",
  event: "Events",
  concept: "Concepts",
};

// ============================================================================
// Glossary Builder
// ============================================================================

/**
 * Build a glossary from entities
 */
export function buildGlossary(
  entities: Entity[],
  opts: BuildGlossaryOptions
): GlossarySection[] {
  const { includeTypes, onlyReferenced, referencedIds } = opts;

  // Filter entities by type and reference status
  const filteredEntities = entities.filter((entity) => {
    // Must be an included type
    if (!includeTypes.includes(entity.type)) {
      return false;
    }

    // If only referenced, must be in the referenced set
    if (onlyReferenced && referencedIds) {
      return referencedIds.has(entity.id);
    }

    return true;
  });

  // Group by type
  const entitiesByType = new Map<EntityType, Entity[]>();
  for (const entity of filteredEntities) {
    if (!entitiesByType.has(entity.type)) {
      entitiesByType.set(entity.type, []);
    }
    entitiesByType.get(entity.type)!.push(entity);
  }

  // Build sections for each type (in order of includeTypes)
  const sections: GlossarySection[] = [];

  for (const type of includeTypes) {
    const typeEntities = entitiesByType.get(type);
    if (!typeEntities || typeEntities.length === 0) {
      continue;
    }

    // Sort entities alphabetically by name
    typeEntities.sort((a, b) => a.name.localeCompare(b.name));

    sections.push({
      type,
      title: ENTITY_TYPE_TITLES[type] ?? type,
      entries: typeEntities.map((entity) => entityToEntry(entity)),
    });
  }

  return sections;
}

/**
 * Convert an entity to a glossary entry
 */
function entityToEntry(entity: Entity): GlossaryEntry {
  const entry: GlossaryEntry = {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    aliases: entity.aliases ?? [],
    description: extractDescription(entity),
  };

  // Add type-specific fields
  const fields = extractFields(entity);
  if (fields.length > 0) {
    entry.fields = fields;
  }

  return entry;
}

/**
 * Extract a description from an entity
 * 
 * Tries multiple possible sources for description text.
 */
function extractDescription(entity: Entity): string | undefined {
  // Check notes first
  if (entity.notes && typeof entity.notes === "string" && entity.notes.trim()) {
    return entity.notes.trim();
  }

  // Check common property names
  const descriptionKeys = ["description", "summary", "bio", "overview"];
  for (const key of descriptionKeys) {
    const value = entity.properties?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  // For characters, try backstory
  if (entity.type === "character") {
    const backstory = (entity as unknown as Record<string, unknown>)["backstory"];
    if (typeof backstory === "string" && backstory.trim()) {
      // Truncate if very long
      const text = backstory.trim();
      if (text.length > 300) {
        return text.slice(0, 297) + "...";
      }
      return text;
    }
  }

  return undefined;
}

/**
 * Extract additional display fields from an entity
 */
function extractFields(entity: Entity): Array<{ label: string; value: string }> {
  const fields: Array<{ label: string; value: string }> = [];

  switch (entity.type) {
    case "character": {
      const char = entity as unknown as Record<string, unknown>;
      
      // Archetype
      if (char["archetype"] && typeof char["archetype"] === "string") {
        fields.push({
          label: "Archetype",
          value: formatArchetype(char["archetype"]),
        });
      }

      // Goals
      const goals = char["goals"];
      if (Array.isArray(goals) && goals.length > 0) {
        fields.push({
          label: "Goals",
          value: goals.slice(0, 3).join(", "),
        });
      }
      break;
    }

    case "location": {
      const loc = entity as unknown as Record<string, unknown>;
      
      // Climate
      if (loc["climate"] && typeof loc["climate"] === "string") {
        fields.push({ label: "Climate", value: loc["climate"] });
      }

      // Atmosphere
      if (loc["atmosphere"] && typeof loc["atmosphere"] === "string") {
        fields.push({ label: "Atmosphere", value: loc["atmosphere"] });
      }
      break;
    }

    case "item": {
      const item = entity as unknown as Record<string, unknown>;
      
      // Category
      if (item["category"] && typeof item["category"] === "string") {
        fields.push({
          label: "Category",
          value: formatLabel(item["category"]),
        });
      }

      // Rarity
      if (item["rarity"] && typeof item["rarity"] === "string") {
        fields.push({
          label: "Rarity",
          value: formatLabel(item["rarity"]),
        });
      }
      break;
    }

    case "faction": {
      const faction = entity as unknown as Record<string, unknown>;
      
      // Goals
      const goals = faction["goals"];
      if (Array.isArray(goals) && goals.length > 0) {
        fields.push({
          label: "Goals",
          value: goals.slice(0, 2).join(", "),
        });
      }
      break;
    }
  }

  return fields;
}

/**
 * Format an archetype name for display
 */
function formatArchetype(archetype: string): string {
  return archetype
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format a label for display (snake_case to Title Case)
 */
function formatLabel(label: string): string {
  return label
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
