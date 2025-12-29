/**
 * AI Dynamics Edge Function
 *
 * POST /ai-dynamics
 *
 * Extracts character interactions and events from prose using AI.
 * Supports BYOK (Bring Your Own Key) via x-openrouter-key header.
 *
 * Request Body:
 * {
 *   content: string,              // The prose text to analyze
 *   sceneMarker?: string,         // Optional scene context (e.g., "Sc 1")
 *   documentId?: string,          // Optional document ID for tracking
 *   knownEntities?: object[]      // Optional known entities for name resolution
 * }
 *
 * Response:
 * {
 *   interactions: Interaction[],
 *   summary: string,
 *   processingTimeMs: number
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { generateText } from "https://esm.sh/ai@3.4.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import { DYNAMICS_EXTRACTOR_SYSTEM } from "../_shared/prompts/dynamics.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  extractTokenUsage,
} from "../_shared/billing.ts";

/**
 * Request body interface
 */
interface DynamicsRequest {
  content: string;
  sceneMarker?: string;
  documentId?: string;
  knownEntities?: Array<{ id: string; name: string; type: string }>;
}

/**
 * Interaction type enumeration
 */
type InteractionType = "neutral" | "hostile" | "hidden" | "passive";

/**
 * Extracted interaction interface
 */
interface ExtractedInteraction {
  source: string;
  action: string;
  target: string;
  type: InteractionType;
  isHidden: boolean;
  isHostile: boolean;
  effect?: string;
  note?: string;
  sceneMarker?: string;
}

/**
 * Converted interaction matching @mythos/core Interaction type
 */
interface Interaction {
  id: string;
  source: string;
  action: string;
  target: string;
  type: InteractionType;
  time: string;
  effect?: string;
  note?: string;
  documentId?: string;
  createdAt: string;
}

/**
 * Dynamics extraction result interface
 */
interface DynamicsResult {
  interactions: Interaction[];
  summary: string;
  processingTimeMs: number;
}

/**
 * Build the extraction prompt from context
 */
function buildExtractionPrompt(request: DynamicsRequest): string {
  let prompt = `## Prose Text to Analyze:\n${request.content}`;

  if (request.sceneMarker) {
    prompt += `\n\n## Current Scene: ${request.sceneMarker}`;
  }

  if (request.knownEntities && request.knownEntities.length > 0) {
    prompt += `\n\n## Known Entities:\n${JSON.stringify(request.knownEntities, null, 2)}`;
  }

  return prompt;
}

/**
 * Generate a unique ID for an interaction
 */
function generateInteractionId(
  interaction: ExtractedInteraction,
  index: number
): string {
  const timestamp = Date.now();
  const source = interaction.source
    .toLowerCase()
    .replace(/\s+/g, "_")
    .slice(0, 10);
  const action = interaction.action.toLowerCase().slice(0, 5);
  return `int_${source}_${action}_${timestamp}_${index}`;
}

/**
 * Build the note field combining hidden flags and context
 */
