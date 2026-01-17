/**
 * Knowledge suggestions (Knowledge PRs) for graph and memory mutations.
 *
 * These are created when the agent emits a tool-approval-request, then resolved
 * when the user provides a tool-result (or a future approval workflow).
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { verifyProjectAccess } from "./lib/auth";
import { hashSnapshot } from "./lib/contentHash";
import { isQdrantConfigured } from "./lib/qdrant";
import { deletePointsForWrite } from "./lib/qdrantCollections";
import {
  getEntityTypeDef,
  getRelationshipTypeDef,
  validateEntityProperties,
  validateRelationshipMetadata,
  type ProjectTypeRegistryResolved,
} from "./lib/typeRegistry";

const apiAny = api as any;
const internalAny = internal as any;

const targetTypeSchema = v.union(
  v.literal("document"),
  v.literal("entity"),
  v.literal("relationship"),
  v.literal("memory")
);

const statusSchema = v.union(
  v.literal("proposed"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("resolved")
);

const riskLevelSchema = v.optional(
  v.union(v.literal("low"), v.literal("high"), v.literal("core"))
);

type ToolResultArtifact = {
  kind: "entity" | "relationship" | "memory" | "document";
  id: string;
};

type ToolResultEnvelope = {
  success: boolean;
  error?: { message?: string; code?: string; details?: unknown } | string;
  artifacts?: ToolResultArtifact[];
  rollback?: Record<string, unknown>;
  citations?: Array<{ citationId: string }>;
  metadata?: Record<string, unknown>;
};

type CanonCitationInput = {
  memoryId: string;
  category?: "decision" | "policy";
  excerpt?: string;
  reason?: string;
  confidence?: number;
};

type SuggestionPreflightStatus = "ok" | "invalid" | "conflict";

type SuggestionPreflight = {
  status: SuggestionPreflightStatus;
  errors?: string[];
  warnings?: string[];
  resolvedTargetId?: string;
  baseFingerprint?: string;
  fingerprintAlgo?: "sha256_stablejson_v1";
  computedAt: number;
};

type ProjectRole = "owner" | "editor" | "viewer";

function extractCitationsFromPatch(
  patch: unknown
): { toolArgs: unknown; citations: CanonCitationInput[] } {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return { toolArgs: patch, citations: [] };
  }

  const record = patch as Record<string, unknown>;
  const citationsValue = record["citations"];
  if (!Array.isArray(citationsValue)) {
    return { toolArgs: patch, citations: [] };
  }

  const citations = citationsValue
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      if (typeof item["memoryId"] !== "string") return null;
      const confidence =
        typeof item["confidence"] === "number" ? item["confidence"] : undefined;
      return {
        memoryId: item["memoryId"] as string,
        category:
          item["category"] === "decision" || item["category"] === "policy"
            ? (item["category"] as "decision" | "policy")
            : undefined,
        excerpt: typeof item["excerpt"] === "string" ? (item["excerpt"] as string) : undefined,
        reason: typeof item["reason"] === "string" ? (item["reason"] as string) : undefined,
        confidence,
      };
    })
    .filter(Boolean)
    .slice(0, 10) as CanonCitationInput[];

  const { citations: _ignored, ...rest } = record;
  return { toolArgs: rest, citations };
}

function parseToolResultEnvelope(result: Record<string, unknown> | null): ToolResultEnvelope | null {
  if (!result) return null;
  if (typeof result["success"] !== "boolean") return null;
  return result as ToolResultEnvelope;
}

function resolveEnvelopeError(result: ToolResultEnvelope): string | undefined {
  if (result.success) return undefined;
  if (!result.error) {
    return "Tool execution failed";
  }
  if (typeof result.error === "string") return result.error;
  if (typeof result.error.message === "string") return result.error.message;
  return "Tool execution failed";
}

function pickArtifactTargetId(artifacts: ToolResultArtifact[] | undefined): string | undefined {
  if (!artifacts || artifacts.length === 0) return undefined;
  const first = artifacts.find((artifact) => typeof artifact.id === "string");
  return first?.id;
}

function isUserRejection(
  toolName: string,
  resultRecord: Record<string, unknown> | null,
  envelope: ToolResultEnvelope | null
): boolean {
  if (envelope && typeof envelope.error === "object") {
    const errorRecord = envelope.error as { code?: string; message?: string };
    if (errorRecord.code === "rejected") return true;
    if (errorRecord.message === "User rejected") return true;
  }
  if (envelope && envelope.error === "User rejected") return true;
  if (toolName === "write_content" && resultRecord?.["applied"] === false) return true;
  return false;
}

type JsonPatchOperation = {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
};

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function addPatchOperation(
  ops: JsonPatchOperation[],
  path: string,
  value: unknown
): void {
  if (value === undefined) return;
  ops.push({ op: "add", path, value });
}

function addPatchOperationsFromRecord(
  ops: JsonPatchOperation[],
  basePath: string,
  record: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    const path = `${basePath}/${escapeJsonPointerSegment(key)}`;
    ops.push({ op: "add", path, value });
  }
}

type NormalizedGraphToolCall = {
  toolName:
    | "create_entity"
    | "update_entity"
    | "create_relationship"
    | "update_relationship"
    | "create_node"
    | "update_node"
    | "create_edge"
    | "update_edge";
  args: Record<string, unknown>;
  kind: "entity" | "relationship";
};

function normalizeGraphToolCall(
  toolName: string,
  args: Record<string, unknown>
): NormalizedGraphToolCall | null {
  if (toolName !== "graph_mutation") return null;
  const action = typeof args["action"] === "string" ? (args["action"] as string) : undefined;
  const target = typeof args["target"] === "string" ? (args["target"] as string) : undefined;
  if (!action || !target || action === "delete") return null;

  if (target === "entity" || target === "node") {
    const baseArgs: Record<string, unknown> = {
      type: args["type"],
      name: args["name"],
      aliases: args["aliases"],
      notes: args["notes"],
      properties: args["properties"],
      archetype: args["archetype"],
      backstory: args["backstory"],
      goals: args["goals"],
      fears: args["fears"],
      citations: args["citations"],
    };

    if (action === "create") {
      return {
        toolName: target === "node" ? "create_node" : "create_entity",
        args: baseArgs,
        kind: "entity",
      };
    }

    return {
      toolName: target === "node" ? "update_node" : "update_entity",
      args:
        target === "node"
          ? {
              nodeName: args["entityName"],
              nodeType: args["entityType"],
              updates: args["updates"],
              citations: args["citations"],
            }
          : {
              entityName: args["entityName"],
              entityType: args["entityType"],
              updates: args["updates"],
              citations: args["citations"],
            },
      kind: "entity",
    };
  }

  if (action === "create") {
    return {
      toolName: target === "edge" ? "create_edge" : "create_relationship",
      args: {
        type: args["type"],
        sourceName: args["sourceName"],
        targetName: args["targetName"],
        bidirectional: args["bidirectional"],
        strength: args["strength"],
        notes: args["notes"],
        metadata: args["metadata"],
        citations: args["citations"],
      },
      kind: "relationship",
    };
  }

  return {
    toolName: target === "edge" ? "update_edge" : "update_relationship",
    args: {
      type: args["type"],
      sourceName: args["sourceName"],
      targetName: args["targetName"],
      updates: args["updates"],
      citations: args["citations"],
    },
    kind: "relationship",
  };
}

function buildNormalizedPatch(
  toolName: string,
  toolArgs: unknown
): JsonPatchOperation[] | undefined {
  const record = getRecord(toolArgs);
  if (!record) return undefined;

  const ops: JsonPatchOperation[] = [];

  switch (toolName) {
    case "graph_mutation": {
      const normalized = normalizeGraphToolCall(toolName, record);
      if (!normalized) return undefined;
      return buildNormalizedPatch(normalized.toolName, normalized.args);
    }
    case "create_entity": {
      addPatchOperation(ops, "/type", record["type"]);
      addPatchOperation(ops, "/name", record["name"]);
      addPatchOperation(ops, "/aliases", record["aliases"]);
      addPatchOperation(ops, "/notes", record["notes"]);
      const propertyEntries = Object.entries(record).filter(
        ([key, value]) =>
          value !== undefined &&
          key !== "type" &&
          key !== "name" &&
          key !== "aliases" &&
          key !== "notes"
      );
      for (const [key, value] of propertyEntries) {
        addPatchOperation(ops, `/properties/${escapeJsonPointerSegment(key)}`, value);
      }
      break;
    }
    case "update_entity": {
      const updates = getRecord(record["updates"]);
      if (!updates) return undefined;
      addPatchOperation(ops, "/name", updates["name"]);
      addPatchOperation(ops, "/aliases", updates["aliases"]);
      addPatchOperation(ops, "/notes", updates["notes"]);
      const propertyEntries = Object.entries(updates).filter(
        ([key, value]) =>
          value !== undefined && key !== "name" && key !== "aliases" && key !== "notes"
      );
      for (const [key, value] of propertyEntries) {
        addPatchOperation(ops, `/properties/${escapeJsonPointerSegment(key)}`, value);
      }
      break;
    }
    case "create_node": {
      addPatchOperation(ops, "/type", record["type"]);
      addPatchOperation(ops, "/name", record["name"]);
      addPatchOperation(ops, "/aliases", record["aliases"]);
      addPatchOperation(ops, "/notes", record["notes"]);
      const properties = getRecord(record["properties"]);
      if (properties) {
        addPatchOperationsFromRecord(ops, "/properties", properties);
      }
      break;
    }
    case "update_node": {
      const updates = getRecord(record["updates"]);
      if (!updates) return undefined;
      addPatchOperation(ops, "/name", updates["name"]);
      addPatchOperation(ops, "/aliases", updates["aliases"]);
      addPatchOperation(ops, "/notes", updates["notes"]);
      const properties = getRecord(updates["properties"]);
      if (properties) {
        addPatchOperationsFromRecord(ops, "/properties", properties);
      }
      break;
    }
    case "create_relationship":
    case "create_edge": {
      addPatchOperation(ops, "/type", record["type"]);
      addPatchOperation(ops, "/notes", record["notes"]);
      addPatchOperation(ops, "/strength", record["strength"]);
      addPatchOperation(ops, "/bidirectional", record["bidirectional"]);
      const metadata = getRecord(record["metadata"]);
      if (metadata) {
        addPatchOperationsFromRecord(ops, "/metadata", metadata);
      }
      break;
    }
    case "update_relationship":
    case "update_edge": {
      const updates = getRecord(record["updates"]);
      if (!updates) return undefined;
      addPatchOperation(ops, "/notes", updates["notes"]);
      addPatchOperation(ops, "/strength", updates["strength"]);
      addPatchOperation(ops, "/bidirectional", updates["bidirectional"]);
      if (updates["metadata"] !== undefined) {
        const metadata = getRecord(updates["metadata"]);
        if (metadata) {
          addPatchOperationsFromRecord(ops, "/metadata", metadata);
        } else {
          addPatchOperation(ops, "/metadata", updates["metadata"]);
        }
      }
      break;
    }
    case "commit_decision": {
      const decision = typeof record["decision"] === "string" ? record["decision"] : "";
      const rationale = typeof record["rationale"] === "string" ? record["rationale"] : "";
      const content = rationale ? `Decision: ${decision}\nRationale: ${rationale}` : decision;
      if (content) {
        addPatchOperation(ops, "/text", content);
      }
      addPatchOperation(ops, "/type", record["category"]);
      addPatchOperation(ops, "/pinned", record["pinned"]);
      addPatchOperation(ops, "/confidence", record["confidence"]);
      addPatchOperation(ops, "/entityIds", record["entityIds"]);
      addPatchOperation(ops, "/documentId", record["documentId"]);
      break;
    }
    default:
      return undefined;
  }

  return ops.length > 0 ? ops : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasUpdateValues(updates: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(updates)) {
    if (key === "properties") {
      const properties = getRecord(value);
      if (properties) {
        for (const propertyValue of Object.values(properties)) {
          if (propertyValue !== undefined) return true;
        }
      } else if (value !== undefined) {
        return true;
      }
      continue;
    }
    if (value !== undefined) return true;
  }
  return false;
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return JSON.stringify("__undefined__");
  }
  if (value === null) {
    return "null";
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries: string[] = [];
  for (const key of keys) {
    const entryValue = record[key];
    if (entryValue === undefined) continue;
    entries.push(`${JSON.stringify(key)}:${stableStringify(entryValue)}`);
  }
  return `{${entries.join(",")}}`;
}

async function hashFingerprint(value: unknown): Promise<string> {
  const payload = stableStringify(value);
  return hashSnapshot(payload);
}

function extractEntityPropertyUpdates(updates: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const nested = getRecord(updates["properties"]);
  if (nested) {
    for (const [key, value] of Object.entries(nested)) {
      if (value === undefined) continue;
      properties[key] = value;
    }
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === "name" || key === "aliases" || key === "notes" || key === "properties") {
      continue;
    }
    properties[key] = value;
  }
  return properties;
}

function buildEntityUpdateSnapshot(
  entity: { name: string; aliases: string[]; notes?: string; properties?: Record<string, unknown> },
  updates: Record<string, unknown>,
  propertyUpdates: Record<string, unknown>
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  if (updates["name"] !== undefined) snapshot["name"] = entity.name;
  if (updates["aliases"] !== undefined) snapshot["aliases"] = entity.aliases;
  if (updates["notes"] !== undefined) snapshot["notes"] = entity.notes;
  const propKeys = Object.keys(propertyUpdates);
  if (propKeys.length > 0) {
    const props: Record<string, unknown> = {};
    for (const key of propKeys) {
      const currentValue = entity.properties ? entity.properties[key] : undefined;
      if (currentValue !== undefined) {
        props[key] = currentValue;
      }
    }
    if (Object.keys(props).length > 0) {
      snapshot["properties"] = props;
    }
  }
  return snapshot;
}

function buildRelationshipUpdateSnapshot(
  relationship: { bidirectional?: boolean; strength?: number; notes?: string; metadata?: unknown },
  updates: Record<string, unknown>
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  if (updates["bidirectional"] !== undefined) {
    snapshot["bidirectional"] = relationship.bidirectional ?? false;
  }
  if (updates["strength"] !== undefined) {
    snapshot["strength"] = relationship.strength;
  }
  if (updates["notes"] !== undefined) {
    snapshot["notes"] = relationship.notes;
  }
  if (updates["metadata"] !== undefined) {
    snapshot["metadata"] = relationship.metadata;
  }
  return snapshot;
}

async function resolveRegistryForProject(
  ctx: any,
  projectId: Id<"projects">
): Promise<ProjectTypeRegistryResolved | null> {
  try {
    return (await ctx.runQuery(internalAny.projectTypeRegistry.getResolvedInternal, {
      projectId,
    })) as ProjectTypeRegistryResolved;
  } catch (error) {
    console.warn("[knowledgeSuggestions] Failed to resolve registry:", error);
    return null;
  }
}

async function preflightSuggestion(
  ctx: any,
  input: {
    projectId: Id<"projects">;
    toolName: string;
    toolArgs: Record<string, unknown>;
    existingPreflight?: SuggestionPreflight | null;
    registry: ProjectTypeRegistryResolved | null;
    mode: "baseline" | "check";
  }
): Promise<SuggestionPreflight> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let resolvedTargetId: string | undefined;
  let baseFingerprint: string | undefined;

  let toolName = input.toolName;
  let toolArgs = input.toolArgs;
  const registry = input.registry;

  if (toolName === "graph_mutation") {
    const normalized = normalizeGraphToolCall(toolName, toolArgs);
    if (!normalized) {
      return {
        status: "invalid",
        errors: ["Graph mutation is missing required fields or delete is not supported yet."],
        computedAt: Date.now(),
      };
    }
    toolName = normalized.toolName;
    toolArgs = normalized.args;
  }

  const requiresRegistry =
    toolName === "create_entity" ||
    toolName === "update_entity" ||
    toolName === "create_node" ||
    toolName === "update_node" ||
    toolName === "create_relationship" ||
    toolName === "update_relationship" ||
    toolName === "create_edge" ||
    toolName === "update_edge";

  if (requiresRegistry && !registry) {
    errors.push("Project type registry unavailable.");
  }

  switch (toolName) {
    case "write_content": {
      warnings.push("Document changes must be applied from the editor UI.");
      break;
    }
    case "commit_decision": {
      const decision = isNonEmptyString(toolArgs["decision"]) ? (toolArgs["decision"] as string) : "";
      if (!decision) {
        errors.push("Missing decision text.");
      }
      break;
    }
    case "create_entity": {
      const type = isNonEmptyString(toolArgs["type"]) ? (toolArgs["type"] as string) : "";
      const name = isNonEmptyString(toolArgs["name"]) ? (toolArgs["name"] as string) : "";
      if (!type) errors.push("Missing entity type.");
      if (!name) errors.push("Missing entity name.");
      if (registry && type) {
        const def = getEntityTypeDef(registry, type);
        if (!def) {
          errors.push(`Unknown entity type: ${type}`);
          break;
        }
        const properties: Record<string, unknown> = {};
        const nestedProperties = getRecord(toolArgs["properties"]);
        if (nestedProperties) {
          for (const [key, value] of Object.entries(nestedProperties)) {
            if (value === undefined) continue;
            properties[key] = value;
          }
        }
        for (const [key, value] of Object.entries(toolArgs)) {
          if (value === undefined) continue;
          if (key === "type" || key === "name" || key === "aliases" || key === "notes" || key === "properties") {
            continue;
          }
          properties[key] = value;
        }
        const validation = validateEntityProperties(def, properties);
        if (!validation.ok) {
          errors.push(validation.error.message);
        }
      }
      break;
    }
    case "create_node": {
      const type = isNonEmptyString(toolArgs["type"]) ? (toolArgs["type"] as string) : "";
      const name = isNonEmptyString(toolArgs["name"]) ? (toolArgs["name"] as string) : "";
      if (!type) errors.push("Missing node type.");
      if (!name) errors.push("Missing node name.");
      if (registry && type) {
        const def = getEntityTypeDef(registry, type);
        if (!def) {
          errors.push(`Unknown node type: ${type}`);
          break;
        }
        const properties = getRecord(toolArgs["properties"]) ?? {};
        const validation = validateEntityProperties(def, properties);
        if (!validation.ok) {
          errors.push(validation.error.message);
        }
      }
      break;
    }
    case "update_entity":
    case "update_node": {
      const updates = getRecord(toolArgs["updates"]);
      if (!updates) {
        errors.push("Missing updates for entity change.");
        break;
      }
      if (!hasUpdateValues(updates)) {
        errors.push("No update fields provided.");
        break;
      }

      const nameKey = toolName === "update_entity" ? "entityName" : "nodeName";
      const typeKey = toolName === "update_entity" ? "entityType" : "nodeType";
      const entityName = isNonEmptyString(toolArgs[nameKey]) ? (toolArgs[nameKey] as string) : "";
      const typeHint = isNonEmptyString(toolArgs[typeKey]) ? (toolArgs[typeKey] as string) : undefined;

      if (!entityName) {
        errors.push("Missing entity name.");
        break;
      }

      let entity: any = null;
      try {
        entity = await resolveEntityUnique(ctx, input.projectId, entityName, typeHint);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Entity resolution failed.");
        break;
      }
      if (!entity) {
        errors.push(`Entity "${entityName}" not found.`);
        break;
      }

      resolvedTargetId = entity._id as string | undefined;

      if (registry) {
        const resolvedType = typeHint ?? entity.type;
        const def = getEntityTypeDef(registry, resolvedType);
        if (!def) {
          errors.push(`Unknown entity type: ${resolvedType}`);
          break;
        }
        const propertyUpdates = extractEntityPropertyUpdates(updates);
        const nextProperties = {
          ...(entity.properties ?? {}),
          ...propertyUpdates,
        };
        const validation = validateEntityProperties(def, nextProperties);
        if (!validation.ok) {
          errors.push(validation.error.message);
        }
        const snapshot = buildEntityUpdateSnapshot(entity, updates, propertyUpdates);
        baseFingerprint = await hashFingerprint(snapshot);
      }
      break;
    }
    case "create_relationship":
    case "create_edge": {
      const type = isNonEmptyString(toolArgs["type"]) ? (toolArgs["type"] as string) : "";
      const sourceName = isNonEmptyString(toolArgs["sourceName"]) ? (toolArgs["sourceName"] as string) : "";
      const targetName = isNonEmptyString(toolArgs["targetName"]) ? (toolArgs["targetName"] as string) : "";
      if (!type) errors.push("Missing relationship type.");
      if (!sourceName) errors.push("Missing source name.");
      if (!targetName) errors.push("Missing target name.");
      if (registry && type) {
        const def = getRelationshipTypeDef(registry, type);
        if (!def) {
          errors.push(`Unknown relationship type: ${type}`);
          break;
        }
        try {
          const source = await resolveEntityUnique(ctx, input.projectId, sourceName);
          const target = await resolveEntityUnique(ctx, input.projectId, targetName);
          if (!source) errors.push(`Source entity "${sourceName}" not found.`);
          if (!target) errors.push(`Target entity "${targetName}" not found.`);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : "Entity resolution failed.");
        }
        const metadata = toolArgs["metadata"];
        const validation = validateRelationshipMetadata(def, metadata);
        if (!validation.ok) {
          errors.push(validation.error.message);
        }
      }
      break;
    }
    case "update_relationship":
    case "update_edge": {
      const updates = getRecord(toolArgs["updates"]);
      if (!updates) {
        errors.push("Missing updates for relationship change.");
        break;
      }
      if (!hasUpdateValues(updates)) {
        errors.push("No update fields provided.");
        break;
      }

      const type = isNonEmptyString(toolArgs["type"]) ? (toolArgs["type"] as string) : "";
      const sourceName = isNonEmptyString(toolArgs["sourceName"]) ? (toolArgs["sourceName"] as string) : "";
      const targetName = isNonEmptyString(toolArgs["targetName"]) ? (toolArgs["targetName"] as string) : "";
      if (!type) errors.push("Missing relationship type.");
      if (!sourceName) errors.push("Missing source name.");
      if (!targetName) errors.push("Missing target name.");
      if (errors.length > 0) break;

      let relationship: any = null;
      try {
        relationship = await resolveRelationshipByNames(ctx, input.projectId, sourceName, targetName, type);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Relationship resolution failed.");
        break;
      }

      if (!relationship) {
        errors.push(`Relationship ${sourceName} → ${type} → ${targetName} not found.`);
        break;
      }

      resolvedTargetId = relationship._id as string | undefined;

      if (registry) {
        const def = getRelationshipTypeDef(registry, type);
        if (!def) {
          errors.push(`Unknown relationship type: ${type}`);
          break;
        }
        const nextMetadata = updates["metadata"] ?? relationship.metadata;
        const validation = validateRelationshipMetadata(def, nextMetadata);
        if (!validation.ok) {
          errors.push(validation.error.message);
        }
        const snapshot = buildRelationshipUpdateSnapshot(relationship, updates);
        baseFingerprint = await hashFingerprint(snapshot);
      }
      break;
    }
    default:
      break;
  }

  const computedAt = Date.now();

  if (errors.length > 0) {
    return {
      status: "invalid",
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      resolvedTargetId,
      computedAt,
    };
  }

  if (baseFingerprint) {
    const existingFingerprint = input.existingPreflight?.baseFingerprint;
    if (input.mode === "check" && existingFingerprint && existingFingerprint !== baseFingerprint) {
      return {
        status: "conflict",
        errors: ["Target changed since proposal. Rebase required."],
        warnings: warnings.length > 0 ? warnings : undefined,
        resolvedTargetId,
        baseFingerprint,
        fingerprintAlgo: "sha256_stablejson_v1",
        computedAt,
      };
    }

    if (input.mode === "check" && !existingFingerprint) {
      warnings.push("Baseline fingerprint missing; stored current version for future checks.");
    }
  }

  return {
    status: "ok",
    errors: errors.length > 0 ? errors : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    resolvedTargetId,
    baseFingerprint,
    fingerprintAlgo: baseFingerprint ? "sha256_stablejson_v1" : undefined,
    computedAt,
  };
}

function mergePreflight(
  existing: SuggestionPreflight | null | undefined,
  next: SuggestionPreflight
): SuggestionPreflight {
  if (!existing?.baseFingerprint) return next;
  if (!next.baseFingerprint) {
    return { ...next, baseFingerprint: existing.baseFingerprint, fingerprintAlgo: existing.fingerprintAlgo };
  }
  return {
    ...next,
    baseFingerprint: existing.baseFingerprint,
    fingerprintAlgo: existing.fingerprintAlgo ?? next.fingerprintAlgo,
  };
}

export const getInternal = internalQuery({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
  },
  handler: async (ctx, { suggestionId }) => {
    return ctx.db.get(suggestionId);
  },
});

export const getByToolCallIdInternal = internalQuery({
  args: {
    toolCallId: v.string(),
  },
  handler: async (ctx, { toolCallId }) => {
    return ctx.db
      .query("knowledgeSuggestions")
      .withIndex("by_tool_call_id", (q) => q.eq("toolCallId", toolCallId))
      .unique();
  },
});

export const patchInternal = internalMutation({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
    patch: v.any(),
  },
  handler: async (ctx, { suggestionId, patch }) => {
    await ctx.db.patch(suggestionId, patch);
  },
});

export const upsertFromToolApprovalRequest = internalMutation({
  args: {
    projectId: v.id("projects"),
    toolCallId: v.string(),
    toolName: v.string(),
    approvalType: v.string(),
    danger: v.optional(v.string()),
    riskLevel: riskLevelSchema,
    approvalReasons: v.optional(v.array(v.string())),
    preview: v.optional(v.any()),
    operation: v.string(),
    targetType: targetTypeSchema,
    targetId: v.optional(v.string()),
    proposedPatch: v.any(),
    normalizedPatch: v.optional(v.any()),
    editorContext: v.optional(
      v.object({
        documentId: v.optional(v.string()),
        documentTitle: v.optional(v.string()),
        documentExcerpt: v.optional(v.string()),
        selectionText: v.optional(v.string()),
        selectionContext: v.optional(v.string()),
      })
    ),
    actorType: v.string(),
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    streamId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    promptMessageId: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("knowledgeSuggestions")
      .withIndex("by_tool_call_id", (q) => q.eq("toolCallId", args.toolCallId))
      .unique();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const { toolArgs, citations } = extractCitationsFromPatch(args.proposedPatch);
    const normalizedPatch =
      args.normalizedPatch ?? buildNormalizedPatch(args.toolName, toolArgs);
    const toolArgsRecord = getRecord(toolArgs) ?? {};
    const registry = await resolveRegistryForProject(ctx, args.projectId);
    const preflight = await preflightSuggestion(ctx, {
      projectId: args.projectId,
      toolName: args.toolName,
      toolArgs: toolArgsRecord,
      registry,
      mode: "baseline",
    });
    const resolvedTargetId = preflight.resolvedTargetId ?? args.targetId;
    const preflightError = preflight.status === "invalid" ? preflight.errors?.[0] : undefined;

    const suggestionId = await ctx.db.insert("knowledgeSuggestions", {
      projectId: args.projectId,
      targetType: args.targetType,
      targetId: resolvedTargetId,
      operation: args.operation,
      proposedPatch: toolArgs,
      normalizedPatch,
      editorContext: args.editorContext,
      status: "proposed",
      preflight,
      error: preflightError,
      actorType: args.actorType,
      actorUserId: args.actorUserId,
      actorAgentId: args.actorAgentId,
      actorName: args.actorName,
      toolName: args.toolName,
      toolCallId: args.toolCallId,
      approvalType: args.approvalType,
      danger: args.danger,
      riskLevel: args.riskLevel,
      approvalReasons: args.approvalReasons,
      preview: args.preview,
      streamId: args.streamId,
      threadId: args.threadId,
      promptMessageId: args.promptMessageId,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    });

    if (citations.length > 0) {
      try {
        await ctx.runMutation(internalAny.knowledgeCitations.createForSuggestion, {
          suggestionId,
          citations,
          phase: "proposal",
          actorType: args.actorType,
          actorUserId: args.actorUserId,
          actorAgentId: args.actorAgentId,
          actorName: args.actorName,
        });
      } catch (error) {
        console.warn("[knowledgeSuggestions] Failed to store citations:", error);
      }
    }

    return suggestionId;
  },
});

export const resolveFromToolResult = internalMutation({
  args: {
    toolCallId: v.string(),
    toolName: v.string(),
    resolvedByUserId: v.string(),
    result: v.any(),
  },
  handler: async (ctx, { toolCallId, toolName, resolvedByUserId, result }) => {
    const suggestion = await ctx.db
      .query("knowledgeSuggestions")
      .withIndex("by_tool_call_id", (q) => q.eq("toolCallId", toolCallId))
      .unique();

    if (!suggestion) return null;
    if (suggestion.status !== "proposed") {
      return suggestion._id;
    }

    const now = Date.now();
    const resultRecord =
      result && typeof result === "object" ? (result as Record<string, unknown>) : null;

    let status: "accepted" | "rejected" = "rejected";
    let error: string | undefined;
    let targetId: string | undefined;

    const envelope = parseToolResultEnvelope(resultRecord);

    if (toolName === "write_content") {
      if (envelope) {
        status = envelope.success ? "accepted" : "rejected";
        error = resolveEnvelopeError(envelope);
        targetId = pickArtifactTargetId(envelope.artifacts);
      } else {
        const applied = resultRecord?.["applied"];
        if (applied === true) {
          status = "accepted";
        } else if (applied === false) {
          status = "rejected";
          if (typeof resultRecord?.["error"] === "string") {
            error = resultRecord["error"] as string;
          } else {
            error = "User rejected";
          }
        } else {
          status = "rejected";
          error = "Invalid write_content result";
        }
      }
    } else if (envelope) {
      status = envelope.success ? "accepted" : "rejected";
      error = resolveEnvelopeError(envelope);
      targetId = pickArtifactTargetId(envelope.artifacts);
    } else {
      status = "rejected";
      error = "Invalid tool result envelope";
    }

    const rejectedByUser = isUserRejection(toolName, resultRecord, envelope);
    let resolution: "executed" | "user_rejected" | "execution_failed" | "applied_in_editor";
    if (status === "accepted") {
      resolution = toolName === "write_content" ? "applied_in_editor" : "executed";
    } else if (rejectedByUser) {
      resolution = "user_rejected";
    } else {
      resolution = "execution_failed";
    }

    const appliedFromEditor = envelope?.metadata?.["appliedFrom"] === "editor";

    await ctx.db.patch(suggestion._id, {
      status,
      resolution,
      targetId: targetId ?? suggestion.targetId,
      resolvedByUserId,
      resolvedAt: now,
      result,
      error,
      updatedAt: now,
    });

    if (!rejectedByUser && !appliedFromEditor) {
      const action = status === "accepted" ? "knowledge_pr.executed" : "knowledge_pr.execution_failed";
      const summary = status === "accepted" ? "Knowledge PR executed" : "Knowledge PR execution failed";
      try {
        await ctx.runMutation(internalAny.activity.emit, {
          projectId: suggestion.projectId,
          actorType: "user",
          actorUserId: resolvedByUserId,
          action,
          summary,
          suggestionId: suggestion._id,
          toolCallId: suggestion.toolCallId,
          metadata: {
            suggestionId: suggestion._id,
            toolName: suggestion.toolName,
            toolCallId: suggestion.toolCallId,
            status,
            error,
          },
        });
      } catch (emitError) {
        console.warn("[knowledgeSuggestions] Failed to emit execution activity:", emitError);
      }
    }

    return suggestion._id;
  },
});

/**
 * Re-run preflight check for a suggestion without applying.
 * This updates the preflight status, errors, warnings, and target fingerprint.
 */
