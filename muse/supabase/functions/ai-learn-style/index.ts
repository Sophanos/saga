/**
 * AI Learn Style Edge Function
 *
 * POST /ai-learn-style
 *
 * Analyzes document content to extract writing style preferences.
 * Derived preferences are stored as "style" memories.
 * Part of the Writer Memory Layer (MLP 2.x).
 *
 * Request Body:
 * {
 *   projectId: string,
 *   documentId: string,
 *   content: string,
 *   maxFindings?: number  // Default 8
 * }
 *
 * Response:
 * { learned: Array<{ id: string, content: string }> }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { generateText } from "../_shared/deps/ai.ts";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import { generateEmbeddings, isDeepInfraConfigured } from "../_shared/deepinfra.ts";
import { upsertPoints, isQdrantConfigured, QdrantError, type QdrantPoint } from "../_shared/qdrant.ts";
import { buildMemoryPayload, type MemoryPayload } from "../_shared/vectorPayload.ts";
import { assertProjectAccess, ProjectAccessError } from "../_shared/projects.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  extractTokenUsage,
} from "../_shared/billing.ts";
import { calculateExpiresAt } from "../_shared/memoryPolicy.ts";

// =============================================================================
// Types
// =============================================================================

interface LearnStyleRequest {
  projectId: string;
  documentId: string;
  content: string;
  maxFindings?: number;
}

interface StyleFinding {
  id: string;
  content: string;
}

interface ProcessedMemory {
  id: string;
  payload: MemoryPayload;
  embedding: number[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_FINDINGS = 8;
const MAX_CONTENT_LENGTH = 50000;
const MIN_CONTENT_LENGTH = 200;

// =============================================================================
// Prompt
// =============================================================================

const STYLE_EXTRACTION_PROMPT = `You are analyzing a piece of creative writing to extract the author's style preferences.

Identify specific, actionable writing style patterns. Focus on:
- Sentence structure preferences (length, complexity)
- Dialogue style (punctuation, attribution patterns)
- Description density and focus
- Pacing and rhythm
- Voice and tone characteristics
- POV handling
- Tense usage patterns
- Any distinctive stylistic choices

Output a JSON array of short, specific rules (1-2 sentences each). Each rule should be:
- Observable in this specific text
- Actionable for future writing
- Specific (avoid generic advice)

Format: ["rule 1", "rule 2", ...]

Example output:
["Prefers short, punchy sentences during action scenes", "Uses em-dashes for interruptions in dialogue", "Describes settings through character perception rather than omniscient narration"]

IMPORTANT: Output ONLY the JSON array, no other text.`;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate deterministic ID for style memory to avoid duplicates.
 */
async function generateStyleId(
  projectId: string,
  userId: string,
  rule: string
): Promise<string> {
  const normalized = rule.toLowerCase().trim().replace(/\s+/g, " ");
  const input = `${projectId}:${userId}:style:${normalized}`;

  // Use SubtleCrypto for hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex.slice(0, 32);
}

/**
 * Parse JSON array from LLM response.
 */
function parseStyleRules(response: string): string[] {
  // Try to extract JSON array from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn("[ai-learn-style] No JSON array found in response");
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      console.warn("[ai-learn-style] Parsed result is not an array");
      return [];
    }

    // Filter to strings only
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 500);
  } catch (error) {
    console.error("[ai-learn-style] Failed to parse JSON:", error);
    return [];
  }
}

