/**
 * Convex Documents Functions
 *
 * CRUD operations for documents (chapters, scenes, notes).
 * Real-time subscriptions for collaborative editing.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyProjectAccess, verifyDocumentAccess, verifyProjectEditor } from "./lib/auth";
import { hashText } from "./lib/contentHash";
import { isTaskAvailable, type AITaskSlug, type TierId } from "./lib/providers";
import type { AnalysisJobKind } from "./ai/analysisJobs";
import type { DeleteDocumentResult } from "../packages/agent-protocol/src/tools";

async function enqueueDocumentAnalysisJobs(
  ctx: MutationCtx,
  params: {
    projectId: Id<"projects">;
    documentId: Id<"documents">;
    userId: string;
    contentText: string;
    source: "document_create" | "document_update";
  }
): Promise<void> {
  const contentHash = await hashText(params.contentText);
  const debounceMs = 3000;
  const tierId = (await ctx.runQuery(
    (internal as any)["lib/entitlements"].getUserTierInternal,
    { userId: params.userId }
  )) as TierId;

  const analysisJobs: Array<{ kind: AnalysisJobKind; taskSlug: AITaskSlug }> = [
    { kind: "detect_entities", taskSlug: "detect" },
    { kind: "coherence_lint", taskSlug: "lint" },
    { kind: "clarity_check", taskSlug: "clarity_check" },
    { kind: "policy_check", taskSlug: "policy_check" },
    { kind: "digest_document", taskSlug: "summarize" },
  ];

  const eligibleJobs = analysisJobs.filter((jobSpec) =>
    isTaskAvailable(jobSpec.taskSlug, tierId)
  );

  await Promise.all(
    eligibleJobs.map((jobSpec) =>
      ctx.runMutation((internal as any)["ai/analysisJobs"].enqueueAnalysisJob, {
        projectId: params.projectId,
        userId: params.userId,
        documentId: params.documentId,
        kind: jobSpec.kind,
        payload: { source: params.source },
        contentHash,
        debounceMs,
      })
    )
  );

  if (eligibleJobs.length > 0) {
    await ctx.scheduler.runAfter(
      debounceMs,
      (internal as any)["ai/analysis/processAnalysisJobs"].processAnalysisJobs,
      { batchSize: 10 }
    );
  }
}

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

    documents = documents.filter((doc) => doc.deletedAt == null);

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

    const activeDocuments = documents.filter((doc) => doc.deletedAt == null);

    // Build tree structure
    const rootDocs = activeDocuments
      .filter((d) => !d.parentId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const buildTree = (
      parent: (typeof documents)[0]
    ): (typeof documents)[0] & { children: typeof documents } => {
      const children = activeDocuments
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
    const { userId } = await verifyProjectAccess(ctx, args.projectId);

    const now = Date.now();

    // Calculate orderIndex if not provided
    let orderIndex = args.orderIndex;
    if (orderIndex === undefined) {
      const siblings =
        args.parentId !== undefined
          ? await ctx.db
              .query("documents")
              .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
              .collect()
          : (await ctx.db
              .query("documents")
              .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
              .collect()
            ).filter((doc) => doc.parentId == null);
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

    await ctx.runMutation((internal as any)["ai/analysisJobs"].enqueueEmbeddingJob, {
      projectId: args.projectId,
      userId,
      targetType: "document",
      targetId: id,
      documentId: id,
    });

    if (args.contentText !== undefined) {
      await enqueueDocumentAnalysisJobs(ctx, {
        projectId: args.projectId,
        documentId: id,
        userId,
        contentText: args.contentText,
        source: "document_create",
      });
    }

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
    const { userId } = await verifyDocumentAccess(ctx, id);

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    // Add contentText if provided
    if (contentText !== undefined) {
      cleanUpdates["contentText"] = contentText;
      cleanUpdates["wordCount"] = contentText
        .split(/\s+/)
        .filter(Boolean).length;
    }

    await ctx.db.patch(id, {
      ...cleanUpdates,
      updatedAt: Date.now(),
    });

    const document = await ctx.db.get(id);
    if (document) {
      await ctx.runMutation((internal as any)["ai/analysisJobs"].enqueueEmbeddingJob, {
        projectId: document.projectId,
        userId,
        targetType: "document",
        targetId: document._id,
        documentId: document._id,
      });

      if (contentText !== undefined) {
        await enqueueDocumentAnalysisJobs(ctx, {
          projectId: document.projectId,
          documentId: document._id,
          userId,
          contentText,
          source: "document_update",
        });
      }
    }

    return id;
  },
});

export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DeleteDocumentResult> => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    const userId = await verifyProjectEditor(ctx, document.projectId);

    const now = Date.now();

    await ctx.db.patch(args.documentId, {
      deletedAt: now,
      deletedByUserId: userId,
      updatedAt: now,
    });

    try {
      await ctx.runMutation((internal as any).revisions.createRevisionInternal, {
        projectId: document.projectId,
        documentId: document._id,
        snapshotJson: JSON.stringify(document.content ?? null),
        reason: "delete",
        actorType: "user",
        actorUserId: userId,
        actorName: undefined,
        toolName: "delete_document",
        summary: args.reason?.trim() ? `Deleted: ${args.reason.trim()}` : "Document deleted",
        metadata: { deletedAt: now },
        force: true,
      });
    } catch (error) {
      console.warn("[documents.deleteDocument] Failed to write revision", error);
    }

    return { documentId: args.documentId, status: "deleted" };
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
    const siblings =
      newParentId !== undefined
        ? await ctx.db
            .query("documents")
            .withIndex("by_parent", (q) => q.eq("parentId", newParentId))
            .collect()
        : (await ctx.db
            .query("documents")
            .withIndex("by_project", (q) => q.eq("projectId", document.projectId))
            .collect()
          ).filter((doc) => doc.parentId == null);

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
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const { id, projectId } = args;

    // Recursively delete children
    const children = await ctx.db
      .query("documents")
      .withIndex("by_parent", (q) => q.eq("parentId", id))
      .collect();

    for (const child of children) {
      await ctx.runMutation(internal.documents.removeInternal, {
        id: child._id,
        projectId,
      });
    }

    // Delete mentions in this document
    const mentions = await ctx.db
      .query("mentions")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect();

    for (const mention of mentions) {
      await ctx.db.delete(mention._id);
    }

    await ctx.runMutation(internal.maintenance.enqueueVectorDeleteJob, {
      projectId,
      targetType: "document",
      targetId: id,
      reason: "document_deleted",
    });

    await ctx.runMutation((internal as any)["ai/analysisJobs"].deleteEmbeddingJobsForTarget, {
      projectId,
      targetType: "document",
      targetId: id,
    });

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

    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error("Document not found");
    }

    // Delegate to internal mutation for recursive delete
    await ctx.runMutation(internal.documents.removeInternal, {
      id: args.id,
      projectId: document.projectId,
    });
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