export const rerunPreflight = mutation({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
  },
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    await verifyProjectAccess(ctx, suggestion.projectId);

    if (suggestion.status !== "proposed") {
      throw new Error("Cannot re-run preflight on non-proposed suggestion");
    }

    const registry = await resolveRegistryForProject(ctx, suggestion.projectId);
    const toolArgsRecord = getRecord(suggestion.proposedPatch) ?? {};
    const existingPreflight = suggestion.preflight as SuggestionPreflight | null | undefined;

    const preflight = await preflightSuggestion(ctx, {
      projectId: suggestion.projectId,
      toolName: suggestion.toolName,
      toolArgs: toolArgsRecord,
      existingPreflight,
      registry,
      mode: "check",
    });

    const mergedPreflight = mergePreflight(existingPreflight, preflight);
    const preflightError =
      mergedPreflight.status === "conflict"
        ? "Target changed since proposal. Rebase required."
        : mergedPreflight.errors?.[0];

    await ctx.db.patch(suggestionId, {
      preflight: mergedPreflight,
      error: preflightError,
      targetId: mergedPreflight.resolvedTargetId ?? suggestion.targetId,
      updatedAt: Date.now(),
    });

    return {
      status: mergedPreflight.status,
      errors: mergedPreflight.errors,
      warnings: mergedPreflight.warnings,
    };
  },
});

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(statusSchema),
    targetType: v.optional(targetTypeSchema),
    riskLevel: riskLevelSchema,
    toolName: v.optional(v.string()),
    includeRolledBack: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, status, targetType, riskLevel, toolName, includeRolledBack, limit = 50, cursor }) => {
    await verifyProjectAccess(ctx, projectId);

    let results: Doc<"knowledgeSuggestions">[];

    if (status && targetType) {
      results = await ctx.db
        .query("knowledgeSuggestions")
        .withIndex("by_project_status_targetType_createdAt", (q) =>
          cursor
            ? q
                .eq("projectId", projectId)
                .eq("status", status)
                .eq("targetType", targetType)
                .lt("createdAt", cursor)
            : q.eq("projectId", projectId).eq("status", status).eq("targetType", targetType)
        )
        .order("desc")
        .take(limit);
    } else if (status) {
      results = await ctx.db
        .query("knowledgeSuggestions")
        .withIndex("by_project_status_createdAt", (q) =>
          cursor
            ? q.eq("projectId", projectId).eq("status", status).lt("createdAt", cursor)
            : q.eq("projectId", projectId).eq("status", status)
        )
        .order("desc")
        .take(limit);
    } else if (targetType) {
      results = await ctx.db
        .query("knowledgeSuggestions")
        .withIndex("by_project_targetType_createdAt", (q) =>
          cursor
            ? q.eq("projectId", projectId).eq("targetType", targetType).lt("createdAt", cursor)
            : q.eq("projectId", projectId).eq("targetType", targetType)
        )
        .order("desc")
        .take(limit);
    } else {
      results = await ctx.db
        .query("knowledgeSuggestions")
        .withIndex("by_project_createdAt", (q) =>
          cursor ? q.eq("projectId", projectId).lt("createdAt", cursor) : q.eq("projectId", projectId)
        )
        .order("desc")
        .take(limit);
    }

    if (riskLevel) {
      results = results.filter((item) => item.riskLevel === riskLevel);
    }
    if (toolName) {
      results = results.filter((item) => item.toolName === toolName);
    }
    if (includeRolledBack === false) {
      results = results.filter((item) => item.resolution !== "rolled_back");
    }

    return results;
  },
});

