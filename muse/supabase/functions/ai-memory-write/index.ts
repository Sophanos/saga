/**
 * AI Memory Write Edge Function
 *
 * POST /ai-memory-write
 *
 * Writes/upserts a memory vector into Qdrant.
 * Part of the Writer Memory Layer (MLP 1.5).
 *
 * Request Body:
 * {
 *   projectId: string,
 *   category: "style" | "decision" | "preference" | "session",
 *   content: string,
 *   scope?: "project" | "user" | "conversation",
 *   conversationId?: string,
 *   metadata?: { entityIds?, documentId?, confidence?, source?, toolCallId?, toolName?, expiresAt? },
 *   id?: string  // Optional for deterministic upsert
 * }
 *
 * Response:
 * { memory: MemoryRecord }
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
import { upsertPoints, isQdrantConfigured, type QdrantPoint } from "../_shared/qdrant.ts";
import { buildMemoryPayload } from "../_shared/vectorPayload.ts";
import { assertProjectAccess, ProjectAccessError } from "../_shared/projects.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  type BillingCheck,
} from "../_shared/billing.ts";

// =============================================================================
// Types
// =============================================================================

type MemoryCategory = "style" | "decision" | "preference" | "session";
type MemoryScope = "project" | "user" | "conversation";

interface MemoryWriteRequest {
  projectId: string;
  category: MemoryCategory;
  content: string;
  scope?: MemoryScope;
  conversationId?: string;
  metadata?: {
    entityIds?: string[];
    documentId?: string;
    confidence?: number;
    source?: "user" | "ai" | "system";
    toolCallId?: string;
    toolName?: string;
    expiresAt?: string;
  };
  id?: string;
}

interface MemoryRecord {
  id: string;
  projectId: string;
  category: MemoryCategory;
  scope: MemoryScope;
  ownerId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_CONTENT_LENGTH = 32000;
const VALID_CATEGORIES: MemoryCategory[] = ["style", "decision", "preference", "session"];
const VALID_SCOPES: MemoryScope[] = ["project", "user", "conversation"];

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get default scope for a category.
 */
function getDefaultScope(category: MemoryCategory): MemoryScope {
  switch (category) {
    case "decision":
      return "project";
    case "session":
      return "conversation";
    default:
      return "user";
  }
}

/**
 * Validate category.
 */
function isValidCategory(category: unknown): category is MemoryCategory {
  return typeof category === "string" && VALID_CATEGORIES.includes(category as MemoryCategory);
}

/**
 * Validate scope.
 */
function isValidScope(scope: unknown): scope is MemoryScope {
  return typeof scope === "string" && VALID_SCOPES.includes(scope as MemoryScope);
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
  if (!isDeepInfraConfigured() || !isQdrantConfigured()) {
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
    const validation = validateRequestBody(body, ["projectId", "category", "content"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as MemoryWriteRequest;

    // Validate category
    if (!isValidCategory(request.category)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
        origin
      );
    }

    // Validate scope if provided
    if (request.scope && !isValidScope(request.scope)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Invalid scope. Must be one of: ${VALID_SCOPES.join(", ")}`,
        origin
      );
    }

    // Validate content length
    if (request.content.length > MAX_CONTENT_LENGTH) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Content too long. Maximum ${MAX_CONTENT_LENGTH} characters.`,
        origin
      );
    }

    // Validate conversation scope requires conversationId
    const scope = request.scope ?? getDefaultScope(request.category);
    if (scope === "conversation" && !request.conversationId) {
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

    // Determine owner ID
    const ownerId =
      scope === "project" ? undefined : userId ?? billing.anonDeviceId ?? undefined;

    // Generate memory ID
    const memoryId = request.id ?? crypto.randomUUID();

    // Generate embedding
    console.log(`[ai-memory-write] Generating embedding for memory ${memoryId}`);
    const embedding = await generateEmbedding(request.content);

    // Build payload
    const payload = buildMemoryPayload({
      projectId: request.projectId,
      memoryId,
      category: request.category,
      scope,
      text: request.content,
      ownerId,
      conversationId: request.conversationId,
      source: request.metadata?.source,
      confidence: request.metadata?.confidence,
      entityIds: request.metadata?.entityIds,
      documentId: request.metadata?.documentId,
      toolCallId: request.metadata?.toolCallId,
      toolName: request.metadata?.toolName,
      expiresAt: request.metadata?.expiresAt,
    });

    // Create Qdrant point
    const point: QdrantPoint = {
      id: memoryId,
      vector: embedding,
      payload: payload as unknown as Record<string, unknown>,
    };

    // Upsert to Qdrant
    await upsertPoints([point]);

    console.log(`[ai-memory-write] Memory ${memoryId} written successfully`);

    // Build response
    const memory: MemoryRecord = {
      id: memoryId,
      projectId: request.projectId,
      category: request.category,
      scope,
      ownerId,
      content: request.content,
      metadata: request.metadata,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
    };

    return createSuccessResponse({ memory }, origin);
  } catch (error) {
    console.error("[ai-memory-write] Error:", error);
    return handleAIError(error, origin, { operation: "memory-write" });
  }
});