function buildNote(interaction: ExtractedInteraction): string | undefined {
  const parts: string[] = [];

  if (interaction.isHidden) {
    parts.push("[HIDDEN - DM Only]");
  }

  if (interaction.isHostile) {
    parts.push("[HOSTILE]");
  }

  if (interaction.note) {
    parts.push(interaction.note);
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Convert extracted interactions to core Interaction type
 */
function convertToInteractions(
  extracted: ExtractedInteraction[],
  documentId?: string,
  defaultSceneMarker?: string
): Interaction[] {
  const now = new Date().toISOString();

  return extracted.map((ext, index) => ({
    id: generateInteractionId(ext, index),
    source: ext.source,
    action: ext.action.toUpperCase(),
    target: ext.target,
    type: ext.type,
    time: ext.sceneMarker || defaultSceneMarker || "Sc 1",
    effect: ext.effect,
    note: buildNote(ext),
    documentId,
    createdAt: now,
  }));
}

/**
 * Validate interaction type
 */
function validateInteractionType(type: unknown): InteractionType {
  const validTypes: InteractionType[] = ["neutral", "hostile", "hidden", "passive"];
  if (typeof type === "string" && validTypes.includes(type as InteractionType)) {
    return type as InteractionType;
  }
  return "neutral";
}

/**
 * Validate and normalize extracted interactions
 */
function validateInteractions(raw: unknown): ExtractedInteraction[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
    .map((item) => ({
      source: typeof item["source"] === "string" ? item["source"] : "Unknown",
      action: typeof item["action"] === "string" ? item["action"] : "UNKNOWN",
      target: typeof item["target"] === "string" ? item["target"] : "Unknown",
      type: validateInteractionType(item["type"]),
      isHidden: item["isHidden"] === true,
      isHostile: item["isHostile"] === true,
      effect: typeof item["effect"] === "string" ? item["effect"] : undefined,
      note: typeof item["note"] === "string" ? item["note"] : undefined,
      sceneMarker:
        typeof item["sceneMarker"] === "string" ? item["sceneMarker"] : undefined,
    }))
    .filter((interaction) => interaction.source && interaction.target);
}

/**
 * Get default result for error cases
 */
function getDefaultResult(processingTimeMs: number): DynamicsResult {
  return {
    interactions: [],
    summary: "Unable to extract dynamics. Please try again.",
    processingTimeMs,
  };
}

/**
 * Parse and validate the AI response
 */
function parseResponse(
  response: string,
  documentId: string | undefined,
  sceneMarker: string | undefined,
  processingTimeMs: number
): DynamicsResult {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const extractedInteractions = validateInteractions(parsed["interactions"]);
      const interactions = convertToInteractions(
        extractedInteractions,
        documentId,
        sceneMarker
      );

      const summary =
        typeof parsed["summary"] === "string"
          ? parsed["summary"]
          : "Dynamics extracted successfully.";

      return {
        interactions,
        summary,
        processingTimeMs,
      };
    }
  } catch (error) {
    console.error("[ai-dynamics] Failed to parse response:", error);
    console.debug("[ai-dynamics] Raw response:", response);
  }

  return getDefaultResult(processingTimeMs);
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.BAD_REQUEST,
      "Method not allowed. Use POST.",
      origin
    );
  }

  const supabase = createSupabaseClient();

  try {
    // Check billing and get API key
    const billing = await checkBillingAndGetKey(req, supabase);
    if (!billing.canProceed) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "Unable to process request",
        origin
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        "Invalid JSON in request body",
        origin
      );
    }

    // Validate required fields
    const validation = validateRequestBody(body, ["content"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as DynamicsRequest;

    // Validate content
    if (
      typeof request.content !== "string" ||
      request.content.trim().length === 0
    ) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "content must be a non-empty string",
        origin
      );
    }

    // Minimum content length check
    if (request.content.length < 50) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Content is too short. Provide at least 50 characters for meaningful analysis.",
        origin
      );
    }

    // Get the model (fast type for real-time extraction)
    const modelType = "fast";
    const model = getOpenRouterModel(billing.apiKey!, modelType);

    // Build the prompt
    const userPrompt = buildExtractionPrompt(request);

    // Call the AI
    const result = await generateText({
      model,
      system: DYNAMICS_EXTRACTOR_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    // Record usage
    const usage = extractTokenUsage(result.usage);
    await recordAIRequest(supabase, billing, {
      endpoint: "dynamics",
      model: result.response?.modelId ?? "unknown",
      modelType,
      usage,
      latencyMs: Date.now() - startTime,
    });

    // Parse and return the response
    const processingTimeMs = Date.now() - startTime;
    const dynamicsResult = parseResponse(
      result.text,
      request.documentId,
      request.sceneMarker,
      processingTimeMs
    );

    return createSuccessResponse(dynamicsResult, origin);
  } catch (error) {
    // Handle AI provider errors
    return handleAIError(error, origin);
  }
});