function requireAuthenticatedUserId(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }
): Promise<string> {
  return ctx.auth.getUserIdentity().then((identity) => {
    if (!identity?.subject) {
      throw new Error("Unauthenticated");
    }
    return identity.subject;
  });
}

async function requireProjectRole(
  ctx: any,
  projectId: Id<"projects">,
  userId: string
): Promise<ProjectRole> {
  const access = await ctx.runQuery(internalAny["ai/tools/projectGraphHandlers"].getProjectMemberRole, {
    projectId,
    userId,
  });

  if (!access?.projectExists) {
    throw new Error("Project not found");
  }

  if (!access?.role) {
    throw new Error("Access denied");
  }

  return access.role as ProjectRole;
}

function assertReviewerAccess(role: ProjectRole, riskLevel: string | undefined): void {
  if (role === "viewer") {
    throw new Error("Edit access denied");
  }
  if (riskLevel === "core" && role !== "owner") {
    throw new Error("Owner approval required for core-risk changes");
  }
}

function resolveSuggestionRiskLevelForAccess(suggestion: Record<string, unknown>): string | undefined {
  if (typeof suggestion["riskLevel"] === "string") {
    return suggestion["riskLevel"] as string;
  }
  if (suggestion["toolName"] === "commit_decision") {
    return "core";
  }
  return undefined;
}

