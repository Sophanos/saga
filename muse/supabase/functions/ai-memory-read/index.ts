/**
 * AI Memory Read Edge Function
 *
 * POST /ai-memory-read
 *
 * Queries memories by semantic relevance and/or recency.
 * Part of the Writer Memory Layer (MLP 1.5).
 *
 * Request Body:
 * {
 *   projectId: string,
 *   query?: string,              // Semantic search query (optional)
 *   categories?: MemoryCategory[],
 *   scope?: MemoryScope,
 *   conversationId?: string,     // Required for conversation scope
 *   limit?: number,              // Default 20
 *   recencyWeight?: number       // 0-1 blend factor (default 0.2)
 * }
 *
 * Response:
 * { memories: MemoryRecord[] }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import { generateEmbedding, isDeepInfraConfigured } from "../_shared/deepinfra.ts";
import {
  searchPoints,
  scrollPoints,
  isQdrantConfigured,
  type QdrantFilter,
  type QdrantCondition,
} from "../_shared/qdrant.ts";
import { assertProjectAccess, ProjectAccessError } from "../_shared/projects.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
} from "../_shared/billing.ts";
import {
  type MemoryCategory,
  type MemoryScope,
  type MemoryRecord,
  VALID_CATEGORIES,
  VALID_SCOPES,
} from "../_shared/memory/types.ts";

// =============================================================================
// Types
// =============================================================================

interface MemoryReadRequest {
  projectId: string;
  query?: string;
  categories?: MemoryCategory[];
  scope?: MemoryScope;
  conversationId?: string;
  limit?: number;
  recencyWeight?: number;
}

// Extended MemoryRecord with score for search results
interface ScoredMemoryRecord extends MemoryRecord {
  score?: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_RECENCY_WEIGHT = 0.2;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate recency score (0-1) based on creation timestamp.
 * More recent = higher score.
 */
function calculateRecencyScore(createdAtTs: number, nowMs: number): number {
  const ageMs = nowMs - createdAtTs;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;

  // Score decays from 1.0 to 0.0 over a week
  if (ageMs <= 0) return 1.0;
  if (ageMs >= oneWeekMs) return 0.0;
  return 1.0 - ageMs / oneWeekMs;
}

/**
 * Parse memory record from Qdrant payload.
 */
function parseMemoryFromPayload(
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
    content: String(payload.text ?? ""),
    metadata: {
      source: payload.source,
      confidence: payload.confidence,
      entityIds: payload.entity_ids,
      documentId: payload.document_id,
      conversationId: payload.conversation_id,
      toolCallId: payload.tool_call_id,
      toolName: payload.tool_name,
      expiresAt: payload.expires_at,
    },
    createdAt: String(payload.created_at ?? new Date().toISOString()),
    updatedAt: payload.updated_at ? String(payload.updated_at) : undefined,
    score,
  };
}

/**
 * Build filter conditions for memory query.
 */
