/**
 * AI Memory Read Edge Function (MLP 2.x)
 *
 * POST /ai-memory-read
 *
 * Queries memories by semantic relevance and/or recency.
 * Prefers Qdrant for ranking; falls back to Postgres if unavailable.
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
  QdrantError,
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
import {
  getMemoryPolicyConfig,
  isMemoryExpired,
  calculateCombinedScore,
  type MemoryPolicyConfig,
} from "../_shared/memoryPolicy.ts";

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
 * Parse memory record from Postgres row.
 */
function parseMemoryFromRow(row: Record<string, unknown>): ScoredMemoryRecord {
  const metadata = row.metadata as Record<string, unknown> | null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    category: String(row.category) as MemoryCategory,
    scope: String(row.scope) as MemoryScope,
    ownerId: row.owner_id ? String(row.owner_id) : undefined,
    content: String(row.content),
    metadata: metadata
      ? {
          source: metadata.source,
          confidence: metadata.confidence as number | undefined,
          entityIds: metadata.entity_ids as string[] | undefined,
          documentId: metadata.document_id as string | undefined,
          conversationId: row.conversation_id as string | undefined,
          toolCallId: metadata.tool_call_id as string | undefined,
          toolName: metadata.tool_name as string | undefined,
          expiresAt: row.expires_at as string | undefined,
        }
      : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

/**
 * Build filter conditions for Qdrant memory query.
 */
function buildQdrantFilter(params: {
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
  if (params.ownerId) {
    if (params.scope !== "project") {
      must.push({ key: "owner_id", match: { value: params.ownerId } });
    }
  }

  return { must };
}

/**
 * Filter expired memories and apply decay scoring.
 */
function filterAndScoreMemories(
  memories: ScoredMemoryRecord[],
  recencyWeight: number
): ScoredMemoryRecord[] {
  const nowMs = Date.now();
  const policyConfig = getMemoryPolicyConfig();

  return memories
    .filter((m) => {
      // Check expiration using policy
      const createdAtTs = new Date(m.createdAt).getTime();
      const expiresAtTs = m.metadata?.expiresAt
        ? new Date(m.metadata.expiresAt).getTime()
        : undefined;

      return !isMemoryExpired({
        category: m.category,
        createdAtTs,
        expiresAtTs,
      });
    })
    .map((m) => {
      // Apply decay-aware scoring if we have a base score
      if (m.score !== undefined) {
        const createdAtTs = new Date(m.createdAt).getTime();
        const combinedScore = calculateCombinedScore({
          similarityScore: m.score,
          createdAtTs,
          category: m.category,
          similarityWeight: 1 - recencyWeight,
          nowMs,
        });
        return { ...m, score: combinedScore };
      }
      return m;
    });
}

/**
 * Query memories from Qdrant with semantic search.
 */
async function queryQdrant(params: {
  query: string;
  filter: QdrantFilter;
  limit: number;
  recencyWeight: number;
}): Promise<ScoredMemoryRecord[]> {
  const embedding = await generateEmbedding(params.query);
  const results = await searchPoints(embedding, params.limit * 2, params.filter);

  const memories = results.map((result) =>
    parseMemoryFromPayload(String(result.id), result.payload, result.score)
  );

  return filterAndScoreMemories(memories, params.recencyWeight)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, params.limit);
}

/**
 * Query memories from Qdrant without semantic search (scroll).
 */
async function scrollQdrant(params: {
  filter: QdrantFilter;
  limit: number;
  recencyWeight: number;
}): Promise<ScoredMemoryRecord[]> {
  const results = await scrollPoints(params.filter, params.limit * 2);

  const memories = results.map((result) =>
    parseMemoryFromPayload(result.id, result.payload)
  );

  return filterAndScoreMemories(memories, params.recencyWeight)
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime; // Most recent first
    })
    .slice(0, params.limit);
}

/**
 * Query memories from Postgres with semantic search (fallback).
 */
async function queryPostgresSemantic(
  supabase: ReturnType<typeof createSupabaseClient>,
  params: {
    query: string;
    projectId: string;
    categories?: MemoryCategory[];
    scope?: MemoryScope;
    ownerId?: string;
    conversationId?: string;
    limit: number;
    recencyWeight: number;
  }
): Promise<ScoredMemoryRecord[]> {
  // Generate embedding for semantic search
  const embedding = await generateEmbedding(params.query);

  // Call the Postgres RPC function
  const { data, error } = await supabase.rpc("search_memories", {
    query_embedding: embedding,
    match_count: params.limit * 2,
    project_filter: params.projectId,
    category_filter: params.categories ?? null,
    scope_filter: params.scope ?? null,
    owner_filter: params.ownerId ?? null,
    conversation_filter: params.conversationId ?? null,
  });

  if (error) {
    console.error("[ai-memory-read] Postgres semantic search failed:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  const memories = (data ?? []).map(
    (row: Record<string, unknown> & { similarity: number }) => ({
      ...parseMemoryFromRow(row),
      score: row.similarity,
    })
  );

  return filterAndScoreMemories(memories, params.recencyWeight)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, params.limit);
}

