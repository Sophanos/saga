/**
 * AI Memory Delete Edge Function
 *
 * POST /ai-memory-delete
 *
 * Deletes memories by IDs or filter criteria.
 * Part of the Writer Memory Layer (MLP 1.5).
 *
 * Request Body:
 * {
 *   projectId: string,
 *   memoryIds?: string[],        // Delete specific IDs
 *   category?: MemoryCategory,   // Delete by category
 *   scope?: MemoryScope,         // Delete by scope
 *   conversationId?: string,     // Required for conversation scope
 *   olderThan?: string           // Delete memories older than (ISO timestamp)
 * }
 *
 * Response:
 * { deletedCount: number }
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
import {
  deletePoints,
  deletePointsByFilter,
  countPoints,
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
  VALID_CATEGORIES,
  VALID_SCOPES,
} from "../_shared/memory/types.ts";

// =============================================================================
// Types
// =============================================================================

interface MemoryDeleteRequest {
  projectId: string;
  memoryIds?: string[];
  category?: MemoryCategory;
  scope?: MemoryScope;
  conversationId?: string;
  olderThan?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build filter conditions for memory deletion.
 */
function buildDeleteFilter(params: {
  projectId: string;
  category?: MemoryCategory;
  scope?: MemoryScope;
  ownerId?: string;
  conversationId?: string;
  olderThanTs?: number;
}): QdrantFilter {
  const must: QdrantCondition[] = [
    { key: "type", match: { value: "memory" } },
    { key: "project_id", match: { value: params.projectId } },
  ];

  // Category filter
  if (params.category) {
    must.push({ key: "category", match: { value: params.category } });
  }

  // Scope filter
  if (params.scope) {
    must.push({ key: "scope", match: { value: params.scope } });

    // For user/conversation scope, also filter by owner
    if (params.scope !== "project" && params.ownerId) {
      must.push({ key: "owner_id", match: { value: params.ownerId } });
    }

    // For conversation scope, also filter by conversation
    if (params.scope === "conversation" && params.conversationId) {
      must.push({ key: "conversation_id", match: { value: params.conversationId } });
    }
  }

  // Older than filter (using numeric timestamp for range query)
  if (params.olderThanTs) {
    must.push({
      key: "created_at_ts",
      range: { lt: params.olderThanTs },
    });
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
      endpoint: "embed",
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

    const request = validation.data as unknown as MemoryDeleteRequest;

    // Limit memoryIds array size to prevent DoS
    const MAX_DELETE_IDS = 100;
    if (request.memoryIds && request.memoryIds.length > MAX_DELETE_IDS) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Cannot delete more than ${MAX_DELETE_IDS} memories at once`,
        origin
      );
    }

    // Validate that at least one filter is provided
    if (
      !request.memoryIds?.length &&
      !request.category &&
      !request.scope &&
      !request.olderThan
    ) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "At least one of memoryIds, category, scope, or olderThan must be provided",
        origin
      );
    }

    // Validate category
    if (request.category && !VALID_CATEGORIES.includes(request.category)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        origin
      );
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

    // Validate olderThan is valid ISO timestamp
    let olderThanTs: number | undefined;
    if (request.olderThan) {
      const parsed = new Date(request.olderThan);
      if (isNaN(parsed.getTime())) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "olderThan must be a valid ISO timestamp",
          origin
        );
      }
      olderThanTs = parsed.getTime();
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

    // Determine owner ID for scoped deletion
    const ownerId = userId ?? billing.anonDeviceId ?? undefined;

    let deletedCount = 0;

    if (request.memoryIds?.length) {
      // Delete by specific IDs with project filter for security
      console.log(
        `[ai-memory-delete] Deleting ${request.memoryIds.length} memories by ID`
      );

      // Use filter-based delete to ensure IDs belong to the project (prevents IDOR)
      const filter: QdrantFilter = {
        must: [
          { key: "type", match: { value: "memory" } },
          { key: "project_id", match: { value: request.projectId } },
          { key: "memory_id", match: { any: request.memoryIds } },
        ],
      };
      deletedCount = await countPoints(filter);
      if (deletedCount > 0) {
        await deletePointsByFilter(filter);
      }
    } else {
      // Delete by filter
      const filter = buildDeleteFilter({
        projectId: request.projectId,
        category: request.category,
        scope: request.scope,
        ownerId,
        conversationId: request.conversationId,
        olderThanTs,
      });

      // Count before delete (for accurate response)
      deletedCount = await countPoints(filter);

      if (deletedCount > 0) {
        console.log(`[ai-memory-delete] Deleting ${deletedCount} memories by filter`);
        await deletePointsByFilter(filter);
      }
    }

    console.log(`[ai-memory-delete] Deleted ${deletedCount} memories`);

    return createSuccessResponse({ deletedCount }, origin);
  } catch (error) {
    console.error("[ai-memory-delete] Error:", error);
    return handleAIError(error, origin, { operation: "memory-delete" });
  }
});
