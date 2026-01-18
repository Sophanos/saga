import { v } from "convex/values";
import { action, internalMutation } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { generateEmbeddings, isDeepInfraConfigured } from "../../lib/embeddings";
import { isQdrantConfigured } from "../../lib/qdrant";
import { searchSessionVectors } from "../../lib/qdrantSessionVectors";

const internal = require("../../_generated/api").internal as any;

const OVERUSE_WORDS = [
  "very",
  "really",
  "just",
  "actually",
  "basically",
  "literally",
];

type CoherenceSignalInput = {
  projectId: Id<"projects">;
  documentId: Id<"documents">;
  userId: string;
  sessionId?: string;
  type: "overuse";
  severity: "low" | "medium" | "high";
  text: string;
  message: string;
  suggestion?: string;
  anchorStart?: { blockId: string; offset: number };
  anchorEnd?: { blockId: string; offset: number };
  from?: number;
  to?: number;
  sourceRef?: Record<string, unknown>;
};

export const upsertCoherenceSignalsInternal = internalMutation({
  args: {
    signals: v.array(v.any()),
  },
  handler: async (ctx, { signals }) => {
    const now = Date.now();
    const ids: Id<"coherenceSignals">[] = [];

    for (const signal of signals) {
      const record = signal as CoherenceSignalInput;
      const id = await ctx.db.insert("coherenceSignals", {
        projectId: record.projectId,
        documentId: record.documentId,
        userId: record.userId,
        sessionId: record.sessionId,
        type: record.type,
        severity: record.severity,
        anchorStart: record.anchorStart,
        anchorEnd: record.anchorEnd,
        from: record.from,
        to: record.to,
        text: record.text,
        message: record.message,
        explanation: undefined,
        suggestion: record.suggestion,
        canonSource: undefined,
        status: "active",
        sourceKind: "flow_realtime",
        sourceRef: record.sourceRef,
        visibility: { scope: "project" },
        createdAt: now,
        resolvedAt: undefined,
      });
      ids.push(id);
    }

    return ids;
  },
});

export const runChecks = action({
  args: {
    sessionId: v.string(),
    documentId: v.id("documents"),
    content: v.string(),
    cursorPosition: v.number(),
    blockId: v.optional(v.string()),
  },
  handler: async (ctx, { sessionId, documentId, content, cursorPosition, blockId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const runtimeSession = await ctx.runQuery(
      (internal as any)["ai/flow/runtimeSessions"].getRuntimeSessionInternal,
      { sessionId }
    );
    if (!runtimeSession || runtimeSession.userId !== userId) {
      throw new Error("Invalid session");
    }

    const document = await ctx.runQuery(
      (internal as any)["ai/analysisJobs"].getDocumentForAnalysis,
      { id: documentId }
    );
    if (!document) throw new Error("Document not found");

    let semanticMatches: Array<{ score: number; kind: string; sourceId: string }> = [];
    if (isQdrantConfigured() && isDeepInfraConfigured()) {
      const text = content.trim();
      if (text) {
        const { embeddings } = await generateEmbeddings([text], { task: "embed_document" });
        const vector = embeddings?.[0];
        if (vector) {
          const results = await searchSessionVectors({
            projectId: String(runtimeSession.projectId),
            sessionId,
            vector,
            limit: 5,
          });
          semanticMatches = results.map((result) => ({
            score: result.score,
            kind: result.kind,
            sourceId: result.sourceId,
          }));
        }
      }
    }

    const tokens = content
      .toLowerCase()
      .replace(/[^a-z\s']/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    const counts = new Map<string, number>();
    for (const token of tokens) {
      if (!OVERUSE_WORDS.includes(token)) continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }

    const signals: CoherenceSignalInput[] = [];
    for (const [word, count] of counts.entries()) {
      if (count < 3) continue;
      const message = `Overuse: "${word}" appears ${count} times in the recent snippet.`;
      signals.push({
        projectId: runtimeSession.projectId as Id<"projects">,
        documentId,
        userId,
        sessionId,
        type: "overuse",
        severity: count >= 5 ? "medium" : "low",
        text: content.slice(0, 240),
        message,
        suggestion: `Consider reducing repeated use of "${word}" in this passage.`,
        anchorStart: blockId ? { blockId, offset: cursorPosition } : undefined,
        anchorEnd: blockId ? { blockId, offset: cursorPosition } : undefined,
        sourceRef: semanticMatches.length > 0 ? { semanticMatches } : undefined,
      });
    }

    if (signals.length > 0) {
      await ctx.runMutation(
        (internal as any)["ai/flow/runChecks"].upsertCoherenceSignalsInternal,
        { signals }
      );
    }

    return {
      signals: signals.map((signal) => ({
        type: signal.type,
        severity: signal.severity,
        message: signal.message,
        suggestion: signal.suggestion,
      })),
    };
  },
});
