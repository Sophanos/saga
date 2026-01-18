import { v } from "convex/values";
import { action } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { generateEmbeddings, isDeepInfraConfigured } from "../../lib/embeddings";
import { isQdrantConfigured } from "../../lib/qdrant";
import { upsertSessionVectors } from "../../lib/qdrantSessionVectors";

const internal = require("../../_generated/api").internal as any;

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_DOC_SNIPPET_CHARS = 1200;

export const startSession = action({
  args: {
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),
    facetOverride: v.optional(v.any()),
  },
  handler: async (ctx, { projectId, documentId, facetOverride }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const role = await ctx.runQuery((internal as any).collaboration.getMemberRole, {
      projectId,
      userId,
    });
    if (!role) throw new Error("Access denied");

    let document: { contentText?: string } | null = null;
    if (documentId) {
      document = await ctx.runQuery(
        (internal as any)["ai/analysisJobs"].getDocumentForAnalysis,
        { id: documentId }
      );
      if (!document) {
        throw new Error("Document not found");
      }
    }

    const now = Date.now();
    const sessionId = crypto.randomUUID();

    await ctx.runMutation(
      (internal as any)["ai/flow/runtimeSessions"].createRuntimeSessionInternal,
      {
        projectId,
        documentId,
        userId,
        sessionId,
        status: "active",
        facetOverride,
        proactivityMode: undefined,
        startedAt: now,
        endedAt: undefined,
        expiresAt: now + SESSION_TTL_MS,
      }
    );

    if (document && isQdrantConfigured() && isDeepInfraConfigured()) {
      const rawText = (document.contentText ?? "").trim();
      if (rawText) {
        const snippet = rawText.slice(Math.max(0, rawText.length - MAX_DOC_SNIPPET_CHARS));
        const { embeddings } = await generateEmbeddings([snippet], { task: "embed_document" });
        const vector = embeddings?.[0];
        if (vector) {
          await upsertSessionVectors({
            projectId: String(projectId),
            sessionId,
            userId,
            documentId: documentId ? String(documentId) : undefined,
            points: [
              {
                id: `${sessionId}:document_tail`,
                vector,
                kind: "document_chunk",
                sourceId: documentId ? String(documentId) : "document",
                content: snippet,
                createdAt: now,
                expiresAt: now + SESSION_TTL_MS,
                metadata: { position: "tail" },
              },
            ],
          });
        }
      }
    }

    return { sessionId };
  },
});