/**
 * Upsert style memories to Postgres (durable source of truth).
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
    console.error("[ai-learn-style] Postgres upsert failed:", error);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Upsert memories to Qdrant (best-effort).
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
    console.warn("[ai-learn-style] Qdrant upsert failed (best-effort):", errorMessage);
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

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST
  if (req.method !== "POST") {
    return createErrorResponse(ErrorCode.BAD_REQUEST, "Method not allowed", origin);
  }

  // Check infrastructure - embeddings required for style learning
  if (!isDeepInfraConfigured()) {
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Embedding service not configured",
      origin
    );
  }

  const supabase = createSupabaseClient();

  try {
    // Check billing (requires API key for LLM call)
    const billing = await checkBillingAndGetKey(req, supabase, {
      endpoint: "agent",
      allowAnonymousTrial: true,
    });
    if (!billing.canProceed || !billing.apiKey) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "API key required for style learning",
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
    const validation = validateRequestBody(body, ["projectId", "documentId", "content"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as LearnStyleRequest;

    // Validate content length
    if (request.content.length < MIN_CONTENT_LENGTH) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Content too short. Minimum ${MIN_CONTENT_LENGTH} characters needed for style analysis.`,
        origin
      );
    }

    if (request.content.length > MAX_CONTENT_LENGTH) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Content too long. Maximum ${MAX_CONTENT_LENGTH} characters.`,
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

    const ownerId = userId ?? billing.anonDeviceId;
    if (!ownerId) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        "User identity required for style learning",
        origin
      );
    }

    const maxFindings = Math.min(
      Math.max(1, request.maxFindings ?? DEFAULT_MAX_FINDINGS),
      20
    );

    // Extract style with LLM
    console.log(`[ai-learn-style] Analyzing ${request.content.length} chars`);

    const model = getOpenRouterModel(billing.apiKey, "analysis");
    const result = await generateText({
      model,
      system: STYLE_EXTRACTION_PROMPT,
      prompt: `Analyze this text and extract up to ${maxFindings} style rules:\n\n${request.content.slice(0, 20000)}`,
      temperature: 0.3,
      maxTokens: 1024,
    });

    // Record usage
    await recordAIRequest(supabase, billing, {
      endpoint: "agent",
      model: result.response?.modelId ?? "unknown",
      modelType: "analysis",
      usage: extractTokenUsage(result.usage),
      latencyMs: Date.now() - startTime,
      metadata: { providerName: "learn-style" },
    });

    // Parse rules from response
    const rules = parseStyleRules(result.text);
    console.log(`[ai-learn-style] Extracted ${rules.length} style rules`);

    if (rules.length === 0) {
      return createSuccessResponse({ learned: [] }, origin);
    }

    const selectedRules = rules.slice(0, maxFindings);
    const learned: StyleFinding[] = [];
    const styleIds = await Promise.all(
      selectedRules.map((rule) => generateStyleId(request.projectId, ownerId, rule))
    );

    const embeddingResult = await generateEmbeddings(selectedRules);
    const expiresAt = calculateExpiresAt("style");

    const processedMemories: ProcessedMemory[] = selectedRules.map((rule, index) => {
      const memoryId = styleIds[index];

      const payload = buildMemoryPayload({
        projectId: request.projectId,
        memoryId,
        category: "style",
        scope: "user",
        text: rule,
        ownerId,
        source: "ai",
        confidence: 0.8,
        documentId: request.documentId,
        styleRuleKind: "learned",
        expiresAt,
      });

      learned.push({
        id: memoryId,
        content: rule,
      });

      return {
        id: memoryId,
        payload,
        embedding: embeddingResult.embeddings[index],
      };
    });

    console.log(`[ai-learn-style] Upserting ${processedMemories.length} style memories to Postgres`);
    await upsertToPostgres(supabase, processedMemories);

    console.log(`[ai-learn-style] Upserting ${processedMemories.length} style memories to Qdrant`);
    const qdrantResult = await upsertToQdrant(processedMemories);

    const persistedIds = processedMemories.map((m) => m.id);
    if (qdrantResult.success) {
      await updateSyncStatus(supabase, persistedIds, "synced");
    } else {
      await updateSyncStatus(supabase, persistedIds, "error", qdrantResult.error);
    }

    console.log(
      `[ai-learn-style] Stored ${learned.length} style memories ` +
      `(Qdrant: ${qdrantResult.success ? "synced" : "error"})`
    );

    return createSuccessResponse({ learned }, origin);
  } catch (error) {
    console.error("[ai-learn-style] Error:", error);
    return handleAIError(error, origin, { providerName: "learn-style" });
  }
});
