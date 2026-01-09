/**
 * ProseMirror sync API (Convex component)
 *
 * Exposes sync endpoints for TipTap collaboration and keeps document
 * snapshots in the canonical documents table.
 */

import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { verifyDocumentAccess, verifyProjectEditor } from "./lib/auth";

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

function extractTextFromProseMirror(doc: unknown): string {
  const parts: string[] = [];

  const walk = (node: any) => {
    if (!node) return;

    if (node.type === "text") {
      parts.push(String(node.text ?? ""));
      return;
    }

    if (node.type === "hard_break") {
      parts.push("\n");
      return;
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        walk(child);
      }
      if (BLOCK_NODE_TYPES.has(node.type)) {
        parts.push("\n");
      }
    }
  };

  walk(doc);

  return parts
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const {
  getSnapshot,
  submitSnapshot,
  latestVersion,
  getSteps,
  submitSteps,
} = prosemirrorSync.syncApi({
  checkRead: async (ctx, id) => {
    await verifyDocumentAccess(ctx, id as Id<"documents">);
  },
  checkWrite: async (ctx, id) => {
    const { projectId } = await verifyDocumentAccess(ctx, id as Id<"documents">);
    await verifyProjectEditor(ctx, projectId);
  },
  onSnapshot: async (ctx, id, snapshot) => {
    const documentId = id as Id<"documents">;
    const document = await ctx.db.get(documentId);
    if (!document) return;

    try {
      const parsed = JSON.parse(snapshot) as Record<string, unknown>;
      const contentText = extractTextFromProseMirror(parsed);
      const wordCount = contentText ? contentText.split(/\s+/).filter(Boolean).length : 0;

      await ctx.db.patch(documentId, {
        content: parsed,
        contentText,
        wordCount,
        updatedAt: Date.now(),
      });

      await ctx.runMutation((internal as any)["ai/embeddings"].enqueueEmbeddingJob, {
        projectId: document.projectId,
        targetType: "document",
        targetId: documentId,
      });
    } catch (error) {
      console.error("[prosemirrorSync] Failed to parse snapshot:", error);
    }
  },
});
