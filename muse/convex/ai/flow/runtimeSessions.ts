import { v } from "convex/values";
import { internalMutation, internalQuery } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";

export const getRuntimeSessionInternal = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("flowRuntimeSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .unique();
  },
});

export const listExpiredRuntimeSessionsInternal = internalQuery({
  args: { now: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { now, limit }) => {
    const results = await ctx.db
      .query("flowRuntimeSessions")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .take(Math.max(1, Math.min(limit ?? 50, 200)));
    return results;
  },
});

export const createRuntimeSessionInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    userId: v.string(),
    sessionId: v.string(),
    status: v.union(v.literal("active"), v.literal("ended"), v.literal("expired")),
    facetOverride: v.optional(v.any()),
    proactivityMode: v.optional(v.string()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"flowRuntimeSessions">> => {
    const now = Date.now();
    return await ctx.db.insert("flowRuntimeSessions", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateRuntimeSessionInternal = internalMutation({
  args: {
    id: v.id("flowRuntimeSessions"),
    patch: v.any(),
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
  },
});
