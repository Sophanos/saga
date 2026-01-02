/**
 * AI Memory Write Edge Function (MLP 2.x)
 *
 * POST /ai-memory-write
 *
 * Writes/upserts memory vectors with dual-write to Postgres + Qdrant.
 * Postgres is the durable source of truth; Qdrant is best-effort.
 *
 * Single Request Body:
 * {
 *   projectId: string,
 *   category: "style" | "decision" | "preference" | "session",
 *   content: string,
 *   scope?: "project" | "user" | "conversation",
 *   conversationId?: string,
 *   metadata?: { ... },
 *   id?: string
 * }
 *
 * Batch Request Body:
 * {
 *   projectId: string,
 *   memories: Array<{
 *     category, content, scope?, conversationId?, metadata?, id?
 *   }>
 * }
 *
 * Response:
 * Single: { memory: MemoryRecord }
 * Batch: { memories: MemoryRecord[] }
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
import { generateEmbeddings, isDeepInfraConfigured } from "../_shared/deepinfra.ts";
import { upsertPoints, isQdrantConfigured, QdrantError, type QdrantPoint } from "../_shared/qdrant.ts";
import { buildMemoryPayload, type MemoryPayload } from "../_shared/vectorPayload.ts";
import { assertProjectAccess, ProjectAccessError } from "../_shared/projects.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  type BillingCheck,
} from "../_shared/billing.ts";
import {
  type MemoryCategory,
  type MemoryScope,
  type MemoryRecord,
  VALID_CATEGORIES,
  VALID_SCOPES,
  isValidCategory,
  isValidScope,
  getDefaultScope,
} from "../_shared/memory/types.ts";
import { calculateExpiresAt } from "../_shared/memoryPolicy.ts";

// =============================================================================
// Types
// =============================================================================

interface MemoryWriteItem {
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
    pinned?: boolean;
    redacted?: boolean;
    redactedAt?: string;
    redactionReason?: string;
  };
  id?: string;
}

interface MemoryWriteSingleRequest extends MemoryWriteItem {
  projectId: string;
}

interface MemoryWriteBatchRequest {
  projectId: string;
  memories: MemoryWriteItem[];
}

type MemoryWriteRequest = MemoryWriteSingleRequest | MemoryWriteBatchRequest;

interface ProcessedMemory {
  id: string;
  payload: MemoryPayload;
  embedding: number[];
  record: MemoryRecord;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_CONTENT_LENGTH = 32000;
const MAX_BATCH_SIZE = 32;
const REDACTED_CONTENT = "[REDACTED]";

// =============================================================================
// Helpers
// =============================================================================

function isBatchRequest(req: unknown): req is MemoryWriteBatchRequest {
  return (
    typeof req === "object" &&
    req !== null &&
    "memories" in req &&
    Array.isArray((req as MemoryWriteBatchRequest).memories)
  );
}

function validateMemoryItem(
  item: MemoryWriteItem,
  index: number
): { valid: true } | { valid: false; error: string } {
  if (!isValidCategory(item.category)) {
    return {
      valid: false,
      error: `Invalid category at index ${index}. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
    };
  }

  if (item.scope && !isValidScope(item.scope)) {
    return {
      valid: false,
      error: `Invalid scope at index ${index}. Must be one of: ${VALID_SCOPES.join(", ")}`,
    };
  }

  if (!item.content || typeof item.content !== "string") {
    return {
      valid: false,
      error: `Missing content at index ${index}`,
    };
  }

  if (item.content.length > MAX_CONTENT_LENGTH) {
    return {
      valid: false,
      error: `Content too long at index ${index}. Maximum ${MAX_CONTENT_LENGTH} characters.`,
    };
  }

  const scope = item.scope ?? getDefaultScope(item.category);
  if (scope === "conversation" && !item.conversationId) {
    return {
      valid: false,
      error: `conversationId required for conversation scope at index ${index}`,
    };
  }

  return { valid: true };
}

/**
 * Upsert memories to Postgres (required, durable).
 */
