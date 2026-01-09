/**
 * Document revisions (version history) and restore helpers.
 */

import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { api, components, internal } from "./_generated/api";
import { verifyDocumentAccess } from "./lib/auth";
import { hashSnapshot } from "./lib/contentHash";
import { getEditorSchema } from "./lib/editorSchema";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { EditorState } from "@tiptap/pm/state";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);
const AUTO_REVISION_THROTTLE_MS = 60_000;
const apiAny = api as any;
const internalAny = internal as any;

export const listByDocument = query({
  args: {
    documentId: v.id("documents"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.number()),
  },
  handler: async (ctx, { documentId, limit = 50, cursor }) => {
    await verifyDocumentAccess(ctx, documentId);

    const query = ctx.db
      .query("documentRevisions")
      .withIndex("by_document_createdAt", (q) =>
        cursor
          ? q.eq("documentId", documentId).lt("createdAt", cursor)
          : q.eq("documentId", documentId)
      )
      .order("desc");

    return query.take(limit);
  },
});

export const getRevision = query({
  args: { revisionId: v.id("documentRevisions") },
  handler: async (ctx, { revisionId }) => {
    const revision = await ctx.db.get(revisionId);
    if (!revision) return null;
    await verifyDocumentAccess(ctx, revision.documentId);
    return revision;
  },
});

export const getLatestByDocument = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    return ctx.db
      .query("documentRevisions")
      .withIndex("by_document_createdAt", (q) => q.eq("documentId", documentId))
      .order("desc")
      .first();
  },
});

export const createRevisionInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    snapshotJson: v.string(),
    contentHash: v.optional(v.string()),
    prosemirrorVersion: v.optional(v.number()),
    reason: v.string(),
    actorType: v.string(),
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    toolName: v.optional(v.string()),
    summary: v.optional(v.string()),
    sourceSuggestionId: v.optional(v.string()),
    sourceStreamId: v.optional(v.string()),
    sourceRevisionId: v.optional(v.id("documentRevisions")),
    wordCount: v.optional(v.number()),
    deltaWordCount: v.optional(v.number()),
    metadata: v.optional(v.any()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const contentHash = args.contentHash ?? (await hashSnapshot(args.snapshotJson));

    const latest = await ctx.db
      .query("documentRevisions")
      .withIndex("by_document_createdAt", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .first();

    if (!args.force) {
      if (latest && latest.contentHash === contentHash) {
        return latest._id;
      }

      if (args.reason === "auto" && latest && now - latest.createdAt < AUTO_REVISION_THROTTLE_MS) {
        return latest._id;
      }
    }

    const deltaWordCount =
      args.deltaWordCount ??
      (typeof args.wordCount === "number" && typeof latest?.wordCount === "number"
        ? args.wordCount - latest.wordCount
        : undefined);

    const revisionId = await ctx.db.insert("documentRevisions", {
      projectId: args.projectId,
      documentId: args.documentId,
      snapshotJson: args.snapshotJson,
      contentHash,
      prosemirrorVersion: args.prosemirrorVersion,
      reason: args.reason,
      actorType: args.actorType,
      actorUserId: args.actorUserId,
      actorAgentId: args.actorAgentId,
      actorName: args.actorName,
      toolName: args.toolName,
      summary: args.summary,
      sourceSuggestionId: args.sourceSuggestionId,
      sourceStreamId: args.sourceStreamId,
      sourceRevisionId: args.sourceRevisionId,
      wordCount: args.wordCount,
      deltaWordCount,
      createdAt: now,
      metadata: args.metadata,
    });

    if (args.reason !== "auto") {
      await ctx.db.insert("activityLog", {
        projectId: args.projectId,
        documentId: args.documentId,
        actorType: args.actorType,
        actorUserId: args.actorUserId,
        actorAgentId: args.actorAgentId,
        actorName: args.actorName,
        action: "revision_created",
        summary: args.summary ?? `Revision created (${args.reason})`,
        metadata: {
          revisionId,
          reason: args.reason,
          sourceSuggestionId: args.sourceSuggestionId,
          sourceStreamId: args.sourceStreamId,
          sourceRevisionId: args.sourceRevisionId,
        },
        createdAt: now,
      });
    }

    return revisionId;
  },
});

export const patchRevisionMetadata = internalMutation({
  args: {
    revisionId: v.id("documentRevisions"),
    reason: v.optional(v.string()),
    actorType: v.optional(v.string()),
    actorUserId: v.optional(v.string()),
    actorAgentId: v.optional(v.string()),
    actorName: v.optional(v.string()),
    summary: v.optional(v.string()),
    toolName: v.optional(v.string()),
    sourceRevisionId: v.optional(v.id("documentRevisions")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { revisionId, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    if (Object.keys(cleanUpdates).length === 0) return revisionId;
    await ctx.db.patch(revisionId, cleanUpdates);
    return revisionId;
  },
});

export const restoreRevision = action({
  args: {
    documentId: v.id("documents"),
    revisionId: v.id("documentRevisions"),
  },
  handler: async (ctx, { documentId, revisionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const document = (await (ctx.runQuery as any)(
      apiAny.documents.get,
      { id: documentId }
    )) as any;
    if (!document) {
      throw new Error("Document not found");
    }

    const isEditor = await (ctx.runQuery as any)(
      internalAny.collaboration.isProjectEditor,
      { projectId: document.projectId, userId: identity.subject }
    );
    if (!isEditor) {
      throw new Error("Edit access denied");
    }

    const revision = await (ctx.runQuery as any)(apiAny.revisions.getRevision, { revisionId });
    if (!revision) {
      throw new Error("Revision not found");
    }

    const schema = getEditorSchema();
    const targetDoc = schema.nodeFromJSON(JSON.parse(revision.snapshotJson));

    await prosemirrorSync.transform(ctx, documentId, schema, (doc) => {
      const tr = EditorState.create({ doc }).tr;
      tr.replaceWith(0, doc.content.size, targetDoc.content);
      return tr;
    });

    const contentHash = await hashSnapshot(revision.snapshotJson);
    const latest = await (ctx.runQuery as any)(
      internalAny.revisions.getLatestByDocument,
      { documentId }
    );

    if (
      latest &&
      latest.contentHash === contentHash &&
      Date.now() - latest.createdAt < 10_000
    ) {
      await ctx.runMutation((internal as any).revisions.patchRevisionMetadata, {
        revisionId: latest._id,
        reason: "restore",
        actorType: "user",
        actorUserId: identity.subject,
        summary: `Restored revision ${revisionId}`,
        toolName: "restore_revision",
        sourceRevisionId: revisionId,
      });
    } else {
      await ctx.runMutation((internal as any).revisions.createRevisionInternal, {
        projectId: document.projectId,
        documentId,
        snapshotJson: revision.snapshotJson,
        contentHash,
        wordCount: revision.wordCount,
        reason: "restore",
        actorType: "user",
        actorUserId: identity.subject,
        toolName: "restore_revision",
        sourceRevisionId: revisionId,
        force: true,
      });
    }

    await ctx.runMutation((internal as any).activity.emit, {
      projectId: document.projectId,
      documentId,
      actorType: "user",
      actorUserId: identity.subject,
      action: "revision_restored",
      summary: `Restored revision ${revisionId}`,
      metadata: {
        revisionId,
      },
    });

    return { success: true };
  },
});