function buildRejectionResult(toolName: string): ToolResultEnvelope {
  if (toolName === "write_content") {
    return { success: false, error: { message: "User rejected", code: "rejected" } };
  }
  return { success: false, error: { message: "User rejected", code: "rejected" } };
}

function buildErrorEnvelope(message: string): ToolResultEnvelope {
  return { success: false, error: { message } };
}

function buildSuccessEnvelope(
  artifact: ToolResultArtifact | undefined,
  rollback?: Record<string, unknown>
): ToolResultEnvelope {
  const envelope: ToolResultEnvelope = { success: true };
  if (artifact) {
    envelope.artifacts = [artifact];
  }
  if (rollback) {
    envelope.rollback = rollback;
  }
  return envelope;
}

async function resolveEntityUnique(ctx: any, projectId: Id<"projects">, name: string, type?: string): Promise<any> {
  const matches = (await ctx.runQuery(internalAny["ai/tools/projectGraphHandlers"].findEntityByCanonical, {
    projectId,
    name,
    type,
  })) as any[] | null;

  if (!matches || matches.length === 0) return null;
  if (matches.length > 1) {
    const types = Array.from(new Set(matches.map((m) => m.type))).join(", ");
    throw new Error(`Multiple entities named "${name}" found (${types})`);
  }
  return matches[0];
}

