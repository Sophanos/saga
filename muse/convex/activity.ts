/**
 * Activity log - append-only audit trail.
 */

import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { verifyDocumentAccess, verifyProjectAccess } from "./lib/auth";

export const emit = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    suggestionId: v.optional(v.id("knowledgeSuggestions")),
    toolCallId: v.optional(v.string()),
    actorType: v.string(),
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    action: v.string(),
    summary: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const createdAt = args.createdAt ?? Date.now();
    return ctx.db.insert("activityLog", {
      projectId: args.projectId,
      documentId: args.documentId,
      suggestionId: args.suggestionId,
      toolCallId: args.toolCallId,
      actorType: args.actorType,
      actorUserId: args.actorUserId,
      actorAgentId: args.actorAgentId,
      actorName: args.actorName,
      action: args.action,
      summary: args.summary,
      metadata: args.metadata,
      createdAt,
    });
  },
});

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 50, cursor }) => {
    await verifyProjectAccess(ctx, projectId);

    const query = ctx.db
      .query("activityLog")
      .withIndex("by_project_createdAt", (q) =>
        cursor ? q.eq("projectId", projectId).lt("createdAt", cursor) : q.eq("projectId", projectId)
      )
      .order("desc");

    return query.take(limit);
  },
});

export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { documentId, limit = 50, cursor }) => {
    await verifyDocumentAccess(ctx, documentId);

    const query = ctx.db
      .query("activityLog")
      .withIndex("by_document_createdAt", (q) =>
        cursor ? q.eq("documentId", documentId).lt("createdAt", cursor) : q.eq("documentId", documentId)
      )
      .order("desc");

    return query.take(limit);
  },
});

export const listBySuggestion = query({
  args: {
    projectId: v.id("projects"),
    suggestionId: v.id("knowledgeSuggestions"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, suggestionId, limit = 50, cursor }) => {
    await verifyProjectAccess(ctx, projectId);

    const query = ctx.db
      .query("activityLog")
      .withIndex("by_project_suggestion_createdAt", (q) =>
        cursor
          ? q
              .eq("projectId", projectId)
              .eq("suggestionId", suggestionId)
              .lt("createdAt", cursor)
          : q.eq("projectId", projectId).eq("suggestionId", suggestionId)
      )
      .order("desc");

    return query.take(limit);
  },
});

export const listByToolCallId = query({
  args: {
    projectId: v.id("projects"),
    toolCallId: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, toolCallId, limit = 50, cursor }) => {
    await verifyProjectAccess(ctx, projectId);

    const query = ctx.db
      .query("activityLog")
      .withIndex("by_project_toolCallId_createdAt", (q) =>
        cursor
          ? q.eq("projectId", projectId).eq("toolCallId", toolCallId).lt("createdAt", cursor)
          : q.eq("projectId", projectId).eq("toolCallId", toolCallId)
      )
      .order("desc");

    return query.take(limit);
  },
});
