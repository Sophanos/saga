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
    operation: v.string(),
    targetType: targetTypeSchema,
    targetId: v.optional(v.string()),
    proposedPatch: v.any(),
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
    return ctx.db.insert("knowledgeSuggestions", {
      projectId: args.projectId,
      targetType: args.targetType,
      targetId: args.targetId,
      operation: args.operation,
      proposedPatch: args.proposedPatch,
      status: "proposed",
      actorType: args.actorType,
      actorUserId: args.actorUserId,
      actorAgentId: args.actorAgentId,
      actorName: args.actorName,
      toolName: args.toolName,
      toolCallId: args.toolCallId,
      approvalType: args.approvalType,
      danger: args.danger,
      streamId: args.streamId,
      threadId: args.threadId,
      promptMessageId: args.promptMessageId,
      model: args.model,
      createdAt: now,
      updatedAt: now,
    });
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

    let status: "accepted" | "rejected" | "resolved" = "resolved";
    let error: string | undefined;
    let targetId: string | undefined;

    if (toolName === "write_content") {
      const applied = resultRecord?.["applied"];
      if (applied === true) status = "accepted";
      if (applied === false) status = "rejected";
    } else if (resultRecord) {
      if (typeof resultRecord["success"] === "boolean") {
        const success = resultRecord["success"];
        status = success ? "accepted" : "rejected";
        if (!success && typeof resultRecord["error"] === "string") {
          error = resultRecord["error"] as string;
        }
      } else if (typeof resultRecord["error"] === "string") {
        status = "rejected";
        error = resultRecord["error"] as string;
      } else if (
        typeof resultRecord["entityId"] === "string" ||
        typeof resultRecord["relationshipId"] === "string" ||
        typeof resultRecord["memoryId"] === "string"
      ) {
        status = "accepted";
      } else {
        status = "accepted";
      }

      if (typeof resultRecord["entityId"] === "string") {
        targetId = resultRecord["entityId"] as string;
      } else if (typeof resultRecord["relationshipId"] === "string") {
        targetId = resultRecord["relationshipId"] as string;
      } else if (typeof resultRecord["memoryId"] === "string") {
        targetId = resultRecord["memoryId"] as string;
      }
    } else {
      status = "accepted";
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

async function verifyProjectEditorAccess(ctx: any, projectId: Id<"projects">, userId: string): Promise<void> {
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

  if (access.role === "viewer") {
    throw new Error("Edit access denied");
  }
}

function buildRejectionResult(toolName: string): Record<string, unknown> {
  if (toolName === "write_content") {
    return { applied: false };
  }
  return { error: "User rejected" };
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

async function applySuggestionApprove(ctx: any, suggestion: any, userId: string): Promise<Record<string, unknown>> {
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
        return { success: false, error: result?.message ?? "Failed to create entity" };
      }
      return {
        ...result,
        rollback: { kind: "entity.create", entityId: result.entityId },
      };
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
        return { success: false, error: result?.message ?? "Failed to update entity" };
      }
      return {
        ...result,
        rollback: {
          kind: "entity.update",
          entityId: result.entityId,
          before: before
            ? {
                name: before.name,
                aliases: before.aliases,
                notes: before.notes,
                properties: before.properties,
              }
            : null,
        },
      };
    }
    case "create_node": {
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeCreateNode, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return { success: false, error: result?.message ?? "Failed to create node" };
      }
      return {
        ...result,
        rollback: { kind: "entity.create", entityId: result.entityId },
      };
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
        return { success: false, error: result?.message ?? "Failed to update node" };
      }
      return {
        ...result,
        rollback: {
          kind: "entity.update",
          entityId: result.entityId,
          before: before
            ? {
                name: before.name,
                aliases: before.aliases,
                notes: before.notes,
                properties: before.properties,
              }
            : null,
        },
      };
    }
    case "create_relationship": {
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeCreateRelationship, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return { success: false, error: result?.message ?? "Failed to create relationship" };
      }
      return {
        ...result,
        rollback: { kind: "relationship.create", relationshipId: result.relationshipId },
      };
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
        return { success: false, error: result?.message ?? "Failed to update relationship" };
      }
      return {
        ...result,
        rollback: {
          kind: "relationship.update",
          relationshipId: result.relationshipId,
          before: beforeRel
            ? {
                bidirectional: beforeRel.bidirectional ?? false,
                strength: beforeRel.strength,
                notes: beforeRel.notes,
                metadata: beforeRel.metadata,
              }
            : null,
        },
      };
    }
    case "create_edge": {
      const result = await ctx.runAction(internalAny["ai/tools/worldGraphHandlers"].executeCreateEdge, {
        projectId: projectId as string,
        toolArgs,
        actor,
        source,
      });
      if (!result?.success) {
        return { success: false, error: result?.message ?? "Failed to create edge" };
      }
      return {
        ...result,
        rollback: { kind: "relationship.create", relationshipId: result.relationshipId },
      };
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
        return { success: false, error: result?.message ?? "Failed to update edge" };
      }
      return {
        ...result,
        rollback: {
          kind: "relationship.update",
          relationshipId: result.relationshipId,
          before: beforeRel
            ? {
                bidirectional: beforeRel.bidirectional ?? false,
                strength: beforeRel.strength,
                notes: beforeRel.notes,
                metadata: beforeRel.metadata,
              }
            : null,
        },
      };
    }
    case "commit_decision": {
      const result = await ctx.runAction(internalAny["ai/tools"].execute, {
        toolName: "commit_decision",
        input: toolArgs,
        projectId: projectId as string,
        userId,
      });

      if (!result || typeof result !== "object") {
        return { success: false, error: "Failed to store memory" };
      }

      const record = result as Record<string, unknown>;
      const memoryId = typeof record["memoryId"] === "string" ? (record["memoryId"] as string) : undefined;
      if (!memoryId) {
        return { success: false, error: "Failed to store memory" };
      }

      return {
        success: true,
        memoryId,
        content: record["content"],
        rollback: { kind: "memory.commit_decision", memoryId },
      };
    }
    case "write_content":
      return { success: false, error: "Apply document changes from the editor UI." };
    default:
      return { success: false, error: `Unsupported tool for review: ${toolName}` };
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
        await verifyProjectEditorAccess(ctx, suggestion.projectId as Id<"projects">, userId);
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

      const approvedResult = await applySuggestionApprove(ctx, suggestion, userId);
      await ctx.runMutation(internalAny.knowledgeSuggestions.resolveFromToolResult, {
        toolCallId: suggestion.toolCallId,
        toolName: suggestion.toolName,
        resolvedByUserId: userId,
        result: approvedResult,
      });

      const success = approvedResult && typeof approvedResult === "object" && (approvedResult as any).success === true;
      results.push({
        suggestionId,
        status: success ? "accepted" : "rejected",
        error: success ? undefined : String((approvedResult as any).error ?? "Failed to apply"),
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

    await verifyProjectEditorAccess(ctx, suggestion.projectId as Id<"projects">, userId);

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
      if (!isQdrantConfigured()) {
        throw new Error("Vector store not configured");
      }
      await deletePoints([memoryId], { collection: "saga_vectors" });
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
