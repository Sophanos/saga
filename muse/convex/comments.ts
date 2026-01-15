/**
 * Document comments (collaboration) helpers.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyDocumentAccess } from "./lib/auth";
import type { AddCommentResult, ViewCommentsResult } from "../packages/agent-protocol/src/tools";

export const listByDocument = query({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ViewCommentsResult> => {
    const { projectId } = await verifyDocumentAccess(ctx, args.documentId);
    if (projectId !== args.projectId) {
      throw new Error("Document does not belong to project");
    }

    const limit = args.limit ?? 50;
    const cursorValue = args.cursor ? Number(args.cursor) : undefined;

    const query = ctx.db
      .query("comments")
      .withIndex("by_document_createdAt", (q) =>
        cursorValue
          ? q.eq("documentId", args.documentId).lt("createdAt", cursorValue)
          : q.eq("documentId", args.documentId)
      )
      .order("desc");

    const rows = await query.take(limit);
    const nextCursor =
      rows.length === limit ? String(rows[rows.length - 1]?.createdAt ?? "") : undefined;

    return {
      comments: rows.map((row) => ({
        id: row._id,
        authorId: row.authorId,
        content: row.content,
        createdAt: new Date(row.createdAt).toISOString(),
        selectionRange: row.selectionRange ?? undefined,
      })),
      nextCursor,
    };
  },
});

export const add = mutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    content: v.string(),
    selectionRange: v.optional(v.object({ from: v.number(), to: v.number() })),
  },
  handler: async (ctx, args): Promise<AddCommentResult> => {
    const { userId, projectId } = await verifyDocumentAccess(ctx, args.documentId);
    if (projectId !== args.projectId) {
      throw new Error("Document does not belong to project");
    }

    const now = Date.now();
    const commentId = await ctx.db.insert("comments", {
      projectId: args.projectId,
      documentId: args.documentId,
      authorId: userId,
      content: args.content,
      selectionRange: args.selectionRange,
      createdAt: now,
      resolvedAt: undefined,
    });

    return { commentId, documentId: args.documentId };
  },
});
