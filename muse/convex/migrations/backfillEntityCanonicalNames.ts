/**
 * Backfill canonicalName for existing entities.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { canonicalizeName } from "../lib/canonicalize";

export const listEntitiesForCanonicalBackfill = internalQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 200 }) => {
    if (projectId) {
      return ctx.db
        .query("entities")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .take(limit);
    }

    return ctx.db.query("entities").take(limit);
  },
});

export const patchEntityCanonicalName = internalMutation({
  args: {
    id: v.id("entities"),
    canonicalName: v.string(),
  },
  handler: async (ctx, { id, canonicalName }) => {
    await ctx.db.patch(id, { canonicalName, updatedAt: Date.now() });
    return id;
  },
});

export const backfillEntityCanonicalNames = internalAction({
  args: {
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, limit = 200 }) => {
    const entities = await ctx.runQuery(
      (internal as any)["migrations/backfillEntityCanonicalNames"].listEntitiesForCanonicalBackfill,
      { projectId, limit }
    );

    let updated = 0;
    let skipped = 0;

    for (const entity of entities) {
      const canonicalName = canonicalizeName(entity.name);
      if (entity.canonicalName === canonicalName) {
        skipped += 1;
        continue;
      }

      await ctx.runMutation(
        (internal as any)["migrations/backfillEntityCanonicalNames"].patchEntityCanonicalName,
        { id: entity._id, canonicalName }
      );
      updated += 1;
    }

    return { updated, skipped };
  },
});
