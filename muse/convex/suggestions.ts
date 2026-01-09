/**
 * Document suggestions persistence and status updates.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { verifyDocumentAccess, verifyProjectEditor } from "./lib/auth";

export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { documentId, status, limit = 100, cursor }) => {
    await verifyDocumentAccess(ctx, documentId);

    if (status) {
      const query = ctx.db
        .query("documentSuggestions")
        .withIndex("by_document_status_createdAt", (q) =>
          cursor
            ? q.eq("documentId", documentId).eq("status", status).lt("createdAt", cursor)
            : q.eq("documentId", documentId).eq("status", status)
        )
        .order("desc");

      return query.take(limit);
    }

    const query = ctx.db
      .query("documentSuggestions")
      .withIndex("by_document_createdAt", (q) =>
        cursor ? q.eq("documentId", documentId).lt("createdAt", cursor) : q.eq("documentId", documentId)
      )
      .order("desc");

    return query.take(limit);
  },
});

export const createSuggestion = mutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    suggestion: v.object({
      suggestionId: v.string(),
      type: v.string(),
      content: v.string(),
      originalContent: v.optional(v.string()),
      status: v.optional(v.string()),
      anchorStart: v.optional(
        v.object({
          blockId: v.string(),
          offset: v.number(),
        })
      ),
      anchorEnd: v.optional(
        v.object({
          blockId: v.string(),
          offset: v.number(),
        })
      ),
      from: v.optional(v.number()),
      to: v.optional(v.number()),
      agentId: v.optional(v.string()),
      model: v.optional(v.string()),
      format: v.optional(v.string()),
      createdByUserId: v.optional(v.string()),
      metadata: v.optional(v.any()),
    }),
  },
  handler: async (ctx, { projectId, documentId, suggestion }) => {
    const userId = await verifyProjectEditor(ctx, projectId);
    const docAccess = await verifyDocumentAccess(ctx, documentId);
    if (docAccess.projectId !== projectId) {
      throw new Error("Document does not belong to project");
    }

    const existing = await ctx.db
      .query("documentSuggestions")
      .withIndex("by_suggestion_id", (q) => q.eq("suggestionId", suggestion.suggestionId))
      .unique();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const status = suggestion.status ?? "proposed";
    const createdByUserId = suggestion.createdByUserId ?? userId;

    const id = await ctx.db.insert("documentSuggestions", {
      projectId,
      documentId,
      suggestionId: suggestion.suggestionId,
      type: suggestion.type,
      content: suggestion.content,
      originalContent: suggestion.originalContent,
      status,
      anchorStart: suggestion.anchorStart,
      anchorEnd: suggestion.anchorEnd,
      from: suggestion.from,
      to: suggestion.to,
      agentId: suggestion.agentId,
      model: suggestion.model,
      format: suggestion.format,
      createdByUserId,
      createdAt: now,
      updatedAt: now,
      resolvedAt: status !== "proposed" ? now : undefined,
      metadata: suggestion.metadata,
    });

    await ctx.runMutation((internal as any).activity.emit, {
      projectId,
      documentId,
      actorType: "user",
      actorUserId: createdByUserId,
      action: "suggestion_created",
      summary: `Suggestion created (${suggestion.type})`,
      metadata: {
        suggestionId: suggestion.suggestionId,
        status,
      },
    });

    return id;
  },
});

export const setSuggestionStatus = mutation({
  args: {
    suggestionId: v.string(),
    status: v.union(
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("resolved")
    ),
  },
  handler: async (ctx, { suggestionId, status }) => {
    const suggestion = await ctx.db
      .query("documentSuggestions")
      .withIndex("by_suggestion_id", (q) => q.eq("suggestionId", suggestionId))
      .unique();

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }

    const { projectId, userId } = await verifyDocumentAccess(ctx, suggestion.documentId);
    await verifyProjectEditor(ctx, projectId);

    const now = Date.now();
    await ctx.db.patch(suggestion._id, {
      status,
      updatedAt: now,
      resolvedAt: now,
      resolvedByUserId: userId,
    });

    const action =
      status === "accepted"
        ? "suggestion_accepted"
        : status === "rejected"
        ? "suggestion_rejected"
        : "suggestion_resolved";

    await ctx.runMutation((internal as any).activity.emit, {
      projectId,
      documentId: suggestion.documentId,
      actorType: "user",
      actorUserId: userId,
      action,
      summary: `Suggestion ${status}`,
      metadata: { suggestionId },
    });

    return suggestion._id;
  },
});
