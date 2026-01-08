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
  },
  handler: async (ctx, { threadId, projectId, userId }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("sagaThreads")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .first();

    if (existing) {
      if (existing.projectId !== projectId || existing.userId !== userId) {
        throw new Error("Thread ownership mismatch");
      }
      await ctx.db.patch(existing._id, { updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("sagaThreads", {
      threadId,
      projectId,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const assertThreadOwnership = internalQuery({
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

    if (record.projectId !== projectId || record.userId !== userId) {
      throw new Error("Access denied");
    }

    return true;
  },
});