async function resolveRelationshipByNames(
  ctx: any,
  projectId: Id<"projects">,
  sourceName: string,
  targetName: string,
  type: string
): Promise<any | null> {
  const source = await resolveEntityUnique(ctx, projectId, sourceName);
  if (!source) return null;
  const target = await resolveEntityUnique(ctx, projectId, targetName);
  if (!target) return null;

  return ctx.runQuery(internalAny["ai/tools/projectGraphHandlers"].findRelationship, {
    projectId,
    sourceId: source._id,
    targetId: target._id,
    type,
  });
}

async function applySuggestionApprove(
  ctx: any,
  suggestion: any,
  userId: string
): Promise<ToolResultEnvelope> {
  const projectId = suggestion.projectId as Id<"projects">;
  const actor = {
    actorType: "user",
    actorUserId: userId,
    actorAgentId: undefined,
    actorName: undefined,
  };
  const source = {
    streamId: suggestion.streamId,
    threadId: suggestion.threadId,
    toolCallId: suggestion.toolCallId,
    promptMessageId: suggestion.promptMessageId,
  };

  let toolName = suggestion.toolName as string;
  let toolArgs = suggestion.proposedPatch as Record<string, unknown>;

  if (toolName === "graph_mutation") {
    const normalized = normalizeGraphToolCall(toolName, toolArgs);
    if (!normalized) {
      return buildErrorEnvelope("Graph mutation is missing required fields or delete is not supported yet.");
    }
    toolName = normalized.toolName;
    toolArgs = normalized.args;
  }

  switch (toolName) {
    case "create_entity": {
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeCreateEntity, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to create entity");
      }
      const entityId = typeof result.entityId === "string" ? result.entityId : undefined;
      if (!entityId) {
        return buildErrorEnvelope("Missing entityId for create_entity");
      }
      return buildSuccessEnvelope(
        { kind: "entity", id: entityId },
        { kind: "entity.create", entityId }
      );
    }
    case "update_entity": {
      const targetId =
        typeof suggestion.targetId === "string" ? (suggestion.targetId as string) : undefined;
      let before = targetId ? await ctx.db.get(targetId) : null;
      if (!before) {
        before = await resolveEntityUnique(
          ctx,
          projectId,
          String(toolArgs["entityName"] ?? ""),
          toolArgs["entityType"] as string | undefined
        );
      }
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeUpdateEntity, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to update entity");
      }
      const entityId = typeof result.entityId === "string" ? result.entityId : undefined;
      if (!entityId) {
        return buildErrorEnvelope("Missing entityId for update_entity");
      }
      const after = await ctx.db.get(entityId);
      return buildSuccessEnvelope(
        { kind: "entity", id: entityId },
        {
          kind: "entity.update",
          entityId,
          before: before
            ? {
                name: before.name,
                aliases: before.aliases,
                notes: before.notes,
                properties: before.properties,
              }
            : null,
          after: after
            ? {
                name: after.name,
                aliases: after.aliases,
                notes: after.notes,
                properties: after.properties,
              }
            : null,
        }
      );
    }
    case "create_node": {
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeCreateNode, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to create node");
      }
      const entityId = typeof result.entityId === "string" ? result.entityId : undefined;
      if (!entityId) {
        return buildErrorEnvelope("Missing entityId for create_node");
      }
      return buildSuccessEnvelope(
        { kind: "entity", id: entityId },
        { kind: "entity.create", entityId }
      );
    }
    case "update_node": {
      const targetId =
        typeof suggestion.targetId === "string" ? (suggestion.targetId as string) : undefined;
      let before = targetId ? await ctx.db.get(targetId) : null;
      if (!before) {
        before = await resolveEntityUnique(
          ctx,
          projectId,
          String(toolArgs["nodeName"] ?? ""),
          toolArgs["nodeType"] as string | undefined
        );
      }
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeUpdateNode, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to update node");
      }
      const entityId = typeof result.entityId === "string" ? result.entityId : undefined;
      if (!entityId) {
        return buildErrorEnvelope("Missing entityId for update_node");
      }
      const after = await ctx.db.get(entityId);
      return buildSuccessEnvelope(
        { kind: "entity", id: entityId },
        {
          kind: "entity.update",
          entityId,
          before: before
            ? {
                name: before.name,
                aliases: before.aliases,
                notes: before.notes,
                properties: before.properties,
              }
            : null,
          after: after
            ? {
                name: after.name,
                aliases: after.aliases,
                notes: after.notes,
                properties: after.properties,
              }
            : null,
        }
      );
    }
    case "create_relationship": {
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeCreateRelationship, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to create relationship");
      }
      const relationshipId = typeof result.relationshipId === "string" ? result.relationshipId : undefined;
      if (!relationshipId) {
        return buildErrorEnvelope("Missing relationshipId for create_relationship");
      }
      return buildSuccessEnvelope(
        { kind: "relationship", id: relationshipId },
        { kind: "relationship.create", relationshipId }
      );
    }
    case "update_relationship": {
      const targetId =
        typeof suggestion.targetId === "string" ? (suggestion.targetId as string) : undefined;
      let beforeRel = targetId ? await ctx.db.get(targetId) : null;
      if (!beforeRel) {
        beforeRel = await resolveRelationshipByNames(
          ctx,
          projectId,
          String(toolArgs["sourceName"] ?? ""),
          String(toolArgs["targetName"] ?? ""),
          String(toolArgs["type"] ?? "")
        );
      }
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeUpdateRelationship, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to update relationship");
      }
      const relationshipId = typeof result.relationshipId === "string" ? result.relationshipId : undefined;
      if (!relationshipId) {
        return buildErrorEnvelope("Missing relationshipId for update_relationship");
      }
      const afterRel = await ctx.db.get(relationshipId);
      return buildSuccessEnvelope(
        { kind: "relationship", id: relationshipId },
        {
          kind: "relationship.update",
          relationshipId,
          before: beforeRel
            ? {
                bidirectional: beforeRel.bidirectional ?? false,
                strength: beforeRel.strength,
                notes: beforeRel.notes,
                metadata: beforeRel.metadata,
              }
            : null,
          after: afterRel
            ? {
                bidirectional: afterRel.bidirectional ?? false,
                strength: afterRel.strength,
                notes: afterRel.notes,
                metadata: afterRel.metadata,
              }
            : null,
        }
      );
    }
    case "create_edge": {
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeCreateEdge, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to create edge");
      }
      const relationshipId = typeof result.relationshipId === "string" ? result.relationshipId : undefined;
      if (!relationshipId) {
        return buildErrorEnvelope("Missing relationshipId for create_edge");
      }
      return buildSuccessEnvelope(
        { kind: "relationship", id: relationshipId },
        { kind: "relationship.create", relationshipId }
      );
    }
    case "update_edge": {
      const targetId =
        typeof suggestion.targetId === "string" ? (suggestion.targetId as string) : undefined;
      let beforeRel = targetId ? await ctx.db.get(targetId) : null;
      if (!beforeRel) {
        beforeRel = await resolveRelationshipByNames(
          ctx,
          projectId,
          String(toolArgs["sourceName"] ?? ""),
          String(toolArgs["targetName"] ?? ""),
          String(toolArgs["type"] ?? "")
        );
      }
      const result = await ctx.runAction(internalAny["ai/tools/projectGraphHandlers"].executeUpdateEdge, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return buildErrorEnvelope(result?.message ?? "Failed to update edge");
      }
      const relationshipId = typeof result.relationshipId === "string" ? result.relationshipId : undefined;
      if (!relationshipId) {
        return buildErrorEnvelope("Missing relationshipId for update_edge");
      }
      const afterRel = await ctx.db.get(relationshipId);
      return buildSuccessEnvelope(
        { kind: "relationship", id: relationshipId },
        {
          kind: "relationship.update",
          relationshipId,
          before: beforeRel
            ? {
                bidirectional: beforeRel.bidirectional ?? false,
                strength: beforeRel.strength,
                notes: beforeRel.notes,
                metadata: beforeRel.metadata,
              }
            : null,
          after: afterRel
            ? {
                bidirectional: afterRel.bidirectional ?? false,
                strength: afterRel.strength,
                notes: afterRel.notes,
                metadata: afterRel.metadata,
              }
            : null,
        }
      );
    }
    case "commit_decision": {
      const result = await ctx.runAction(internalAny["ai/tools"].execute, {
        toolName: "commit_decision",
        input: toolArgs,
        projectId: projectId as string,
        userId,
        source: {
          suggestionId: suggestion._id,
          toolCallId: suggestion.toolCallId,
          streamId: suggestion.streamId,
          threadId: suggestion.threadId,
          promptMessageId: suggestion.promptMessageId,
          model: suggestion.model,
        },
      });

      if (!result || typeof result !== "object") {
        return buildErrorEnvelope("Failed to store memory");
      }

      const record = result as Record<string, unknown>;
      const memoryId = typeof record["memoryId"] === "string" ? (record["memoryId"] as string) : undefined;
      if (!memoryId) {
        return buildErrorEnvelope("Failed to store memory");
      }

      return buildSuccessEnvelope(
        { kind: "memory", id: memoryId },
        { kind: "memory.commit_decision", memoryId }
      );
    }
    case "write_content":
      return buildErrorEnvelope("Apply document changes from the editor UI.");
    case "add_comment": {
      const documentId = typeof toolArgs["documentId"] === "string" ? toolArgs["documentId"] : undefined;
      const content = typeof toolArgs["content"] === "string" ? toolArgs["content"] : "";
      const selectionRange = toolArgs["selectionRange"] as { from: number; to: number } | undefined;

      if (!documentId) {
        return buildErrorEnvelope("Missing documentId for add_comment");
      }
      if (!content) {
        return buildErrorEnvelope("Missing comment content");
      }

      try {
        const result = await ctx.runMutation(apiAny.comments.add, {
          projectId,
          documentId: documentId as Id<"documents">,
          content,
          selectionRange,
        });
        const commentId = typeof result?.commentId === "string" ? result.commentId : undefined;
        return buildSuccessEnvelope(
          commentId ? { kind: "document", id: documentId } : undefined,
          { kind: "comment.add", commentId, documentId }
        );
      } catch (error) {
        return buildErrorEnvelope(error instanceof Error ? error.message : "Failed to add comment");
      }
    }
    case "delete_document": {
      const documentId = typeof toolArgs["documentId"] === "string" ? toolArgs["documentId"] : undefined;
      const reason = typeof toolArgs["reason"] === "string" ? toolArgs["reason"] : undefined;

      if (!documentId) {
        return buildErrorEnvelope("Missing documentId for delete_document");
      }

      try {
        await ctx.runMutation(apiAny.documents.deleteDocument, {
          id: documentId as Id<"documents">,
          reason,
        });
        return buildSuccessEnvelope(
          { kind: "document", id: documentId },
          { kind: "document.delete", documentId }
        );
      } catch (error) {
        return buildErrorEnvelope(error instanceof Error ? error.message : "Failed to delete document");
      }
    }
    default:
      return buildErrorEnvelope(`Unsupported tool for review: ${toolName}`);
  }
}

