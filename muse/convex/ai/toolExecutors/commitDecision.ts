import { internal } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { generateEmbedding, isDeepInfraConfigured } from "../../lib/embeddings";
import { isQdrantConfigured, namedDense } from "../../lib/qdrant";
import { upsertPointsForWrite } from "../../lib/qdrantCollections";
import {
  MAX_DECISION_EMBEDDING_CHARS,
  MAX_DECISION_LENGTH,
  QDRANT_TEXT_VECTOR,
} from "./constants";

interface CommitDecisionInput {
  decision: string;
  category?: "decision" | "policy";
  rationale?: string;
  entityIds?: string[];
  documentId?: string;
  confidence?: number;
  pinned?: boolean;
}

interface CommitDecisionResult {
  memoryId: string;
  content: string;
}

export async function executeCommitDecision(
  ctx: ActionCtx,
  input: CommitDecisionInput,
  projectId: string,
  userId: string,
  source?: {
    suggestionId?: string;
    toolCallId?: string;
    streamId?: string;
    threadId?: string;
    promptMessageId?: string;
    model?: string;
  }
): Promise<CommitDecisionResult> {
  // Validate input
  const decision = input.decision?.trim();
  if (!decision) {
    throw new Error("decision is required and cannot be empty");
  }
  if (input.category && input.category !== "decision" && input.category !== "policy") {
    throw new Error('category must be "decision" or "policy"');
  }
  if (decision.length > MAX_DECISION_LENGTH) {
    throw new Error(`decision exceeds maximum length of ${MAX_DECISION_LENGTH} characters`);
  }

  if (!isDeepInfraConfigured()) {
    throw new Error("Embedding service not configured");
  }

  // Build content with rationale
  const rationale = input.rationale?.trim();
  const content = rationale
    ? `Decision: ${decision}\nRationale: ${rationale}`
    : decision;

  if (content.length > MAX_DECISION_LENGTH) {
    throw new Error(`decision content exceeds maximum length of ${MAX_DECISION_LENGTH} characters`);
  }

  // Generate embedding
  const embeddingText = content.length > MAX_DECISION_EMBEDDING_CHARS
    ? content.slice(0, MAX_DECISION_EMBEDDING_CHARS)
    : content;

  const embedding = await generateEmbedding(embeddingText, { task: "embed_document" });
  const now = Date.now();
  const isoNow = new Date(now).toISOString();

  // Calculate expiry (decisions expire in 1 year by default if not pinned)
  const expiresAtMs =
    input.pinned !== false ? undefined : now + 365 * 24 * 60 * 60 * 1000;
  const expiresAtIso = expiresAtMs ? new Date(expiresAtMs).toISOString() : null;

  const memoryId = await ctx.runMutation(
    (internal as any).memories.createFromDecision,
    {
      projectId: projectId as Id<"projects">,
      userId,
      text: content,
      type: input.category ?? "decision",
      confidence: input.confidence ?? 1.0,
      source: "user",
      entityIds: input.entityIds,
      documentId: input.documentId
        ? (input.documentId as Id<"documents">)
        : undefined,
      pinned: input.pinned ?? true,
      expiresAt: expiresAtMs,
      scope: "project",
      sourceSuggestionId: source?.suggestionId
        ? (source.suggestionId as Id<"knowledgeSuggestions">)
        : undefined,
      sourceToolCallId: source?.toolCallId,
      sourceStreamId: source?.streamId,
      sourceThreadId: source?.threadId,
      promptMessageId: source?.promptMessageId,
      model: source?.model,
    }
  );

  // Build Qdrant payload
  const payload: Record<string, unknown> = {
    project_id: projectId,
    memory_id: memoryId,
    type: "memory",
    category: input.category ?? "decision",
    scope: "project",
    text: content,
    source: "user",
    confidence: input.confidence ?? 1.0,
    entity_ids: input.entityIds ?? [],
    document_id: input.documentId,
    tool_name: "commit_decision",
    pinned: input.pinned ?? true,
    created_at: isoNow,
    created_at_ts: now,
    expires_at: expiresAtIso,
  };

  // Upsert to Qdrant
  if (isQdrantConfigured()) {
    try {
      await upsertPointsForWrite(
        [{
          id: memoryId,
          vector: namedDense(QDRANT_TEXT_VECTOR, embedding),
          payload,
        }],
        "text"
      );
      console.log(`[tools.commit_decision] Stored memory ${memoryId} in Qdrant`);
      await ctx.runMutation((internal as any).memories.updateVectorStatus, {
        memoryId,
        vectorId: memoryId,
      });
    } catch (error) {
      console.error("[tools.commit_decision] Qdrant upsert failed:", error);
      await ctx.runMutation((internal as any).memories.enqueueVectorSync, {
        memoryId,
        projectId: projectId as Id<"projects">,
      });
    }
  }

  return {
    memoryId,
    content,
  };
}
