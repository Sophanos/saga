/**
 * Convex Documents Functions
 *
 * CRUD operations for documents (chapters, scenes, notes).
 * Real-time subscriptions for collaborative editing.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { verifyProjectAccess, verifyDocumentAccess } from "./lib/auth";

// ============================================================
// QUERIES
// ============================================================

/**
 * List all documents for a project
 */
export const list = query({
  args: {
    projectId: v.id("projects"),
    type: v.optional(v.string()),
    parentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const { projectId, type, parentId } = args;

    // Verify user has access to this project
    await verifyProjectAccess(ctx, projectId);

    let documents;

    if (parentId !== undefined) {
      // Get children of a specific parent
      documents = await ctx.db
        .query("documents")
        .withIndex("by_parent", (q) => q.eq("parentId", parentId))
        .collect();
    } else if (type) {
      // Filter by type
      documents = await ctx.db
        .query("documents")
        .withIndex("by_project_type", (q) =>
          q.eq("projectId", projectId).eq("type", type)
        )
        .collect();
    } else {
      // Get all documents for project
      documents = await ctx.db
        .query("documents")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
    }

    // Sort by orderIndex
    return documents.sort((a, b) => a.orderIndex - b.orderIndex);
  },
});

/**
 * Get a single document by ID
 */
export const get = query({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args) => {
    // Verify user has access via document's project
    await verifyDocumentAccess(ctx, args.id);
    return await ctx.db.get(args.id);
  },
});

/**
 * Get document tree (hierarchical structure)
 */
export const getTree = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Build tree structure
    const rootDocs = documents
      .filter((d) => !d.parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const buildTree = (
      parent: (typeof documents)[0]
    ): (typeof documents)[0] & { children: typeof documents } => {
      const children = documents
        .filter((d) => d.parentId === parent._id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(buildTree);

      return { ...parent, children };
    };

    return rootDocs.map(buildTree);
  },
});

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Create a new document
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    type: v.string(),
    title: v.optional(v.string()),
    content: v.optional(v.any()),
    contentText: v.optional(v.string()),
    parentId: v.optional(v.id("documents")),
    orderIndex: v.optional(v.number()),
    beat: v.optional(v.string()),
    tensionLevel: v.optional(v.number()),
    povCharacterId: v.optional(v.id("entities")),
    locationId: v.optional(v.id("entities")),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();

    // Calculate orderIndex if not provided
    let orderIndex = args.orderIndex;
    if (orderIndex === undefined) {
      const siblings = await ctx.db
        .query("documents")
        .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
        .collect();
      orderIndex = siblings.length;
    }

    // Calculate word count from content text
    const wordCount = args.contentText
      ? args.contentText.split(/\s+/).filter(Boolean).length
      : 0;

    const id = await ctx.db.insert("documents", {
      projectId: args.projectId,
      type: args.type,
      title: args.title,
      content: args.content,
      contentText: args.contentText,
      parentId: args.parentId,
      orderIndex,
      wordCount,
      beat: args.beat,
      tensionLevel: args.tensionLevel,
      povCharacterId: args.povCharacterId,
      locationId: args.locationId,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update a document
 */
export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.any()),
    contentText: v.optional(v.string()),
    orderIndex: v.optional(v.number()),
    beat: v.optional(v.string()),
    tensionLevel: v.optional(v.number()),
    povCharacterId: v.optional(v.id("entities")),
    locationId: v.optional(v.id("entities")),
  },
  handler: async (ctx, args) => {
    const { id, contentText, ...updates } = args;

    // Verify user has access via document's project
    await verifyDocumentAccess(ctx, id);

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Add contentText if provided
    if (contentText !== undefined) {
      cleanUpdates.contentText = contentText;
      cleanUpdates.wordCount = contentText
        .split(/\s+/)
        .filter(Boolean).length;
    }

    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Move a document (change parent or reorder)
 */
export const move = mutation({
  args: {
    id: v.id("documents"),
    newParentId: v.optional(v.id("documents")),
    newOrderIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, newParentId, newOrderIndex } = args;

    // Verify user has access via document's project
    await verifyDocumentAccess(ctx, id);

    const document = await ctx.db.get(id);
    if (!document) {
      throw new Error("Document not found");
    }

    // Get siblings at the new location
    const siblings = await ctx.db
      .query("documents")
      .withIndex("by_parent", (q) => q.eq("parentId", newParentId))
      .collect();

    // Reorder siblings
    const reorderedSiblings = siblings
      .filter((s) => s._id !== id)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    // Insert at new position
    reorderedSiblings.splice(newOrderIndex, 0, { ...document, _id: id } as typeof document);

    // Update all orderIndexes
    for (let i = 0; i < reorderedSiblings.length; i++) {
      await ctx.db.patch(reorderedSiblings[i]._id, {
        orderIndex: i,
        parentId: newParentId,
        updatedAt: Date.now(),
      });
    }

    return id;
  },
});

/**
 * Internal recursive delete helper
 * Uses internalMutation for proper recursive calls
 */
export const removeInternal = internalMutation({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const { id } = args;

    // Recursively delete children
    const children = await ctx.db
      .query("documents")
      .withIndex("by_parent", (q) => q.eq("parentId", id))
      .collect();

    for (const child of children) {
      await ctx.runMutation(internal.documents.removeInternal, { id: child._id });
    }

    // Delete mentions in this document
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect();

    for (const mention of mentions) {
      await ctx.db.delete(mention._id);
    }

    // Delete the document
    await ctx.db.delete(id);

    return id;
  },
});

/**
 * Delete a document and its children
 */
export const remove = mutation({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, args) => {
    // Verify user has access via document's project
    await verifyDocumentAccess(ctx, args.id);

    // Delegate to internal mutation for recursive delete
    await ctx.runMutation(internal.documents.removeInternal, { id: args.id });
    return args.id;
  },
});

/**
 * Bulk create documents (for import/migration)
 */
export const bulkCreate = mutation({
  args: {
    projectId: v.id("projects"),
    documents: v.array(
      v.object({
        type: v.string(),
        title: v.optional(v.string()),
        content: v.optional(v.any()),
        contentText: v.optional(v.string()),
        orderIndex: v.number(),
        supabaseId: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Verify user has access to this project
    await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();
    const ids: Id<"documents">[] = [];

    for (const doc of args.documents) {
      const wordCount = doc.contentText
        ? doc.contentText.split(/\s+/).filter(Boolean).length
        : 0;

      const id = await ctx.db.insert("documents", {
        projectId: args.projectId,
        type: doc.type,
        title: doc.title,
        content: doc.content,
        contentText: doc.contentText,
        orderIndex: doc.orderIndex,
        wordCount,
        supabaseId: doc.supabaseId,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }

    return ids;
  },
});