function buildMemoryFilter(params: {
  projectId: string;
  categories?: MemoryCategory[];
  scope?: MemoryScope;
  ownerId?: string;
  conversationId?: string;
}): QdrantFilter {
  const must: QdrantCondition[] = [
    { key: "type", match: { value: "memory" } },
    { key: "project_id", match: { value: params.projectId } },
  ];

  // Category filter
  if (params.categories && params.categories.length > 0) {
    if (params.categories.length === 1) {
      must.push({ key: "category", match: { value: params.categories[0] } });
    } else {
      must.push({ key: "category", match: { any: params.categories } });
    }
  }

  // Scope filter
  if (params.scope) {
    must.push({ key: "scope", match: { value: params.scope } });

    // For conversation scope, also filter by conversation
    if (params.scope === "conversation" && params.conversationId) {
      must.push({ key: "conversation_id", match: { value: params.conversationId } });
    }
  }

  // Always filter by owner for non-project scopes to prevent privacy leaks
  // This ensures user/conversation-scoped memories are only visible to their owner,
  // even when no explicit scope is requested
  if (params.ownerId) {
    if (params.scope !== "project") {
      must.push({ key: "owner_id", match: { value: params.ownerId } });
    }
  }

  return { must };
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST
  if (req.method !== "POST") {
    return createErrorResponse(ErrorCode.BAD_REQUEST, "Method not allowed", origin);
  }

  // Check infrastructure
  if (!isQdrantConfigured()) {
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Memory system not configured",
      origin
    );
  }

  const supabase = createSupabaseClient();

  try {
    // Check billing (allow anonymous trial)
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "search",
      allowAnonymousTrial: true,
    });
    if (!billing.canProceed) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "Unable to process request",
        origin,
        billing.errorCode ? { code: billing.errorCode } : undefined
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(ErrorCode.BAD_REQUEST, "Invalid JSON", origin);
    }

    // Validate required fields
    const validation = validateRequestBody(body, ["projectId"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as MemoryReadRequest;

    // Validate categories
    if (request.categories) {
      const invalidCategories = request.categories.filter(
        (c) => !VALID_CATEGORIES.includes(c)
      );
      if (invalidCategories.length > 0) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Invalid categories: ${invalidCategories.join(", ")}`,
          origin
        );
      }
    }

    // Validate scope
    if (request.scope && !VALID_SCOPES.includes(request.scope)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Invalid scope. Must be one of: ${VALID_SCOPES.join(", ")}`,
        origin
      );
    }

    // Validate conversation scope requires conversationId
    if (request.scope === "conversation" && !request.conversationId) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "conversationId is required for conversation scope",
        origin
      );
    }

    // Verify project access
    const userId = billing.userId;
    try {
      await assertProjectAccess(supabase, request.projectId, userId);
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        return createErrorResponse(ErrorCode.FORBIDDEN, error.message, origin);
      }
      throw error;
    }

    // Determine owner ID for scoped queries
    const ownerId = userId ?? billing.anonDeviceId ?? undefined;

    // Normalize limit
    const limit = Math.min(Math.max(1, request.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const recencyWeight = Math.min(
      Math.max(0, request.recencyWeight ?? DEFAULT_RECENCY_WEIGHT),
      1
    );

    // Build filter
    const filter = buildMemoryFilter({
      projectId: request.projectId,
      categories: request.categories,
      scope: request.scope,
      ownerId,
      conversationId: request.conversationId,
    });

    let memories: ScoredMemoryRecord[];

    if (request.query && isDeepInfraConfigured()) {
      // Semantic search with query
      console.log(`[ai-memory-read] Semantic search: "${request.query.slice(0, 50)}..."`);

      const embedding = await generateEmbedding(request.query);
      const results = await searchPoints(embedding, limit * 2, filter);

      const nowMs = Date.now();

      // Parse and score results
      memories = results
        .map((result) => {
          const memory = parseMemoryFromPayload(
            String(result.id),
            result.payload,
            result.score
          );

          // Blend similarity and recency
          const createdAtTs =
            (result.payload.created_at_ts as number) ??
            new Date(memory.createdAt).getTime();
          const recencyScore = calculateRecencyScore(createdAtTs, nowMs);
          const blendedScore =
            (1 - recencyWeight) * result.score + recencyWeight * recencyScore;

          return { ...memory, score: blendedScore };
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);
    } else {
      // Scroll without query (sorted by recency)
      console.log("[ai-memory-read] Scroll without query");

      const results = await scrollPoints(filter, limit * 2);

      // Parse and sort by creation time
      memories = results
        .map((result) => parseMemoryFromPayload(result.id, result.payload))
        .sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime; // Most recent first
        })
        .slice(0, limit);
    }

    console.log(`[ai-memory-read] Returning ${memories.length} memories`);

    return createSuccessResponse({ memories }, origin);
  } catch (error) {
    console.error("[ai-memory-read] Error:", error);
    return handleAIError(error, origin, { operation: "memory-read" });
  }
});