export const applyDecisions = action({
  args: {
    suggestionIds: v.array(v.id("knowledgeSuggestions")),
    decision: v.union(v.literal("approve"), v.literal("reject")),
  },
  handler: async (ctx, { suggestionIds, decision }) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const registryCache = new Map<string, ProjectTypeRegistryResolved | null>();

    async function getRegistry(
      projectId: Id<"projects">
    ): Promise<ProjectTypeRegistryResolved | null> {
      if (registryCache.has(projectId)) {
        return registryCache.get(projectId) ?? null;
      }
      const registry = await resolveRegistryForProject(ctx, projectId);
      registryCache.set(projectId, registry);
      return registry;
    }

    const results: Array<{ suggestionId: string; status: string; error?: string; skipped?: boolean }> = [];

    for (const suggestionId of suggestionIds) {
      const suggestion = await ctx.runQuery(internalAny.knowledgeSuggestions.getInternal, { suggestionId });
      if (!suggestion) {
        results.push({ suggestionId, status: "error", error: "Suggestion not found" });
        continue;
      }

      try {
        const role = await requireProjectRole(ctx, suggestion.projectId as Id<"projects">, userId);
        const riskLevel = resolveSuggestionRiskLevelForAccess(suggestion as Record<string, unknown>);
        assertReviewerAccess(role, riskLevel);
      } catch (error) {
        results.push({
          suggestionId,
          status: "error",
          error: error instanceof Error ? error.message : "Access denied",
        });
        continue;
      }

      if (suggestion.status !== "proposed") {
        results.push({ suggestionId, status: suggestion.status, skipped: true });
        continue;
      }

      if (decision === "reject") {
        const resultPayload = buildRejectionResult(String(suggestion.toolName));
        await ctx.runMutation(internalAny.knowledgeSuggestions.resolveFromToolResult, {
          toolCallId: suggestion.toolCallId,
          toolName: suggestion.toolName,
          resolvedByUserId: userId,
          result: resultPayload,
        });
        try {
          await ctx.runMutation(internalAny.activity.emit, {
            projectId: suggestion.projectId,
            actorType: "user",
            actorUserId: userId,
            action: "knowledge_pr.rejected",
            summary: "Knowledge PR rejected",
            suggestionId: suggestion._id,
            toolCallId: suggestion.toolCallId,
            metadata: {
              suggestionId: suggestion._id,
              toolName: suggestion.toolName,
              toolCallId: suggestion.toolCallId,
            },
          });
        } catch (emitError) {
          console.warn("[knowledgeSuggestions] Failed to emit rejection activity:", emitError);
        }
        results.push({ suggestionId, status: "rejected" });
        continue;
      }

      const toolName = String(suggestion.toolName);
      if (toolName === "write_content") {
        const message = "Apply document changes from the editor UI.";
        await ctx.runMutation(internalAny.knowledgeSuggestions.patchInternal, {
          suggestionId: suggestion._id,
          patch: { error: message, updatedAt: Date.now() },
        });
        results.push({
          suggestionId,
          status: "error",
          error: message,
        });
        continue;
      }

      const registry = await getRegistry(suggestion.projectId as Id<"projects">);
      const toolArgsRecord = getRecord(suggestion.proposedPatch) ?? {};
      const existingPreflight = suggestion.preflight as SuggestionPreflight | null | undefined;
      const preflight = await preflightSuggestion(ctx, {
        projectId: suggestion.projectId as Id<"projects">,
        toolName,
        toolArgs: toolArgsRecord,
        existingPreflight,
        registry,
        mode: "check",
      });
      const mergedPreflight = mergePreflight(existingPreflight, preflight);
      const preflightError =
        mergedPreflight.status === "conflict"
          ? "Target changed since proposal. Rebase required."
          : mergedPreflight.errors?.[0];

      if (mergedPreflight.status !== "ok") {
        await ctx.runMutation(internalAny.knowledgeSuggestions.patchInternal, {
          suggestionId: suggestion._id,
          patch: {
            preflight: mergedPreflight,
            error: preflightError,
            targetId: mergedPreflight.resolvedTargetId ?? suggestion.targetId,
            updatedAt: Date.now(),
          },
        });
        results.push({
          suggestionId,
          status: "error",
          error: preflightError ?? "Preflight failed",
        });
        continue;
      }

      await ctx.runMutation(internalAny.knowledgeSuggestions.patchInternal, {
        suggestionId: suggestion._id,
        patch: {
          preflight: mergedPreflight,
          targetId: mergedPreflight.resolvedTargetId ?? suggestion.targetId,
          updatedAt: Date.now(),
        },
      });

      try {
        await ctx.runMutation(internalAny.activity.emit, {
          projectId: suggestion.projectId,
          actorType: "user",
          actorUserId: userId,
          action: "knowledge_pr.approved",
          summary: "Knowledge PR approved",
          suggestionId: suggestion._id,
          toolCallId: suggestion.toolCallId,
          metadata: {
            suggestionId: suggestion._id,
            toolName: suggestion.toolName,
            toolCallId: suggestion.toolCallId,
          },
        });
      } catch (emitError) {
        console.warn("[knowledgeSuggestions] Failed to emit approval activity:", emitError);
      }

      let suggestionForApply = suggestion;
      if (
        mergedPreflight.resolvedTargetId &&
        mergedPreflight.resolvedTargetId !== suggestion.targetId
      ) {
        suggestionForApply = {
          ...suggestion,
          targetId: mergedPreflight.resolvedTargetId,
        };
      }

      const approvedResult = await applySuggestionApprove(ctx, suggestionForApply, userId);
      await ctx.runMutation(internalAny.knowledgeSuggestions.resolveFromToolResult, {
        toolCallId: suggestion.toolCallId,
        toolName: suggestion.toolName,
        resolvedByUserId: userId,
        result: approvedResult,
      });

      const success = approvedResult.success === true;
      const errorMessage = success ? undefined : resolveEnvelopeError(approvedResult);
      results.push({
        suggestionId,
        status: success ? "accepted" : "rejected",
        error: success ? undefined : errorMessage ?? "Failed to apply",
      });
    }

    return { results };
  },
});

