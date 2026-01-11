/**
 * Tool Approval Configuration
 *
 * Centralized configuration for AI tool approval logic.
 * Uses the resolved project registry for risk-aware decisions.
 */

import type {
  ProjectTypeRegistryResolved,
  RelationshipTypeDef,
  RiskLevel,
  TypeDef,
} from "./typeRegistry";

export const RELATIONSHIP_STRENGTH_THRESHOLD = 0.3;

function isHighRiskLevel(level: RiskLevel | undefined): boolean {
  return level === "high" || level === "core";
}

function getIdentityFields(def?: TypeDef): readonly string[] {
  return def?.approval?.identityFields ?? [];
}

export function hasIdentityChange(
  updates: Record<string, unknown>,
  identityFields: readonly string[]
): boolean {
  return identityFields.some((field) => updates[field] !== undefined);
}

export function isSignificantStrengthChange(
  strength: number | undefined
): boolean {
  return strength !== undefined && strength < RELATIONSHIP_STRENGTH_THRESHOLD;
}

function shouldApproveEntityCreate(def?: TypeDef): boolean {
  if (!def) return true;
  if (def.approval?.createRequiresApproval) return true;
  return isHighRiskLevel(def.riskLevel);
}

function shouldApproveEntityUpdate(
  def: TypeDef | undefined,
  updates: Record<string, unknown>
): boolean {
  if (!def) return true;
  if (def.approval?.updateAlwaysRequiresApproval) return true;
  if (def.riskLevel === "core") return true;
  const identityFields = getIdentityFields(def);
  if (identityFields.length === 0) return false;
  return hasIdentityChange(updates, identityFields);
}

function shouldApproveRelationshipCreate(def?: RelationshipTypeDef): boolean {
  if (!def) return true;
  return isHighRiskLevel(def.riskLevel);
}

function shouldApproveRelationshipUpdate(
  def: RelationshipTypeDef | undefined,
  updates: Record<string, unknown>
): boolean {
  if (!def) return true;
  if (def.riskLevel === "core") return true;
  if (updates["bidirectional"] !== undefined) return true;
  return isSignificantStrengthChange(updates["strength"] as number | undefined);
}

export function needsToolApproval(
  registry: ProjectTypeRegistryResolved | null,
  toolName: string,
  args: Record<string, unknown>
): boolean {
  switch (toolName) {
    case "write_content":
    case "ask_question":
    case "commit_decision":
      return true;

    case "create_entity":
    case "create_node": {
      if (!registry) return true;
      const type =
        typeof args["type"] === "string" ? (args["type"] as string) : undefined;
      if (!type) return true;
      return shouldApproveEntityCreate(registry.entityTypes[type]);
    }

    case "update_entity": {
      if (!registry) return true;
      const type =
        typeof args["entityType"] === "string"
          ? (args["entityType"] as string)
          : undefined;
      const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};
      if (!type) return true;
      return shouldApproveEntityUpdate(registry.entityTypes[type], updates);
    }

    case "update_node": {
      if (!registry) return true;
      const type =
        typeof args["nodeType"] === "string"
          ? (args["nodeType"] as string)
          : undefined;
      const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};
      if (!type) return true;
      return shouldApproveEntityUpdate(registry.entityTypes[type], updates);
    }

    case "create_relationship":
    case "create_edge": {
      if (!registry) return true;
      const type =
        typeof args["type"] === "string" ? (args["type"] as string) : undefined;
      if (!type) return true;
      return shouldApproveRelationshipCreate(registry.relationshipTypes[type]);
    }

    case "update_relationship":
    case "update_edge": {
      if (!registry) return true;
      const type =
        typeof args["type"] === "string" ? (args["type"] as string) : undefined;
      const updates = (args["updates"] as Record<string, unknown> | undefined) ?? {};
      if (!type) return true;
      return shouldApproveRelationshipUpdate(registry.relationshipTypes[type], updates);
    }

    default:
      return false;
  }
}