async function upsertToPostgres(
  supabase: ReturnType<typeof createSupabaseClient>,
  memories: ProcessedMemory[]
): Promise<void> {
  const { error } = await supabase.from("memories").upsert(
    memories.map((m) => ({
      id: m.id,
      project_id: m.payload.project_id,
      category: m.payload.category,
      scope: m.payload.scope,
      owner_id: m.payload.owner_id ?? null,
      conversation_id: m.payload.conversation_id ?? null,
      content: m.payload.text,
      metadata: {
        source: m.payload.source,
        confidence: m.payload.confidence,
        entity_ids: m.payload.entity_ids,
        document_id: m.payload.document_id,
        tool_call_id: m.payload.tool_call_id,
        tool_name: m.payload.tool_name,
        pinned: m.payload.pinned,
        redacted: m.payload.redacted,
        redacted_at: m.payload.redacted_at,
        redaction_reason: m.payload.redaction_reason,
      },
      created_at: m.payload.created_at,
      updated_at: m.payload.updated_at,
      created_at_ts: m.payload.created_at_ts,
      expires_at: m.payload.expires_at ?? null,
      expires_at_ts: m.payload.expires_at
        ? new Date(m.payload.expires_at).getTime()
        : null,
      embedding: m.embedding,
      qdrant_sync_status: "pending",
    })),
    { onConflict: "id" }
  );

  if (error) {
    console.error("[ai-memory-write] Postgres upsert failed:", error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Upsert memories to Qdrant (best-effort).
 * Returns true if successful, false if failed.
 */
async function upsertToQdrant(
  memories: ProcessedMemory[]
): Promise<{ success: boolean; error?: string }> {
  if (!isQdrantConfigured()) {
    return { success: false, error: "Qdrant not configured" };
  }

  try {
    const points: QdrantPoint[] = memories.map((m) => ({
      id: m.id,
      vector: m.embedding,
      payload: m.payload as unknown as Record<string, unknown>,
    }));

    await upsertPoints(points);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof QdrantError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Unknown Qdrant error";
    console.warn("[ai-memory-write] Qdrant upsert failed (best-effort):", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Update Qdrant sync status in Postgres.
 */
async function updateSyncStatus(
  supabase: ReturnType<typeof createSupabaseClient>,
  memoryIds: string[],
  status: "synced" | "error",
  error?: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    qdrant_sync_status: status,
  };

  if (status === "synced") {
    updates.qdrant_synced_at = new Date().toISOString();
  } else if (error) {
    updates.qdrant_last_error = error;
  }

  await supabase
    .from("memories")
    .update(updates)
    .in("id", memoryIds);
}

async function fetchExistingMemories(
  supabase: ReturnType<typeof createSupabaseClient>,
  projectId: string,
  ids: string[]
): Promise<Map<string, { createdAt: string; createdAtTs: number; expiresAt?: string }>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("memories")
    .select("id, created_at, created_at_ts, expires_at")
    .eq("project_id", projectId)
    .in("id", ids);

  if (error) {
    console.warn("[ai-memory-write] Failed to load existing memories:", error);
    return new Map();
  }

  const byId = new Map<string, { createdAt: string; createdAtTs: number; expiresAt?: string }>();
  for (const row of data ?? []) {
    if (row?.id && row.created_at && row.created_at_ts) {
      byId.set(String(row.id), {
        createdAt: String(row.created_at),
        createdAtTs: Number(row.created_at_ts),
        expiresAt: row.expires_at ? String(row.expires_at) : undefined,
      });
    }
  }

  return byId;
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

  // Check infrastructure - DeepInfra is required for embeddings
  if (!isDeepInfraConfigured()) {
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Embedding service not configured",
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

    // Determine if batch or single request
    const isBatch = isBatchRequest(body);

    // Validate projectId
    const validation = validateRequestBody(body, ["projectId"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const projectId = (body as { projectId: string }).projectId;

    // Verify project access
    const userId = billing.userId;
    try {
      await assertProjectAccess(supabase, projectId, userId);
    } catch (error) {
      if (error instanceof ProjectAccessError) {
        return createErrorResponse(ErrorCode.FORBIDDEN, error.message, origin);
      }
      throw error;
    }

    // Determine owner ID for scoped memories
    const ownerId = userId ?? billing.anonDeviceId ?? undefined;

    // Collect items to process
    let items: MemoryWriteItem[];

    if (isBatch) {
      const batchReq = body as MemoryWriteBatchRequest;

      // Validate batch size
      if (batchReq.memories.length === 0) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "Batch must contain at least one memory",
          origin
        );
      }
      if (batchReq.memories.length > MAX_BATCH_SIZE) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
          origin
        );
      }

      // Validate each item
      for (let i = 0; i < batchReq.memories.length; i++) {
        const itemValidation = validateMemoryItem(batchReq.memories[i], i);
        if (!itemValidation.valid) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            itemValidation.error,
            origin
          );
        }
      }

      // Enforce owner isolation for user/conversation scopes
      for (const item of batchReq.memories) {
        const scope = item.scope ?? getDefaultScope(item.category);
        if (scope !== "project" && !ownerId) {
          return createErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            "Owner identification required for user/conversation scoped memories",
            origin
          );
        }
      }

      items = batchReq.memories;
    } else {
      // Single request - validate as before
      const singleValidation = validateRequestBody(body, ["projectId", "category", "content"]);
      if (!singleValidation.valid) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Missing required fields: ${singleValidation.missing.join(", ")}`,
          origin
        );
      }

      const singleReq = body as MemoryWriteSingleRequest;
      const itemValidation = validateMemoryItem(singleReq, 0);
      if (!itemValidation.valid) {
        return createErrorResponse(ErrorCode.VALIDATION_ERROR, itemValidation.error, origin);
      }

      // Enforce owner isolation
      const scope = singleReq.scope ?? getDefaultScope(singleReq.category);
      if (scope !== "project" && !ownerId) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "Owner identification required for user/conversation scoped memories",
          origin
        );
      }

      items = [singleReq];
    }

    const preparedItems = items.map((item) => {
      const memoryId = item.id ?? crypto.randomUUID();
      const scope = item.scope ?? getDefaultScope(item.category);
      const redacted = item.metadata?.redacted === true;
      const content = redacted ? REDACTED_CONTENT : item.content;
      return { item, memoryId, scope, redacted, content };
    });

    const existingById = await fetchExistingMemories(
      supabase,
      projectId,
      preparedItems.filter((prepared) => Boolean(prepared.item.id)).map((prepared) => prepared.memoryId)
    );

    // Generate embeddings in batch
    console.log(
      `[ai-memory-write] Generating embeddings for ${preparedItems.length} memories`
    );
    const embeddingResult = await generateEmbeddings(
      preparedItems.map((prepared) => prepared.content)
    );
    const embeddings = embeddingResult.embeddings;

    // Process each memory
    const processedMemories: ProcessedMemory[] = preparedItems.map((prepared, i) => {
      const { item, memoryId, scope, redacted, content } = prepared;
      const existing = existingById.get(memoryId);

      // Calculate expiration based on policy or explicit metadata
      const expiresAt =
        item.metadata?.expiresAt ??
        existing?.expiresAt ??
        calculateExpiresAt(item.category);

      const redactedAt = redacted
        ? item.metadata?.redactedAt ?? new Date().toISOString()
        : undefined;

      const payload = buildMemoryPayload({
        projectId,
        memoryId,
        category: item.category,
        scope,
        text: content,
        ownerId: scope === "project" ? undefined : ownerId,
        conversationId: item.conversationId,
        source: item.metadata?.source,
        confidence: item.metadata?.confidence,
        entityIds: item.metadata?.entityIds,
        documentId: item.metadata?.documentId,
        toolCallId: item.metadata?.toolCallId,
        toolName: item.metadata?.toolName,
        expiresAt,
        pinned: item.metadata?.pinned,
        redacted,
        redactedAt,
        redactionReason: item.metadata?.redactionReason,
        createdAt: existing?.createdAt,
        createdAtTs: existing?.createdAtTs,
      });

      const record: MemoryRecord = {
        id: memoryId,
        projectId,
        category: item.category,
        scope,
        ownerId: scope === "project" ? undefined : ownerId,
        content,
        metadata: {
          ...item.metadata,
          conversationId: item.conversationId,
          redacted,
          redactedAt,
        },
        createdAt: payload.created_at,
        updatedAt: payload.updated_at,
      };

      return {
        id: memoryId,
        payload,
        embedding: embeddings[i],
        record,
      };
    });

    // Step 1: Upsert to Postgres (required)
    console.log(`[ai-memory-write] Upserting ${processedMemories.length} memories to Postgres`);
    await upsertToPostgres(supabase, processedMemories);

    // Step 2: Upsert to Qdrant (best-effort)
    console.log(`[ai-memory-write] Upserting ${processedMemories.length} memories to Qdrant`);
    const qdrantResult = await upsertToQdrant(processedMemories);

    // Step 3: Update sync status
    const memoryIds = processedMemories.map((m) => m.id);
    if (qdrantResult.success) {
      await updateSyncStatus(supabase, memoryIds, "synced");
    } else {
      await updateSyncStatus(supabase, memoryIds, "error", qdrantResult.error);
    }

    console.log(
      `[ai-memory-write] Successfully wrote ${processedMemories.length} memories ` +
      `(Qdrant: ${qdrantResult.success ? "synced" : "pending"})`
    );

    // Return response
    if (isBatch) {
      return createSuccessResponse(
        { memories: processedMemories.map((m) => m.record) },
        origin
      );
    } else {
      return createSuccessResponse({ memory: processedMemories[0].record }, origin);
    }
  } catch (error) {
    console.error("[ai-memory-write] Error:", error);
    return handleAIError(error, origin, { providerName: "memory-write" });
  }
});
