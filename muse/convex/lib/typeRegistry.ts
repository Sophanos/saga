import {
  CORE_RELATIONSHIP_TYPES,
  ENTITY_TYPES,
  HIGH_IMPACT_ENTITY_TYPES,
  HIGH_IMPACT_RELATIONSHIP_TYPES,
  RELATION_TYPES,
  SENSITIVE_ENTITY_TYPES,
} from "./approvalConfig";

export type RiskLevel = "low" | "high" | "core";

export type TypeDef = {
  type: string;
  displayName: string;
  riskLevel: RiskLevel;
  schema?: unknown;
  icon?: string;
  color?: string;
};

export type RelationshipTypeDef = Omit<TypeDef, "icon" | "color">;

export type ProjectTypeRegistryResolved = {
  entityTypes: Record<string, TypeDef>;
  relationshipTypes: Record<string, RelationshipTypeDef>;
};

export type ProjectTypeRegistryOverride = {
  entityTypes: Array<{
    type: string;
    displayName: string;
    riskLevel?: RiskLevel;
    schema?: unknown;
    icon?: string;
    color?: string;
  }>;
  relationshipTypes: Array<{
    type: string;
    displayName: string;
    riskLevel?: RiskLevel;
    schema?: unknown;
  }>;
};

function humanizeType(type: string): string {
  return type
    .split("_")
    .map((segment) => (segment ? segment[0]!.toUpperCase() + segment.slice(1) : segment))
    .join(" ");
}

function resolveEntityRiskLevel(type: string): RiskLevel {
  if ((SENSITIVE_ENTITY_TYPES as readonly string[]).includes(type)) return "core";
  if ((HIGH_IMPACT_ENTITY_TYPES as readonly string[]).includes(type)) return "high";
  return "low";
}

function resolveRelationshipRiskLevel(type: string): RiskLevel {
  if ((CORE_RELATIONSHIP_TYPES as readonly string[]).includes(type)) return "core";
  if ((HIGH_IMPACT_RELATIONSHIP_TYPES as readonly string[]).includes(type)) return "high";
  return "low";
}

export function getWriterDefaultRegistry(): ProjectTypeRegistryResolved {
  const entityTypes: Record<string, TypeDef> = {};
  for (const type of ENTITY_TYPES) {
    entityTypes[type] = {
      type,
      displayName: humanizeType(type),
      riskLevel: resolveEntityRiskLevel(type),
    };
  }

  const relationshipTypes: Record<string, RelationshipTypeDef> = {};
  for (const type of RELATION_TYPES) {
    relationshipTypes[type] = {
      type,
      displayName: humanizeType(type),
      riskLevel: resolveRelationshipRiskLevel(type),
    };
  }

  return { entityTypes, relationshipTypes };
}

export function resolveRegistry(
  overrideDoc: ProjectTypeRegistryOverride | null
): ProjectTypeRegistryResolved {
  const defaults = getWriterDefaultRegistry();
  if (!overrideDoc) return defaults;

  const entityTypes: Record<string, TypeDef> = { ...defaults.entityTypes };
  for (const override of overrideDoc.entityTypes ?? []) {
    const type = override.type;
    entityTypes[type] = {
      type,
      displayName: override.displayName || humanizeType(type),
      riskLevel:
        override.riskLevel ??
        defaults.entityTypes[type]?.riskLevel ??
        resolveEntityRiskLevel(type),
      schema: override.schema ?? defaults.entityTypes[type]?.schema,
      icon: override.icon ?? defaults.entityTypes[type]?.icon,
      color: override.color ?? defaults.entityTypes[type]?.color,
    };
  }

  const relationshipTypes: Record<string, RelationshipTypeDef> = { ...defaults.relationshipTypes };
  for (const override of overrideDoc.relationshipTypes ?? []) {
    const type = override.type;
    relationshipTypes[type] = {
      type,
      displayName: override.displayName || humanizeType(type),
      riskLevel:
        override.riskLevel ??
        defaults.relationshipTypes[type]?.riskLevel ??
        resolveRelationshipRiskLevel(type),
      schema: override.schema ?? defaults.relationshipTypes[type]?.schema,
    };
  }

  return { entityTypes, relationshipTypes };
}

export function requireEntityType(
  registry: ProjectTypeRegistryResolved,
  type: string
): TypeDef {
  const def = registry.entityTypes[type];
  if (!def) {
    throw new Error(`Unknown entity type: ${type}`);
  }
  return def;
}

export function requireRelationshipType(
  registry: ProjectTypeRegistryResolved,
  type: string
): RelationshipTypeDef {
  const def = registry.relationshipTypes[type];
  if (!def) {
    throw new Error(`Unknown relationship type: ${type}`);
  }
  return def;
}

