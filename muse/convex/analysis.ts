/**
 * Analysis Records
 *
 * Stores writing analysis metrics for history tracking.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyDocumentAccess, verifyProjectAccess } from "./lib/auth";

// ============================================================
// QUERIES
// ============================================================

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 100, cursor }) => {
    await verifyProjectAccess(ctx, projectId);

    const query = ctx.db
      .query("analysisRecords")
      .withIndex("by_project_analyzedAt", (q) =>
        cursor ? q.eq("projectId", projectId).lt("analyzedAt", cursor) : q.eq("projectId", projectId)
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
      .query("analysisRecords")
      .withIndex("by_document_analyzedAt", (q) =>
        cursor ? q.eq("documentId", documentId).lt("analyzedAt", cursor) : q.eq("documentId", documentId)
      )
      .order("desc");

    return query.take(limit);
  },
});

// ============================================================
// MUTATIONS
// ============================================================

export const insert = mutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    sceneId: v.string(),
    metrics: v.any(),
    wordCount: v.optional(v.number()),
    analyzedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await verifyProjectAccess(ctx, args.projectId);

    const analyzedAt = args.analyzedAt ?? Date.now();

    return await ctx.db.insert("analysisRecords", {
      projectId: args.projectId,
      documentId: args.documentId,
      sceneId: args.sceneId,
      metrics: args.metrics,
      wordCount: args.wordCount,
      analyzedAt,
    });
  },
});
