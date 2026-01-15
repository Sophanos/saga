/**
 * Saga thread ownership mappings.
 *
 * Persists thread-to-project/user associations for access control.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const upsertThread = internalMutation({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
    scope: v.union(v.literal("project"), v.literal("document"), v.literal("private")),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, { threadId, projectId, userId, scope, documentId }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sagaThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .first();

    if (existing) {
      if (existing.projectId !== projectId) {
        throw new Error("Thread project mismatch");
      }
      if (existing.scope !== scope) {
        throw new Error("Thread scope mismatch");
      }
      if ((existing.documentId ?? null) !== (documentId ?? null)) {
        throw new Error("Thread document mismatch");
      }
      if (existing.scope === "private" && existing.createdBy !== userId) {
        throw new Error("Access denied");
      }
      await ctx.db.patch(existing._id, { updatedAt: now });
      return existing._id;
    }

    if (scope === "document" && !documentId) {
      throw new Error("Document scope requires documentId");
    }

    if (documentId) {
      const document = await ctx.db.get(documentId);
      if (!document) {
        throw new Error("Document not found");
      }
      if (document.projectId !== projectId) {
        throw new Error("Document project mismatch");
      }
    }

    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
      .unique();

    if (!member) {
      throw new Error("Access denied");
    }

    return await ctx.db.insert("sagaThreads", {
      threadId,
      projectId,
      scope,
      documentId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const assertThreadAccess = internalQuery({
  args: {
    threadId: v.string(),
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, { threadId, projectId, userId }) => {
    const record = await ctx.db
      .query("sagaThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .first();

    if (!record) {
      throw new Error("Thread not found");
    }

    if (record.projectId !== projectId) {
      throw new Error("Access denied");
    }

    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", userId))
      .unique();

    if (!member) {
      throw new Error("Access denied");
    }

    if (record.scope === "private" && record.createdBy !== userId) {
      throw new Error("Access denied");
    }

    return {
      scope: record.scope,
      documentId: record.documentId ?? null,
      role: member.role,
      createdBy: record.createdBy,
    };
  },
});

export const getThread = internalQuery({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, { threadId }) => {
    return await ctx.db
      .query("sagaThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .first();
  },
});