export const resolveWriteContentFromEditor = action({
  args: {
    suggestionId: v.optional(v.id("knowledgeSuggestions")),
    toolCallId: v.optional(v.string()),
    applied: v.boolean(),
    revisionId: v.optional(v.id("documentRevisions")),
    documentId: v.optional(v.id("documents")),
    snapshotJson: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { suggestionId, toolCallId, applied, revisionId, documentId, snapshotJson, reason }
  ) => {
    const userId = await requireAuthenticatedUserId(ctx);
    let suggestion = null;

    if (suggestionId) {
      suggestion = await ctx.runQuery(internalAny.knowledgeSuggestions.getInternal, { suggestionId });
    } else if (toolCallId) {
      suggestion = await ctx.runQuery(internalAny.knowledgeSuggestions.getByToolCallIdInternal, { toolCallId });
    } else {
      throw new Error("Missing suggestion identifier");
    }

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }
    if (suggestion.toolName !== "write_content") {
      throw new Error("Not a document suggestion");
    }
    if (suggestion.status !== "proposed") {
      return { success: true, skipped: true };
    }

    const resolvedDocumentId =
      documentId ??
      (typeof suggestion.targetId === "string" ? suggestion.targetId : undefined) ??
      suggestion.editorContext?.documentId;
    let resolvedRevisionId = revisionId;

    if (applied && !resolvedRevisionId && snapshotJson && resolvedDocumentId) {
      try {
        resolvedRevisionId = await ctx.runMutation(internalAny.revisions.createRevisionInternal, {
          projectId: suggestion.projectId,
          documentId: resolvedDocumentId,
          snapshotJson,
          reason: "knowledge_pr",
          actorType: "user",
          actorUserId: userId,
          toolName: "write_content",
          summary: reason ?? "Applied write_content suggestion",
          sourceSuggestionId: suggestion._id,
          sourceStreamId: suggestion.streamId,
          metadata: {
            toolCallId: suggestion.toolCallId,
            appliedFrom: "editor",
          },
        });
      } catch (error) {
        console.warn("[knowledgeSuggestions] Failed to create revision for write_content:", error);
      }
    }

    const artifact: ToolResultArtifact | undefined = resolvedDocumentId
      ? { kind: "document" as const, id: resolvedDocumentId }
      : undefined;
    const envelope = applied ? buildSuccessEnvelope(artifact) : buildRejectionResult("write_content");
    const resultPayload = {
      ...envelope,
      metadata: {
        revisionId: resolvedRevisionId,
        documentId: resolvedDocumentId,
        reason,
        appliedFrom: "editor",
      },
    };

    await ctx.runMutation(internalAny.knowledgeSuggestions.resolveFromToolResult, {
      toolCallId: suggestion.toolCallId,
      toolName: suggestion.toolName,
      resolvedByUserId: userId,
      result: resultPayload,
    });

    const action = applied ? "knowledge_pr.document_applied" : "knowledge_pr.document_rejected_from_inbox";
    const summary = applied ? "Document change applied in editor" : "Document change rejected";

    try {
      await ctx.runMutation(internalAny.activity.emit, {
        projectId: suggestion.projectId,
        actorType: "user",
        actorUserId: userId,
        action,
        summary,
        suggestionId: suggestion._id,
        toolCallId: suggestion.toolCallId,
        metadata: {
          suggestionId: suggestion._id,
          toolName: suggestion.toolName,
          toolCallId: suggestion.toolCallId,
          documentId: resolvedDocumentId,
          revisionId: resolvedRevisionId,
          reason,
        },
      });
    } catch (emitError) {
      console.warn("[knowledgeSuggestions] Failed to emit write_content activity:", emitError);
    }

    return { success: true, revisionId: resolvedRevisionId };
  },
});

export const markRolledBackInternal = internalMutation({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
    rolledBackByUserId: v.string(),
    result: v.any(),
  },
  handler: async (ctx, { suggestionId, rolledBackByUserId, result }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) return null;

    const now = Date.now();
    await ctx.db.patch(suggestionId, {
      status: "resolved",
      resolution: "rolled_back",
      rolledBackAt: now,
      rolledBackByUserId,
      resolvedByUserId: rolledBackByUserId,
      resolvedAt: now,
      result,
      updatedAt: now,
    });

    return suggestionId;
  },
});

/**
 * Check what will be affected by rolling back a suggestion.
 * Returns impact data for the UI to show in a confirmation modal.
 */
