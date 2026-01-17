/**
 * Backfill canonClaims from pinned memories.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

export const listPinnedMemoriesForCanon = internalQuery({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 200 }) => {
    return ctx.db
      .query("memories")
      .withIndex("by_pinned", (q) => q.eq("projectId", projectId).eq("pinned", true))
      .take(limit);
  },
});

export const getCanonClaimBySourceId = internalQuery({
  args: {
    projectId: v.id("projects"),
    sourceId: v.string(),
  },
  handler: async (ctx, { projectId, sourceId }) => {
    return ctx.db
      .query("canonClaims")
      .withIndex("by_project_sourceId", (q) =>
        q.eq("projectId", projectId).eq("sourceId", sourceId)
      )
      .first();
  },
});

export const insertCanonClaim = internalMutation({
  args: {
    projectId: v.id("projects"),
    text: v.string(),
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("canonClaims", {
      projectId: args.projectId,
      text: args.text.trim(),
      source: "memory",
      sourceId: args.sourceId,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const backfillCanonClaimsFromPinnedMemories = internalAction({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 200 }) => {
    const memories = await ctx.runQuery(
      (internal as any)["migrations/backfillCanonClaimsFromMemories"].listPinnedMemoriesForCanon,
      { projectId, limit }
    );

    let created = 0;
    let skipped = 0;

    for (const memory of memories) {
      const existing = await ctx.runQuery(
        (internal as any)["migrations/backfillCanonClaimsFromMemories"].getCanonClaimBySourceId,
        { projectId, sourceId: String(memory._id) }
      );

      if (existing) {
        skipped += 1;
        continue;
      }

      await ctx.runMutation(
        (internal as any)["migrations/backfillCanonClaimsFromMemories"].insertCanonClaim,
        { projectId, text: memory.text, sourceId: String(memory._id) }
      );
      created += 1;
    }

    return { created, skipped };
  },
});
