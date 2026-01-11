import {
  getProjectTemplate,
  type ProjectTemplateId,
  type TemplateApprovalConfig,
} from "./projectTemplates";
import {
  validateJsonSchema,
  validateSchemaDefinition,
  type JsonSchema,
} from "./jsonSchema";

export type RiskLevel = "low" | "high" | "core";
export type ApprovalConfig = TemplateApprovalConfig;

export type RegistryErrorCode =
  | "INVALID_TYPE"
  | "SCHEMA_VALIDATION_FAILED"
  | "INVALID_REGISTRY"
  | "REGISTRY_LOCKED"
  | "LOCK_FAILED_UNKNOWN_TYPES";

export type RegistryError = {
  code: RegistryErrorCode;
  message: string;
  details?: unknown;
};

export type SchemaValidationError = {
  code: "SCHEMA_VALIDATION_FAILED";
  message: string;
  errors?: unknown;
};

export type TypeDef = {
  type: string;
  displayName: string;
  riskLevel: RiskLevel;
  schema?: unknown;
  icon?: string;
  color?: string;
  approval?: ApprovalConfig;
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

type RegistryValidationResult =
  | { ok: true }
  | { ok: false; code: "INVALID_REGISTRY"; message: string; details?: unknown };

function humanizeType(type: string): string {
  return type
    .split("_")
    .map((segment) =>
      segment ? segment[0]!.toUpperCase() + segment.slice(1) : segment
    )
    .join(" ");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveRiskLevel(value: RiskLevel | undefined): RiskLevel {
  return value ?? "low";
}

export function getDefaultRegistryForTemplate(
  templateId: ProjectTemplateId
): ProjectTypeRegistryResolved {
  const template = getProjectTemplate(templateId);

  const entityTypes: Record<string, TypeDef> = {};
  for (const def of template.entityTypes) {
    entityTypes[def.type] = {
      type: def.type,
      displayName: def.displayName || humanizeType(def.type),
      riskLevel: resolveRiskLevel(def.riskLevel),
      schema: def.schema,
      icon: def.icon,
      color: def.color,
      approval: def.approval,
    };
  }

  const relationshipTypes: Record<string, RelationshipTypeDef> = {};
  for (const def of template.relationshipTypes) {
    relationshipTypes[def.type] = {
      type: def.type,
      displayName: def.displayName || humanizeType(def.type),
      riskLevel: resolveRiskLevel(def.riskLevel),
      schema: def.schema,
      approval: def.approval,
    };
  }

  return { entityTypes, relationshipTypes };
}

export function getWriterDefaultRegistry(): ProjectTypeRegistryResolved {
  return getDefaultRegistryForTemplate("writer");
}

export function validateRegistryOverride(
  override: ProjectTypeRegistryOverride
): RegistryValidationResult {
  const entityTypes = override.entityTypes ?? [];
  const relationshipTypes = override.relationshipTypes ?? [];

  const entityTypeSet = new Set<string>();
  for (const def of entityTypes) {
    if (!isNonEmptyString(def.type)) {
      return {
        ok: false,
        code: "INVALID_REGISTRY",
        message: "Entity type is required",
      };
    }
    if (!isNonEmptyString(def.displayName)) {
      return {
        ok: false,
        code: "INVALID_REGISTRY",
        message: `Entity type "${def.type}" must have a display name`,
      };
    }
    if (entityTypeSet.has(def.type)) {
      return {
        ok: false,
        code: "INVALID_REGISTRY",
        message: `Duplicate entity type "${def.type}"`,
      };
    }
    entityTypeSet.add(def.type);

    if (def.schema !== undefined) {
      if (!isPlainObject(def.schema)) {
        return {
          ok: false,
          code: "INVALID_REGISTRY",
          message: `Entity type "${def.type}" schema must be an object`,
        };
      }
      const schemaResult = validateSchemaDefinition(def.schema as JsonSchema);
      if (!schemaResult.ok) {
        return {
          ok: false,
          code: "INVALID_REGISTRY",
          message: `Entity type "${def.type}" schema is invalid`,
          details: schemaResult.errors,
        };
      }
    }
  }

  const relationshipTypeSet = new Set<string>();
  for (const def of relationshipTypes) {
    if (!isNonEmptyString(def.type)) {
      return {
        ok: false,
        code: "INVALID_REGISTRY",
        message: "Relationship type is required",
      };
    }
    if (!isNonEmptyString(def.displayName)) {
      return {
        ok: false,
        code: "INVALID_REGISTRY",
        message: `Relationship type "${def.type}" must have a display name`,
      };
    }
    if (relationshipTypeSet.has(def.type)) {
      return {
        ok: false,
        code: "INVALID_REGISTRY",
        message: `Duplicate relationship type "${def.type}"`,
      };
    }
    relationshipTypeSet.add(def.type);

    if (def.schema !== undefined) {
      if (!isPlainObject(def.schema)) {
        return {
          ok: false,
          code: "INVALID_REGISTRY",
          message: `Relationship type "${def.type}" schema must be an object`,
        };
      }
      const schemaResult = validateSchemaDefinition(def.schema as JsonSchema);
      if (!schemaResult.ok) {
        return {
          ok: false,
          code: "INVALID_REGISTRY",
          message: `Relationship type "${def.type}" schema is invalid`,
          details: schemaResult.errors,
        };
      }
    }
  }

  return { ok: true };
}

export function resolveRegistry(
  templateId: ProjectTemplateId,
  overrideDoc: ProjectTypeRegistryOverride | null
): ProjectTypeRegistryResolved {
  const defaults = getDefaultRegistryForTemplate(templateId);
  if (!overrideDoc) return defaults;

  const entityTypes: Record<string, TypeDef> = { ...defaults.entityTypes };
  for (const override of overrideDoc.entityTypes ?? []) {
    const type = override.type;
    const base = defaults.entityTypes[type];
    entityTypes[type] = {
      type,
      displayName: override.displayName || base?.displayName || humanizeType(type),
      riskLevel: resolveRiskLevel(override.riskLevel ?? base?.riskLevel),
      schema: override.schema ?? base?.schema,
      icon: override.icon ?? base?.icon,
      color: override.color ?? base?.color,
      approval: base?.approval,
    };
  }

  const relationshipTypes: Record<string, RelationshipTypeDef> = {
    ...defaults.relationshipTypes,
  };
  for (const override of overrideDoc.relationshipTypes ?? []) {
    const type = override.type;
    const base = defaults.relationshipTypes[type];
    relationshipTypes[type] = {
      type,
      displayName: override.displayName || base?.displayName || humanizeType(type),
      riskLevel: resolveRiskLevel(override.riskLevel ?? base?.riskLevel),
      schema: override.schema ?? base?.schema,
      approval: base?.approval,
    };
  }

  return { entityTypes, relationshipTypes };
}

export function getEntityTypeDef(
  registry: ProjectTypeRegistryResolved,
  type: string
): TypeDef | null {
  return registry.entityTypes[type] ?? null;
}

export function getRelationshipTypeDef(
  registry: ProjectTypeRegistryResolved,
  type: string
): RelationshipTypeDef | null {
  return registry.relationshipTypes[type] ?? null;
}

function validateObjectValue(
  value: unknown,
  label: string
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: SchemaValidationError } {
  if (value === undefined) {
    return { ok: true, value: {} };
  }

  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: `${label} must be an object`,
      },
    };
  }

  return { ok: true, value };
}

export function validateEntityProperties(
  def: TypeDef,
  properties: unknown
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: SchemaValidationError } {
  const normalized = validateObjectValue(properties, "Entity properties");
  if (!normalized.ok) return normalized;

  if (!def.schema) {
    return normalized;
  }

  const schemaResult = validateJsonSchema(
    def.schema as JsonSchema,
    normalized.value
  );
  if (!schemaResult.ok) {
    return {
      ok: false,
      error: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: schemaResult.message,
        errors: schemaResult.errors,
      },
    };
  }

  return normalized;
}

export function validateRelationshipMetadata(
  def: RelationshipTypeDef,
  metadata: unknown
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: SchemaValidationError } {
  const normalized = validateObjectValue(metadata, "Relationship metadata");
  if (!normalized.ok) return normalized;

  if (!def.schema) {
    return normalized;
  }

  const schemaResult = validateJsonSchema(
    def.schema as JsonSchema,
    normalized.value
  );
  if (!schemaResult.ok) {
    return {
      ok: false,
      error: {
        code: "SCHEMA_VALIDATION_FAILED",
        message: schemaResult.message,
        errors: schemaResult.errors,
      },
    };
  }

  return normalized;
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