export const getRollbackImpact = query({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
  },
  handler: async (ctx, { suggestionId }) => {
    const suggestion = await ctx.db.get(suggestionId);
    if (!suggestion) {
      return { canRollback: false, error: "Suggestion not found" };
    }

    await verifyProjectAccess(ctx, suggestion.projectId);

    const resultRecord =
      suggestion.result && typeof suggestion.result === "object"
        ? (suggestion.result as Record<string, unknown>)
        : null;

    const existingRolledBackAt =
      typeof suggestion.rolledBackAt === "number"
        ? suggestion.rolledBackAt
        : typeof resultRecord?.["rolledBackAt"] === "number"
          ? (resultRecord["rolledBackAt"] as number)
          : undefined;

    if (existingRolledBackAt) {
      return { canRollback: false, error: "Already rolled back", alreadyRolledBack: true };
    }

    const rollback =
      resultRecord && typeof resultRecord["rollback"] === "object"
        ? (resultRecord["rollback"] as Record<string, unknown>)
        : null;

    if (!rollback || typeof rollback["kind"] !== "string") {
      return { canRollback: false, error: "No rollback data available" };
    }

    const kind = rollback["kind"] as string;
    const impact: {
      kind: string;
      entityName?: string;
      relationshipCount?: number;
      relationships?: Array<{ id: string; sourceEntity?: string; targetEntity?: string; type: string }>;
      warning?: string;
    } = { kind };

    if (kind === "entity.create") {
      const entityId = String(rollback["entityId"] ?? "");
      if (!entityId) {
        return { canRollback: false, error: "Missing entity ID" };
      }

      // Check for relationships that will be orphaned
      const entity = await ctx.db.get(entityId as Id<"entities">);
      impact.entityName = entity?.name ?? "Unknown entity";

      const relationships = await ctx.db
        .query("relationships")
        .filter((q) =>
          q.or(
            q.eq(q.field("sourceId"), entityId),
            q.eq(q.field("targetId"), entityId)
          )
        )
        .take(10);

      if (relationships.length > 0) {
        impact.relationshipCount = relationships.length;
        impact.relationships = await Promise.all(
          relationships.slice(0, 5).map(async (r) => {
            const source = await ctx.db.get(r.sourceId as Id<"entities">);
            const target = await ctx.db.get(r.targetId as Id<"entities">);
            return {
              id: r._id,
              sourceEntity: source?.name,
              targetEntity: target?.name,
              type: r.type,
            };
          })
        );
        impact.warning = `This will also delete ${relationships.length} relationship(s) connected to this entity.`;
      }
    } else if (kind === "relationship.create") {
      const relationshipId = String(rollback["relationshipId"] ?? "");
      if (!relationshipId) {
        return { canRollback: false, error: "Missing relationship ID" };
      }
      const relationship = await ctx.db.get(relationshipId as Id<"relationships">);
      if (relationship) {
        const source = await ctx.db.get(relationship.sourceId as Id<"entities">);
        const target = await ctx.db.get(relationship.targetId as Id<"entities">);
        impact.relationships = [{
          id: relationshipId,
          sourceEntity: source?.name,
          targetEntity: target?.name,
          type: relationship.type,
        }];
      }
    }

    return {
      canRollback: true,
      impact,
    };
  },
});

export const rollbackSuggestion = action({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
    /** If true, cascade delete relationships when rolling back entity.create */
    cascadeRelationships: v.optional(v.boolean()),
  },
  handler: async (ctx, { suggestionId, cascadeRelationships }) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const suggestion = await ctx.runQuery(internalAny.knowledgeSuggestions.getInternal, { suggestionId });
    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    const role = await requireProjectRole(ctx, suggestion.projectId as Id<"projects">, userId);
    const riskLevel = resolveSuggestionRiskLevelForAccess(suggestion as Record<string, unknown>);
    assertReviewerAccess(role, riskLevel);

    const resultRecord =
      suggestion.result && typeof suggestion.result === "object"
        ? (suggestion.result as Record<string, unknown>)
        : null;
    let existingRolledBackAt: number | undefined;
    if (typeof suggestion.rolledBackAt === "number") {
      existingRolledBackAt = suggestion.rolledBackAt;
    } else if (typeof resultRecord?.["rolledBackAt"] === "number") {
      existingRolledBackAt = resultRecord["rolledBackAt"] as number;
    }
    if (existingRolledBackAt) {
      return { success: true, alreadyRolledBack: true };
    }

    const rollback =
      resultRecord && typeof resultRecord["rollback"] === "object"
        ? (resultRecord["rollback"] as Record<string, unknown>)
        : null;
    if (!rollback || typeof rollback["kind"] !== "string") {
      throw new Error("No rollback data available for this change");
    }

    const kind = rollback["kind"] as string;
    let deletedRelationships: string[] = [];

    try {
      if (kind === "entity.create") {
        const entityId = String(rollback["entityId"] ?? "");
        if (!entityId) throw new Error("Missing entityId for rollback");

        // Check for relationships before deleting
        const relationships = await ctx.runQuery(apiAny.relationships.listByEntity, { entityId });
        if (relationships && relationships.length > 0) {
          if (!cascadeRelationships) {
            throw new Error(
              `Cannot rollback: Entity has ${relationships.length} relationship(s). ` +
              `Use cascadeRelationships=true to delete them along with the entity.`
            );
          }
          // Delete relationships first
          for (const rel of relationships) {
            await ctx.runMutation(apiAny.relationships.remove, { id: rel._id });
            deletedRelationships.push(rel._id);
          }
        }
        await ctx.runMutation(apiAny.entities.remove, { id: entityId });
      } else if (kind === "entity.update") {
        const entityId = String(rollback["entityId"] ?? "");
        const before = rollback["before"] as Record<string, unknown> | null | undefined;
        if (!entityId || !before) {
          throw new Error("Missing entity rollback data");
        }
        await ctx.runMutation(apiAny.entities.update, {
          id: entityId,
          name: before["name"],
          aliases: before["aliases"],
          notes: before["notes"],
          properties: before["properties"],
        });
      } else if (kind === "relationship.create") {
        const relationshipId = String(rollback["relationshipId"] ?? "");
        if (!relationshipId) throw new Error("Missing relationshipId for rollback");
        await ctx.runMutation(apiAny.relationships.remove, { id: relationshipId });
      } else if (kind === "relationship.update") {
        const relationshipId = String(rollback["relationshipId"] ?? "");
        const before = rollback["before"] as Record<string, unknown> | null | undefined;
        if (!relationshipId || !before) {
          throw new Error("Missing relationship rollback data");
        }
        await ctx.runMutation(apiAny.relationships.update, {
          id: relationshipId,
          bidirectional: before["bidirectional"],
          strength: before["strength"],
          notes: before["notes"],
          metadata: before["metadata"],
        });
      } else if (kind === "memory.commit_decision") {
        const memoryId = String(rollback["memoryId"] ?? "");
        if (!memoryId) throw new Error("Missing memoryId for rollback");
        await ctx.runMutation(apiAny.memories.remove, { id: memoryId });
        if (isQdrantConfigured()) {
          await deletePointsForWrite([memoryId], "text");
        }
      } else {
        throw new Error(`Rollback not supported for: ${kind}`);
      }
    } catch (error) {
      try {
        await ctx.runMutation(internalAny.activity.emit, {
          projectId: suggestion.projectId,
          actorType: "user",
          actorUserId: userId,
          action: "knowledge_pr.rollback_failed",
          summary: "Knowledge PR rollback failed",
          suggestionId: suggestion._id,
          toolCallId: suggestion.toolCallId,
          metadata: {
            suggestionId: suggestion._id,
            toolName: suggestion.toolName,
            toolCallId: suggestion.toolCallId,
            error: error instanceof Error ? error.message : "Rollback failed",
          },
        });
      } catch (emitError) {
        console.warn("[knowledgeSuggestions] Failed to emit rollback failure:", emitError);
      }
      throw error;
    }

    const rolledBackAt = Date.now();
    const rolledBackResult = {
      ...resultRecord,
      rolledBackAt,
      rolledBackByUserId: userId,
    };

    await ctx.runMutation(internalAny.knowledgeSuggestions.markRolledBackInternal, {
      suggestionId,
      rolledBackByUserId: userId,
      result: rolledBackResult,
    });

    try {
      await ctx.runMutation(internalAny.activity.emit, {
        projectId: suggestion.projectId,
        actorType: "user",
        actorUserId: userId,
        action: "knowledge_pr.rolled_back",
        summary: "Knowledge PR rolled back",
        suggestionId: suggestion._id,
        toolCallId: suggestion.toolCallId,
        metadata: {
          suggestionId: suggestion._id,
          toolName: suggestion.toolName,
          toolCallId: suggestion.toolCallId,
          rollbackKind: kind,
          deletedRelationshipsCount: deletedRelationships.length,
        },
      });
    } catch (emitError) {
      console.warn("[knowledgeSuggestions] Failed to emit rollback activity:", emitError);
    }

    return {
      success: true,
      deletedRelationshipsCount: deletedRelationships.length,
    };
  },
});
