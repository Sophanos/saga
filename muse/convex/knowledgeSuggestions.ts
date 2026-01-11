/**
 * Knowledge suggestions (Knowledge PRs) for graph and memory mutations.
 *
 * These are created when the agent emits a tool-approval-request, then resolved
 * when the user provides a tool-result (or a future approval workflow).
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess } from "./lib/auth";
import { deletePoints, isQdrantConfigured } from "./lib/qdrant";

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
};

type CanonCitationInput = {
  memoryId: string;
  category?: "decision" | "policy";
  excerpt?: string;
  reason?: string;
  confidence?: number;
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

function buildNormalizedPatch(
  toolName: string,
  toolArgs: unknown
): JsonPatchOperation[] | undefined {
  const record = getRecord(toolArgs);
  if (!record) return undefined;

  const ops: JsonPatchOperation[] = [];

  switch (toolName) {
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

export const getInternal = internalQuery({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
  },
  handler: async (ctx, { suggestionId }) => {
    return ctx.db.get(suggestionId);
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
    const suggestionId = await ctx.db.insert("knowledgeSuggestions", {
      projectId: args.projectId,
      targetType: args.targetType,
      targetId: args.targetId,
      operation: args.operation,
      proposedPatch: toolArgs,
      normalizedPatch,
      editorContext: args.editorContext,
      status: "proposed",
      actorType: args.actorType,
      actorUserId: args.actorUserId,
      actorAgentId: args.actorAgentId,
      actorName: args.actorName,
      toolName: args.toolName,
      toolCallId: args.toolCallId,
      approvalType: args.approvalType,
      danger: args.danger,
      riskLevel: args.riskLevel,
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

    await ctx.db.patch(suggestion._id, {
      status,
      targetId: targetId ?? suggestion.targetId,
      resolvedByUserId,
      resolvedAt: now,
      result,
      error,
      updatedAt: now,
    });

    const rejectedByUser = isUserRejection(toolName, resultRecord, envelope);
    if (!rejectedByUser) {
      const action = status === "accepted" ? "knowledge_pr.executed" : "knowledge_pr.execution_failed";
      const summary = status === "accepted" ? "Knowledge PR executed" : "Knowledge PR execution failed";
      try {
        await ctx.runMutation(internalAny.activity.emit, {
          projectId: suggestion.projectId,
          actorType: "user",
          actorUserId: resolvedByUserId,
          action,
          summary,
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

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(statusSchema),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, status, limit = 50, cursor }) => {
    await verifyProjectAccess(ctx, projectId);

    if (status) {
      const query = ctx.db
        .query("knowledgeSuggestions")
        .withIndex("by_project_status_createdAt", (q) =>
          cursor
            ? q.eq("projectId", projectId).eq("status", status).lt("createdAt", cursor)
            : q.eq("projectId", projectId).eq("status", status)
        )
        .order("desc");

      return query.take(limit);
    }

    const query = ctx.db
      .query("knowledgeSuggestions")
      .withIndex("by_project_createdAt", (q) =>
        cursor ? q.eq("projectId", projectId).lt("createdAt", cursor) : q.eq("projectId", projectId)
      )
      .order("desc");

    return query.take(limit);
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
  const access = await ctx.runQuery(internalAny["ai/tools/worldGraphHandlers"].getProjectMemberRole, {
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
  const matches = (await ctx.runQuery(internalAny["ai/tools/worldGraphHandlers"].findEntityByCanonical, {
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

  return ctx.runQuery(internalAny["ai/tools/worldGraphHandlers"].findRelationship, {
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

  const toolName = suggestion.toolName as string;
  const toolArgs = suggestion.proposedPatch as Record<string, unknown>;

  switch (toolName) {
    case "create_entity": {
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeCreateEntity, {
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
      const before = await resolveEntityUnique(ctx, projectId, String(toolArgs["entityName"] ?? ""), toolArgs["entityType"] as string | undefined);
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeUpdateEntity, {
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
        }
      );
    }
    case "create_node": {
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeCreateNode, {
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
      const before = await resolveEntityUnique(ctx, projectId, String(toolArgs["nodeName"] ?? ""), toolArgs["nodeType"] as string | undefined);
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeUpdateNode, {
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
        }
      );
    }
    case "create_relationship": {
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeCreateRelationship, {
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
      const beforeRel = await resolveRelationshipByNames(
        ctx,
        projectId,
        String(toolArgs["sourceName"] ?? ""),
        String(toolArgs["targetName"] ?? ""),
        String(toolArgs["type"] ?? "")
      );
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeUpdateRelationship, {
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
        }
      );
    }
    case "create_edge": {
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeCreateEdge, {
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
      const beforeRel = await resolveRelationshipByNames(
        ctx,
        projectId,
        String(toolArgs["sourceName"] ?? ""),
        String(toolArgs["targetName"] ?? ""),
        String(toolArgs["type"] ?? "")
      );
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeUpdateEdge, {
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

      if (String(suggestion.toolName) === "write_content") {
        results.push({
          suggestionId,
          status: "error",
          error: "Apply document changes from the editor UI.",
        });
        continue;
      }

      try {
        await ctx.runMutation(internalAny.activity.emit, {
          projectId: suggestion.projectId,
          actorType: "user",
          actorUserId: userId,
          action: "knowledge_pr.approved",
          summary: "Knowledge PR approved",
          metadata: {
            suggestionId: suggestion._id,
            toolName: suggestion.toolName,
            toolCallId: suggestion.toolCallId,
          },
        });
      } catch (emitError) {
        console.warn("[knowledgeSuggestions] Failed to emit approval activity:", emitError);
      }

      const approvedResult = await applySuggestionApprove(ctx, suggestion, userId);
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
      resolvedByUserId: rolledBackByUserId,
      resolvedAt: now,
      result,
      updatedAt: now,
    });

    return suggestionId;
  },
});

export const rollbackSuggestion = action({
  args: {
    suggestionId: v.id("knowledgeSuggestions"),
  },
  handler: async (ctx, { suggestionId }) => {
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
    const rollback =
      resultRecord && typeof resultRecord["rollback"] === "object"
        ? (resultRecord["rollback"] as Record<string, unknown>)
        : null;
    if (!rollback || typeof rollback["kind"] !== "string") {
      throw new Error("No rollback data available for this change");
    }

    const kind = rollback["kind"] as string;

    if (kind === "entity.create") {
      const entityId = String(rollback["entityId"] ?? "");
      if (!entityId) throw new Error("Missing entityId for rollback");
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
        await deletePoints([memoryId], { collection: "saga_vectors" });
      }
    } else {
      throw new Error(`Rollback not supported for: ${kind}`);
    }

    const rolledBackResult = {
      ...resultRecord,
      rolledBackAt: Date.now(),
      rolledBackByUserId: userId,
    };

    await ctx.runMutation(internalAny.knowledgeSuggestions.markRolledBackInternal, {
      suggestionId,
      rolledBackByUserId: userId,
      result: rolledBackResult,
    });

    return { success: true };
  },
});
