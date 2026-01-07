/**
 * Convex Relationships Functions
 *
 * CRUD operations for entity relationships (World Graph edges).
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyEntityAccess, verifyRelationshipAccess } from "./lib/auth";

// ============================================================
// QUERIES
// ============================================================

/**
 * List all relationships for a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    return await ctx.db
      .query("relationships")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Get relationships for a specific entity
 */
export const getForEntity = query({
  args: {
    entityId: v.id("entities"),
  },
  handler: async (ctx, args) => {
    const { entityId } = args;

    // Verify user has access via entity's project
    await verifyEntityAccess(ctx, entityId);

    // Get relationships where entity is source
    const asSource = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", entityId))
      .collect();

    // Get relationships where entity is target
    const asTarget = await ctx.db
      .query("relationships")
      .withIndex("by_target", (q) => q.eq("targetId", entityId))
      .collect();

    return {
      outgoing: asSource,
      incoming: asTarget,
    };
  },
});

/**
 * Get relationship between two specific entities
 */
export const getBetween = query({
  args: {
    sourceId: v.id("entities"),
    targetId: v.id("entities"),
  },
  handler: async (ctx, args) => {
    const { sourceId, targetId } = args;

    // Verify user has access via source entity's project
    await verifyEntityAccess(ctx, sourceId);

    // Check direct relationship
    const direct = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", sourceId))
      .filter((q) => q.eq(q.field("targetId"), targetId))
      .first();

    if (direct) return direct;

    // Check reverse for bidirectional
    const reverse = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", targetId))
      .filter((q) =>
        q.and(
          q.eq(q.field("targetId"), sourceId),
          q.eq(q.field("bidirectional"), true)
        )
      )
      .first();

    return reverse ?? null;
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new relationship
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    sourceId: v.id("entities"),
    targetId: v.id("entities"),
    type: v.string(),
    bidirectional: v.optional(v.boolean()),
    strength: v.optional(v.number()),
    metadata: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    // Verify both entities exist and belong to the same project
    const source = await ctx.db.get(args.sourceId);
    const target = await ctx.db.get(args.targetId);

    if (!source || !target) {
      throw new Error("Source or target entity not found");
    }

    if (source.projectId !== args.projectId || target.projectId !== args.projectId) {
      throw new Error("Entities must belong to the same project");
    }

    const id = await ctx.db.insert("relationships", {
      projectId: args.projectId,
      sourceId: args.sourceId,
      targetId: args.targetId,
      type: args.type,
      bidirectional: args.bidirectional ?? false,
      strength: args.strength,
      metadata: args.metadata,
      notes: args.notes,
      createdAt: Date.now(),
    });

    return id;
  },
});

/**
 * Update an existing relationship
 */
export const update = mutation({
  args: {
    id: v.id("relationships"),
    type: v.optional(v.string()),
    bidirectional: v.optional(v.boolean()),
    strength: v.optional(v.number()),
    metadata: v.optional(v.any()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Verify user has access via relationship's project
    await verifyRelationshipAccess(ctx, id);

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, cleanUpdates);

    return id;
  },
});

/**
 * Delete a relationship
 */
export const remove = mutation({
  args: {
    id: v.id("relationships"),
  },
  handler: async (ctx, args) => {
    // Verify user has access via relationship's project
    await verifyRelationshipAccess(ctx, args.id);

    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Bulk create relationships (for import/migration)
 */
export const bulkCreate = mutation({
  args: {
    projectId: v.id("projects"),
    relationships: v.array(
      v.object({
        sourceId: v.id("entities"),
        targetId: v.id("entities"),
        type: v.string(),
        bidirectional: v.optional(v.boolean()),
        strength: v.optional(v.number()),
        metadata: v.optional(v.any()),
        supabaseId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();
    const ids: Id<"relationships">[] = [];

    for (const rel of args.relationships) {
      const id = await ctx.db.insert("relationships", {
        projectId: args.projectId,
        sourceId: rel.sourceId,
        targetId: rel.targetId,
        type: rel.type,
        bidirectional: rel.bidirectional ?? false,
        strength: rel.strength,
        metadata: rel.metadata,
        supabaseId: rel.supabaseId,
        createdAt: now,
      });
      ids.push(id);
    }

    return ids;
  },
});
