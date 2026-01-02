/**
 * Shared memory parsing functions for edge functions.
 *
 * Consolidates duplicate parseMemoryFromPayload implementations
 * from retrieval.ts and ai-memory-read/index.ts.
 */

import { getPayloadText } from "../vectorPayload.ts";
import type {
  RetrievedMemoryRecord,
  MemoryCategory,
  MemoryScope,
  MemoryRecord,
} from "./types.ts";

// =============================================================================
// Simple Parser (for context retrieval)
// =============================================================================

/**
 * Parse memory record from Qdrant payload.
 *
 * Returns a lightweight RetrievedMemoryRecord suitable for
 * context injection into AI prompts.
 *
 * Used by: retrieveMemoryContext in retrieval.ts
 */
export function parseMemoryFromPayload(
  id: string,
  payload: Record<string, unknown>,
  score?: number
): RetrievedMemoryRecord {
  return {
    id,
    content: getPayloadText(payload),
    category: String(payload.category ?? "preference"),
    score,
    createdAt: payload.created_at as string | undefined,
    createdAtTs: payload.created_at_ts as number | undefined,
    expiresAt: payload.expires_at as string | undefined,
    pinned: payload.pinned as boolean | undefined,
    redacted: payload.redacted as boolean | undefined,
  };
}

// =============================================================================
// Full Parser (for API responses)
// =============================================================================

/**
 * Typed metadata for scored memory records.
 */
export interface ScoredMemoryMetadata {
  source?: unknown;
  confidence?: unknown;
  entityIds?: unknown;
  documentId?: unknown;
  conversationId?: unknown;
  toolCallId?: unknown;
  toolName?: unknown;
  expiresAt?: string;
  pinned?: boolean;
  redacted?: boolean;
  redactedAt?: string;
  redactionReason?: string;
  scoreBreakdown?: {
    similarityScore?: number;
    decayFactor?: number;
    combinedScore?: number;
    ageMs?: number;
  };
}

/**
 * Extended MemoryRecord with optional score for search results.
 * Uses typed metadata for proper type checking in consumers.
 */
export interface ScoredMemoryRecord extends Omit<MemoryRecord, 'metadata'> {
  metadata?: ScoredMemoryMetadata;
  score?: number;
}

/**
 * Parse full memory record from Qdrant payload.
 *
 * Returns a complete ScoredMemoryRecord with all metadata,
 * suitable for API responses.
 *
 * Used by: ai-memory-read endpoint
 */
export function parseFullMemoryFromPayload(
  id: string,
  payload: Record<string, unknown>,
  score?: number
): ScoredMemoryRecord {
  return {
    id,
    projectId: String(payload.project_id ?? ""),
    category: String(payload.category ?? "preference") as MemoryCategory,
    scope: String(payload.scope ?? "user") as MemoryScope,
    ownerId: payload.owner_id ? String(payload.owner_id) : undefined,
    content: getPayloadText(payload),
    metadata: {
      source: payload.source,
      confidence: payload.confidence,
      entityIds: payload.entity_ids,
      documentId: payload.document_id,
      conversationId: payload.conversation_id,
      toolCallId: payload.tool_call_id,
      toolName: payload.tool_name,
      expiresAt: payload.expires_at as string | undefined,
      pinned: payload.pinned as boolean | undefined,
      redacted: payload.redacted as boolean | undefined,
      redactedAt: payload.redacted_at as string | undefined,
      redactionReason: payload.redaction_reason as string | undefined,
      scoreBreakdown: payload.score_breakdown as {
        similarityScore?: number;
        decayFactor?: number;
        combinedScore?: number;
        ageMs?: number;
      } | undefined,
    },
    createdAt: String(payload.created_at ?? new Date().toISOString()),
    updatedAt: payload.updated_at ? String(payload.updated_at) : undefined,
    score,
  };
}
