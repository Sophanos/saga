/**
 * Convex Entities Functions
 *
 * CRUD operations for entities (characters, locations, items, etc.)
 * Real-time subscriptions for World Graph updates.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyEntityAccess } from "./lib/auth";

// ============================================================
// QUERIES
// ============================================================

/**
 * List all entities for a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { projectId, type, limit = 100 } = args;

    // Verify user has access to this project
    await verifyProjectAccess(ctx, projectId);

    let q = ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId));

    if (type) {
      q = ctx.db
        .query("entities")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", projectId).eq("type", type)
        );
    }

    const entities = await q.take(limit);

    return entities;
  },
});

/**
 * Get a single entity by ID
 */
export const get = query({
  args: {
    id: v.id("entities"),
  },
  handler: async (ctx, args) => {
    // Verify user has access via entity's project
    await verifyEntityAccess(ctx, args.id);
    return await ctx.db.get(args.id);
  },
});

/**
 * Search entities by name (prefix match)
 */
export const searchByName = query({
  args: {
    projectId: v.id("projects"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { projectId, query: searchQuery, limit = 20 } = args;

    // Verify user has access to this project
    await verifyProjectAccess(ctx, projectId);

    const lowerQuery = searchQuery.toLowerCase();

    // Get all entities for project (Convex doesn't have LIKE queries)
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Filter by name/aliases client-side
    const matches = entities.filter((entity) => {
      const nameMatch = entity.name.toLowerCase().includes(lowerQuery);
      const aliasMatch = entity.aliases.some((alias) =>
        alias.toLowerCase().includes(lowerQuery)
      );
      return nameMatch || aliasMatch;
    });

    return matches.slice(0, limit);
  },
});

/**
 * Get entities with their relationships (for World Graph)
 */
export const listWithRelationships = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { projectId } = args;

    // Verify user has access to this project
    await verifyProjectAccess(ctx, projectId);

    // Get all entities
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    // Get all relationships
    const relationships = await ctx.db
      .query("relationships")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return {
      entities,
      relationships,
    };
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new entity
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    name: v.string(),
    aliases: v.optional(v.array(v.string())),
    properties: v.optional(v.any()),
    notes: v.optional(v.string()),
    portraitUrl: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    visibleIn: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();

    const id = await ctx.db.insert("entities", {
      projectId: args.projectId,
      type: args.type,
      name: args.name,
      aliases: args.aliases ?? [],
      properties: args.properties ?? {},
      notes: args.notes,
      portraitUrl: args.portraitUrl,
      icon: args.icon,
      color: args.color,
      visibleIn: args.visibleIn,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.runMutation(internal.ai.embeddings.enqueueEmbeddingJob, {
      projectId: args.projectId,
      targetType: "entity",
      targetId: id,
    });

    return id;
  },
});

/**
 * Update an existing entity
 */
export const update = mutation({
  args: {
    id: v.id("entities"),
    name: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    properties: v.optional(v.any()),
    notes: v.optional(v.string()),
    portraitUrl: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    visibleIn: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Verify user has access via entity's project
    await verifyEntityAccess(ctx, id);

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    const entity = await ctx.db.get(id);
    if (entity) {
      await ctx.runMutation(internal.ai.embeddings.enqueueEmbeddingJob, {
        projectId: entity.projectId,
        targetType: "entity",
        targetId: entity._id,
      });
    }

    return id;
  },
});

/**
 * Delete an entity and its relationships
 */
export const remove = mutation({
  args: {
    id: v.id("entities"),
  },
  handler: async (ctx, args) => {
    const { id } = args;

    // Verify user has access via entity's project
    await verifyEntityAccess(ctx, id);

    // Delete all relationships involving this entity
    const sourceRelationships = await ctx.db
      .query("relationships")
      .withIndex("by_source", (q) => q.eq("sourceId", id))
      .collect();

    const targetRelationships = await ctx.db
      .query("relationships")
      .withIndex("by_target", (q) => q.eq("targetId", id))
      .collect();

    for (const rel of [...sourceRelationships, ...targetRelationships]) {
      await ctx.db.delete(rel._id);
    }

    // Delete all mentions of this entity
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_entity", (q) => q.eq("entityId", id))
      .collect();

    for (const mention of mentions) {
      await ctx.db.delete(mention._id);
    }

    // Delete the entity itself
    await ctx.db.delete(id);

    return id;
  },
});

/**
 * Bulk create entities (for import/migration)
 */
export const bulkCreate = mutation({
  args: {
    projectId: v.id("projects"),
    entities: v.array(
      v.object({
        type: v.string(),
        name: v.string(),
        aliases: v.optional(v.array(v.string())),
        properties: v.optional(v.any()),
        notes: v.optional(v.string()),
        supabaseId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();
    const ids: Id<"entities">[] = [];

    for (const entity of args.entities) {
      const id = await ctx.db.insert("entities", {
        projectId: args.projectId,
        type: entity.type,
        name: entity.name,
        aliases: entity.aliases ?? [],
        properties: entity.properties ?? {},
        notes: entity.notes,
        supabaseId: entity.supabaseId,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }

    return ids;
  },
});
