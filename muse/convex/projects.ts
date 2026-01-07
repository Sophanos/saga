/**
 * Convex Projects Functions
 *
 * CRUD operations for projects with auth validation.
 * Projects are the top-level container for documents, entities, and relationships.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ============================================================
// AUTH HELPERS
// ============================================================

/**
 * Get the authenticated user's ID from Supabase JWT
 * Throws if not authenticated
 */
async function getAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  // Supabase JWT uses 'subject' for user ID
  return identity.subject;
}

/**
 * Verify user owns the project
 */
async function verifyProjectOwnership(
  ctx: { db: any; auth: { getUserIdentity: () => Promise<{ subject: string } | null> } },
  projectId: Id<"projects">
): Promise<string> {
  const userId = await getAuthUserId(ctx);
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.ownerId !== userId) {
    throw new Error("Access denied");
  }

  return userId;
}

// ============================================================
// QUERIES
// ============================================================

/**
 * List all projects for the authenticated user
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    return await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
  },
});

/**
 * Get a single project by ID (with ownership check)
 */
export const get = query({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await verifyProjectOwnership(ctx, args.id);
    return await ctx.db.get(args.id);
  },
});

/**
 * Get project by Supabase ID (for migration/linking)
 */
export const getBySupabaseId = query({
  args: {
    supabaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const project = await ctx.db
      .query("projects")
      .withIndex("by_supabase_id", (q) => q.eq("supabaseId", args.supabaseId))
      .first();

    if (project && project.ownerId !== userId) {
      throw new Error("Access denied");
    }

    return project;
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new project
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    genre: v.optional(v.string()),
    styleConfig: v.optional(v.any()),
    linterConfig: v.optional(v.any()),
    supabaseId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("projects", {
      ownerId: userId,
      name: args.name,
      description: args.description,
      genre: args.genre,
      styleConfig: args.styleConfig,
      linterConfig: args.linterConfig,
      supabaseId: args.supabaseId,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update a project
 */
export const update = mutation({
  args: {
    id: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    genre: v.optional(v.string()),
    styleConfig: v.optional(v.any()),
    linterConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await verifyProjectOwnership(ctx, args.id);

    const { id, ...updates } = args;

    // Filter out undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Internal delete helper for cascading deletes
 */
export const removeInternal = internalMutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { id } = args;

    // Delete all documents in the project
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();

    for (const doc of documents) {
      // Use internal document removal (handles mentions)
      await ctx.runMutation(internal.documents.removeInternal, { id: doc._id });
    }

    // Delete all entities (handles relationships and mentions via entity removal)
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();

    for (const entity of entities) {
      // Delete relationships first (entity remove also does this but we need to be thorough)
      const sourceRels = await ctx.db
        .query("relationships")
        .withIndex("by_source", (q) => q.eq("sourceId", entity._id))
        .collect();
      const targetRels = await ctx.db
        .query("relationships")
        .withIndex("by_target", (q) => q.eq("targetId", entity._id))
        .collect();

      for (const rel of [...sourceRels, ...targetRels]) {
        await ctx.db.delete(rel._id);
      }

      await ctx.db.delete(entity._id);
    }

    // Delete captures
    const captures = await ctx.db
      .query("captures")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();

    for (const capture of captures) {
      await ctx.db.delete(capture._id);
    }

    // Delete presence records
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();

    for (const p of presence) {
      await ctx.db.delete(p._id);
    }

    // Delete generation streams
    const streams = await ctx.db
      .query("generationStreams")
      .withIndex("by_project", (q) => q.eq("projectId", id))
      .collect();

    for (const stream of streams) {
      await ctx.db.delete(stream._id);
    }

    // Finally delete the project
    await ctx.db.delete(id);

    return id;
  },
});

/**
 * Delete a project and all its data
 */
export const remove = mutation({
  args: {
    id: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await verifyProjectOwnership(ctx, args.id);

    // Delegate to internal mutation for cascade delete
    await ctx.runMutation(internal.projects.removeInternal, { id: args.id });

    return args.id;
  },
});

/**
 * Duplicate a project
 */
export const duplicate = mutation({
  args: {
    id: v.id("projects"),
    newName: v.string(),
  },
  handler: async (ctx, args) => {
    await verifyProjectOwnership(ctx, args.id);

    const original = await ctx.db.get(args.id);
    if (!original) {
      throw new Error("Project not found");
    }

    const userId = await getAuthUserId(ctx);
    const now = Date.now();

    // Create new project
    const newProjectId = await ctx.db.insert("projects", {
      ownerId: userId,
      name: args.newName,
      description: original.description,
      genre: original.genre,
      styleConfig: original.styleConfig,
      linterConfig: original.linterConfig,
      createdAt: now,
      updatedAt: now,
    });

    // Map old entity IDs to new ones for relationship copying
    const entityIdMap = new Map<Id<"entities">, Id<"entities">>();

    // Copy entities
    const entities = await ctx.db
      .query("entities")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const entity of entities) {
      const newEntityId = await ctx.db.insert("entities", {
        projectId: newProjectId,
        type: entity.type,
        name: entity.name,
        aliases: entity.aliases,
        properties: entity.properties,
        notes: entity.notes,
        portraitUrl: entity.portraitUrl,
        icon: entity.icon,
        color: entity.color,
        visibleIn: entity.visibleIn,
        createdAt: now,
        updatedAt: now,
      });
      entityIdMap.set(entity._id, newEntityId);
    }

    // Copy relationships with mapped entity IDs
    const relationships = await ctx.db
      .query("relationships")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    for (const rel of relationships) {
      const newSourceId = entityIdMap.get(rel.sourceId);
      const newTargetId = entityIdMap.get(rel.targetId);

      if (newSourceId && newTargetId) {
        await ctx.db.insert("relationships", {
          projectId: newProjectId,
          sourceId: newSourceId,
          targetId: newTargetId,
          type: rel.type,
          bidirectional: rel.bidirectional,
          strength: rel.strength,
          metadata: rel.metadata,
          notes: rel.notes,
          createdAt: now,
        });
      }
    }

    // Map old document IDs to new ones for hierarchy
    const documentIdMap = new Map<Id<"documents">, Id<"documents">>();

    // Copy documents (root level first, then children)
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    // Sort to process parents before children
    const rootDocs = documents.filter((d) => !d.parentId);
    const childDocs = documents.filter((d) => d.parentId);

    for (const doc of rootDocs) {
      const newDocId = await ctx.db.insert("documents", {
        projectId: newProjectId,
        type: doc.type,
        title: doc.title,
        content: doc.content,
        contentText: doc.contentText,
        orderIndex: doc.orderIndex,
        wordCount: doc.wordCount,
        beat: doc.beat,
        tensionLevel: doc.tensionLevel,
        povCharacterId: doc.povCharacterId ? entityIdMap.get(doc.povCharacterId) : undefined,
        locationId: doc.locationId ? entityIdMap.get(doc.locationId) : undefined,
        createdAt: now,
        updatedAt: now,
      });
      documentIdMap.set(doc._id, newDocId);
    }

    // Process children (may need multiple passes for deep nesting)
    let remaining = childDocs;
    let maxIterations = 10; // Prevent infinite loops

    while (remaining.length > 0 && maxIterations > 0) {
      const stillRemaining: typeof remaining = [];

      for (const doc of remaining) {
        const newParentId = doc.parentId ? documentIdMap.get(doc.parentId) : undefined;

        if (doc.parentId && !newParentId) {
          // Parent not yet processed, try again next iteration
          stillRemaining.push(doc);
          continue;
        }

        const newDocId = await ctx.db.insert("documents", {
          projectId: newProjectId,
          parentId: newParentId,
          type: doc.type,
          title: doc.title,
          content: doc.content,
          contentText: doc.contentText,
          orderIndex: doc.orderIndex,
          wordCount: doc.wordCount,
          beat: doc.beat,
          tensionLevel: doc.tensionLevel,
          povCharacterId: doc.povCharacterId ? entityIdMap.get(doc.povCharacterId) : undefined,
          locationId: doc.locationId ? entityIdMap.get(doc.locationId) : undefined,
          createdAt: now,
          updatedAt: now,
        });
        documentIdMap.set(doc._id, newDocId);
      }

      remaining = stillRemaining;
      maxIterations--;
    }

    return newProjectId;
  },
});
