/**
 * Knowledge suggestions (Knowledge PRs) for graph and memory mutations.
 *
 * These are created when the agent emits a tool-approval-request, then resolved
 * when the user provides a tool-result (or a future approval workflow).
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { verifyProjectAccess } from "./lib/auth";

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

    if (toolName === "write_content") {
      const applied = resultRecord?.["applied"];
      if (applied === true) status = "accepted";
      if (applied === false) status = "rejected";
    } else if (resultRecord) {
      if (typeof resultRecord["success"] === "boolean") {
        status = resultRecord["success"] ? "accepted" : "rejected";
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
    } else {
      status = "accepted";
    }

    await ctx.db.patch(suggestion._id, {
      status,
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