/**
 * Query memories from Postgres with recency only (fallback).
 */
async function queryPostgresRecency(
  supabase: ReturnType<typeof createSupabaseClient>,
  params: {
    projectId: string;
    categories?: MemoryCategory[];
    scope?: MemoryScope;
    ownerId?: string;
    conversationId?: string;
    limit: number;
    recencyWeight: number;
  }
): Promise<ScoredMemoryRecord[]> {
  let query = supabase
    .from("memories")
    .select("*")
    .eq("project_id", params.projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(params.limit * 2);

  // Apply filters
  if (params.categories && params.categories.length > 0) {
    query = query.in("category", params.categories);
  }

  if (params.scope) {
    query = query.eq("scope", params.scope);
  }

  if (params.ownerId && params.scope !== "project") {
    query = query.eq("owner_id", params.ownerId);
  }

  if (params.conversationId) {
    query = query.eq("conversation_id", params.conversationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[ai-memory-read] Postgres query failed:", error);
    throw new Error(`Database error: ${error.message}`);
  }

  const memories = (data ?? []).map((row: Record<string, unknown>) =>
    parseMemoryFromRow(row)
  );

  return filterAndScoreMemories(memories, params.recencyWeight).slice(
    0,
    params.limit
  );
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

    // Enforce owner isolation for user/conversation scope
    if (request.scope && request.scope !== "project" && !ownerId) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Owner identification required for user/conversation scoped memories",
        origin
      );
    }

    // Normalize limit
    const limit = Math.min(Math.max(1, request.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const recencyWeight = Math.min(
      Math.max(0, request.recencyWeight ?? DEFAULT_RECENCY_WEIGHT),
      1
    );

    let memories: ScoredMemoryRecord[];

    // Try Qdrant first if configured
    const qdrantAvailable = isQdrantConfigured();
    const embeddingAvailable = isDeepInfraConfigured();

    if (qdrantAvailable) {
      try {
        const filter = buildQdrantFilter({
          projectId: request.projectId,
          categories: request.categories,
          scope: request.scope,
          ownerId,
          conversationId: request.conversationId,
        });

        if (request.query && embeddingAvailable) {
          console.log(`[ai-memory-read] Qdrant semantic search: "${request.query.slice(0, 50)}..."`);
          memories = await queryQdrant({
            query: request.query,
            filter,
            limit,
            recencyWeight,
          });
        } else {
          console.log("[ai-memory-read] Qdrant scroll (no query)");
          memories = await scrollQdrant({
            filter,
            limit,
            recencyWeight,
          });
        }
      } catch (error) {
        // Qdrant failed - fall back to Postgres
        const errorMessage =
          error instanceof QdrantError ? error.message : (error as Error).message;
        console.warn(
          `[ai-memory-read] Qdrant failed, falling back to Postgres: ${errorMessage}`
        );

        // Postgres fallback
        if (request.query && embeddingAvailable) {
          console.log("[ai-memory-read] Postgres semantic fallback");
          memories = await queryPostgresSemantic(supabase, {
            query: request.query,
            projectId: request.projectId,
            categories: request.categories,
            scope: request.scope,
            ownerId,
            conversationId: request.conversationId,
            limit,
            recencyWeight,
          });
        } else {
          console.log("[ai-memory-read] Postgres recency fallback");
          memories = await queryPostgresRecency(supabase, {
            projectId: request.projectId,
            categories: request.categories,
            scope: request.scope,
            ownerId,
            conversationId: request.conversationId,
            limit,
            recencyWeight,
          });
        }
      }
    } else {
      // Qdrant not configured - use Postgres directly
      console.log("[ai-memory-read] Qdrant not configured, using Postgres");

      if (request.query && embeddingAvailable) {
        memories = await queryPostgresSemantic(supabase, {
          query: request.query,
          projectId: request.projectId,
          categories: request.categories,
          scope: request.scope,
          ownerId,
          conversationId: request.conversationId,
          limit,
          recencyWeight,
        });
      } else {
        memories = await queryPostgresRecency(supabase, {
          projectId: request.projectId,
          categories: request.categories,
          scope: request.scope,
          ownerId,
          conversationId: request.conversationId,
          limit,
          recencyWeight,
        });
      }
    }

    console.log(`[ai-memory-read] Returning ${memories.length} memories`);

    return createSuccessResponse({ memories }, origin);
  } catch (error) {
    console.error("[ai-memory-read] Error:", error);
    return handleAIError(error, origin, { providerName: "memory-read" });
  }
});
