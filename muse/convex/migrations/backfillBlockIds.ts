/**
 * Backfill missing blockId attributes on existing documents.
 */

import { v } from "convex/values";
import { internalAction, internalQuery } from "../_generated/server";
import { components, internal } from "../_generated/api";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { EditorState } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { getEditorSchema } from "../lib/editorSchema";

const prosemirrorSync = new ProsemirrorSync(components.prosemirrorSync);

const BLOCK_NODE_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "bulletList",
  "orderedList",
  "codeBlock",
  "table",
  "tableRow",
  "tableCell",
]);

function buildBackfillTransaction(doc: ProseMirrorNode) {
  const tr = EditorState.create({ doc }).tr;
  let changed = false;

  doc.descendants((node, pos) => {
    if (!BLOCK_NODE_TYPES.has(node.type.name)) return;
    const blockId = node.attrs?.["blockId"] as string | undefined;
    if (!blockId) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: crypto.randomUUID() });
      changed = true;
    }
  });

  return changed ? tr : null;
}

export const listDocumentsForBackfill = internalQuery({
  args: {
    projectId: v.optional(v.id("projects")),
    documentId: v.optional(v.id("documents")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, documentId, limit = 50 }) => {
    if (documentId) {
      return [{ _id: documentId }];
    }

    if (projectId) {
      return ctx.db
        .query("documents")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .take(limit);
    }

    return ctx.db.query("documents").take(limit);
  },
});

export const backfillBlockIds = internalAction({
  args: {
    projectId: v.optional(v.id("projects")),
    documentId: v.optional(v.id("documents")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, documentId, limit = 50 }) => {
    const schema = getEditorSchema();
    const documents = await ctx.runQuery(
      (internal as any)["migrations/backfillBlockIds"].listDocumentsForBackfill,
      { projectId, documentId, limit }
    );

    let updated = 0;
    let skipped = 0;

    for (const doc of documents) {
      const result = await prosemirrorSync.transform(ctx, doc._id, schema, (currentDoc) => {
        return buildBackfillTransaction(currentDoc);
      });

      if (result) {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    return { updated, skipped };
  },
});
