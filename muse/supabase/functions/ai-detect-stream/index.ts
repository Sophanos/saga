/**
 * AI Detect Stream Edge Function - Progressive Entity Detection
 *
 * POST /ai-detect-stream
 *
 * Streams detected entities progressively using AI SDK's streamText with
 * Output.array() for structured array output. Each entity is sent via SSE
 * as soon as it's detected, providing better UX for long texts.
 *
 * Request Body:
 * {
 *   text: string,                 // The text to analyze for entities
 *   existingEntities?: object[],  // Known entities to match against
 *   options?: DetectionOptions    // Detection options
 * }
 *
 * Response (SSE Stream):
 * - { type: "entity", data: DetectedEntity }  // Each entity as detected
 * - { type: "stats", data: DetectionStats }   // Final statistics
 * - { type: "done" }                          // Stream complete
 * - { type: "error", message: string }        // Error occurred
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
// AI SDK 6.x - using streamText with Output.array() for structured array streaming
import { streamText, Output } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  createSSEStream,
  getStreamingHeaders,
  type SSEStreamController,
} from "../_shared/streaming.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  extractTokenUsage,
  type BillingCheck,
} from "../_shared/billing.ts";
import type {
  EntityType,
  DetectionOptions,
  ExistingEntity,
} from "../_shared/tools/types.ts";

// ============================================================================
// Zod Schema for Streaming Entity Detection
// ============================================================================

/**
 * Schema for a single entity occurrence (position in text)
 */
const entityOccurrenceSchema = z.object({
  startOffset: z.number().int().min(0).describe("0-indexed start position"),
  endOffset: z.number().int().min(0).describe("Exclusive end position"),
  matchedText: z.string().describe("Exact text matched at this position"),
  context: z.string().optional().describe("Surrounding text context"),
});

/**
 * Schema for a detected entity - designed for streaming array output
 */
const detectedEntitySchema = z.object({
  tempId: z.string().describe("Temporary ID (e.g., 'temp_1')"),
  name: z.string().describe("Primary name of the entity"),
  canonicalName: z.string().describe("Lowercase normalized name"),
  type: z.enum([
    "character",
    "location",
    "item",
    "magic_system",
    "faction",
    "event",
    "concept",
  ]).describe("Entity type"),
  confidence: z.number().min(0).max(1).describe("Detection confidence"),
  occurrences: z.array(entityOccurrenceSchema).describe("All positions in text"),
  suggestedAliases: z.array(z.string()).default([]).describe("Potential aliases"),
  matchedExistingId: z.string().optional().describe("ID if matched to existing entity"),
  inferredProperties: z.record(z.unknown()).optional().describe("Inferred properties"),
});

export type StreamingDetectedEntity = z.infer<typeof detectedEntitySchema>;

// ============================================================================
// Types
// ============================================================================

interface DetectStreamRequest {
  text: string;
  existingEntities?: ExistingEntity[];
  options?: DetectionOptions;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<DetectionOptions> = {
  minConfidence: 0.5,
  entityTypes: [
    "character",
    "location",
    "item",
    "magic_system",
    "faction",
    "event",
    "concept",
  ],
  detectAliases: true,
  matchExisting: true,
  maxEntities: 100,
  includeContext: true,
  contextLength: 50,
};

// ============================================================================
// System Prompt
// ============================================================================

const STREAMING_ENTITY_DETECTOR_SYSTEM = `You are an expert entity detector for Mythos, a creative writing IDE.
Your task is to identify and extract named entities from narrative text.

## Entity Types:
- character: Named individuals, creatures, personified beings
- location: Places, buildings, regions, realms
- item: Named objects, weapons, artifacts
- magic_system: Named magic systems, powers, abilities
- faction: Organizations, groups, races, nations
- event: Named historical events, battles
- concept: Named abstract concepts, prophecies

## CRITICAL STREAMING REQUIREMENT:
Output entities ONE AT A TIME as a JSON array. Each entity should be complete
and independent so it can be streamed immediately. Don't wait to group entities -
emit each as you detect it.

## Detection Guidelines:
- Named characters (not generic "a soldier")
- Named places (not generic "nearby village")
- Named items (not generic "his sword")
- Confidence 0.9-1.0 for clear entities, 0.5-0.69 for uncertain
- Include EXACT character positions (0-indexed)
- Group multiple mentions of same entity together

## Position Requirements:
- startOffset: Exact 0-indexed position where match begins
- endOffset: Position after last character (exclusive)
- text[startOffset:endOffset] must EXACTLY match matchedText`;

// ============================================================================
// Helper Functions
// ============================================================================

function buildStreamingUserPrompt(
  text: string,
  existingEntities?: ExistingEntity[]
): string {
  let prompt = `Analyze this text and extract entities. Output each entity as it's detected - don't wait to group.

---TEXT---
${text}
---END---

For each entity, provide:
1. Exact character positions (0-indexed, exclusive end)
2. All occurrences in the text
3. Confidence score (0.5 minimum)`;

  if (existingEntities && existingEntities.length > 0) {
    prompt += `

EXISTING ENTITIES (include matchedExistingId if matched):
${JSON.stringify(existingEntities.map(e => ({ id: e.id, name: e.name, type: e.type, aliases: e.aliases })), null, 2)}`;
  }

  return prompt;
}

/**
 * Validate and correct entity positions
 */
function validateEntityPositions(
  entity: StreamingDetectedEntity,
  text: string,
  options: Required<DetectionOptions>
): StreamingDetectedEntity | null {
  const validatedOccurrences = entity.occurrences
    .map((occ) => {
      const { startOffset, endOffset, matchedText } = occ;

      // Check if positions are valid
      if (startOffset >= 0 && endOffset <= text.length && startOffset < endOffset) {
        const actualText = text.substring(startOffset, endOffset);
        if (actualText === matchedText) {
          return occ;
        }
      }

      // Try to find correct position
      const searchStart = Math.max(0, startOffset - 50);
      const pos = text.indexOf(matchedText, searchStart);
      if (pos !== -1) {
        return {
          startOffset: pos,
          endOffset: pos + matchedText.length,
          matchedText,
          context: options.includeContext
            ? extractContext(text, pos, pos + matchedText.length, options.contextLength)
            : occ.context,
        };
      }

      // Try case-insensitive
      const lowerPos = text.toLowerCase().indexOf(matchedText.toLowerCase());
      if (lowerPos !== -1) {
        return {
          startOffset: lowerPos,
          endOffset: lowerPos + matchedText.length,
          matchedText: text.substring(lowerPos, lowerPos + matchedText.length),
          context: options.includeContext
            ? extractContext(text, lowerPos, lowerPos + matchedText.length, options.contextLength)
            : occ.context,
            };
      }

      return null;
    })
    .filter((occ): occ is NonNullable<typeof occ> => occ !== null);

  if (validatedOccurrences.length === 0) {
    return null;
  }

  return {
    ...entity,
    occurrences: validatedOccurrences,
  };
}

function extractContext(
  text: string,
  start: number,
  end: number,
  length: number
): string {
  const contextStart = Math.max(0, start - length);
  const contextEnd = Math.min(text.length, end + length);
  let context = "";
  if (contextStart > 0) context += "...";
  context += text.substring(contextStart, contextEnd);
  if (contextEnd < text.length) context += "...";
  return context;
}

// ============================================================================
// Main Handler
// ============================================================================

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
  const modelType = "analysis";
  let billing: BillingCheck | undefined;

  try {
    // Check billing and get API key
    billing = await checkBillingAndGetKey(req, supabase);
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
    const validation = validateRequestBody(body, ["text"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as DetectStreamRequest;

    // Validate text content
    if (typeof request.text !== "string" || request.text.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "text must be a non-empty string",
        origin
      );
    }

    // Merge options with defaults
    const options: Required<DetectionOptions> = {
      ...DEFAULT_OPTIONS,
      ...request.options,
    };

    const existingEntities =
      options.matchExisting && request.existingEntities
        ? request.existingEntities
        : undefined;

    // Get the model
    const model = getOpenRouterModel(billing.apiKey!, modelType);

    // Build the prompt
    const userPrompt = buildStreamingUserPrompt(request.text, existingEntities);

    console.log("[ai-detect-stream] Starting progressive detection:", {
      textLength: request.text.length,
      existingEntitiesCount: existingEntities?.length || 0,
    });

    // Use streamText with Output.array() for progressive entity streaming
    // partialOutputStream yields partial parsed entities as they're detected
    const result = streamText({
      model,
      output: Output.array({
        element: detectedEntitySchema,
        name: "entities",
        description: "Array of detected narrative entities",
      }),
      system: STREAMING_ENTITY_DETECTOR_SYSTEM,
      prompt: userPrompt,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    // Track stats
    let entityCount = 0;
    const byType: Record<EntityType, number> = {
      character: 0,
      location: 0,
      item: 0,
      magic_system: 0,
      faction: 0,
      event: 0,
      concept: 0,
    };
    let matchedToExisting = 0;

    // Create SSE stream for progressive entity output
    const stream = createSSEStream(async (sse: SSEStreamController) => {
      try {
        // Track which entities have been emitted to avoid duplicates
        let lastEmittedCount = 0;

        // Stream entities progressively via partialOutputStream
        // Each partial update contains the array as parsed so far
        for await (const partialEntities of result.partialOutputStream) {
          // Check for new complete entities since last update
          const entities = partialEntities as StreamingDetectedEntity[];

          // Process only newly completed entities
          for (let i = lastEmittedCount; i < entities.length; i++) {
            const entity = entities[i];

            // Validate and correct positions
            const validatedEntity = validateEntityPositions(
              entity,
              request.text,
              options
            );

            if (!validatedEntity) {
              console.warn("[ai-detect-stream] Skipping invalid entity:", entity.name);
              continue;
            }

            // Apply filters
            if (validatedEntity.confidence < options.minConfidence) {
              continue;
            }
            if (!options.entityTypes.includes(validatedEntity.type)) {
              continue;
            }
            if (entityCount >= options.maxEntities) {
              break;
            }

            // Track stats
            entityCount++;
            byType[validatedEntity.type]++;
            if (validatedEntity.matchedExistingId) {
              matchedToExisting++;
            }

            // Send entity via SSE
            sse.sendContext({
              type: "entity",
              data: validatedEntity,
            });
          }

          lastEmittedCount = entities.length;

          if (entityCount >= options.maxEntities) {
            break;
          }
        }

        // Wait for final usage data
        const usage = await result.usage;

        // Send final stats
        const stats = {
          charactersAnalyzed: request.text.length,
          totalEntities: entityCount,
          byType,
          matchedToExisting,
          newEntities: entityCount - matchedToExisting,
          processingTimeMs: Date.now() - startTime,
        };

        sse.sendContext({
          type: "stats",
          data: stats,
        });

        // Record usage
        await recordAIRequest(supabase, billing!, {
          endpoint: "detect-stream",
          model: "stream",
          modelType,
          usage: extractTokenUsage(usage),
          latencyMs: Date.now() - startTime,
          metadata: { entitiesDetected: entityCount },
        });

        console.log("[ai-detect-stream] Progressive detection complete:", {
          entitiesDetected: entityCount,
          processingTimeMs: Date.now() - startTime,
        });

        sse.complete();
      } catch (error) {
        console.error("[ai-detect-stream] Streaming error:", error);

        // Record failed request
        await recordAIRequest(supabase, billing!, {
          endpoint: "detect-stream",
          model: "stream",
          modelType,
          usage: extractTokenUsage(undefined),
          latencyMs: Date.now() - startTime,
          success: false,
          errorCode: "STREAM_ERROR",
          errorMessage: error instanceof Error ? error.message : "Stream error",
        });

        sse.fail(error);
      }
    });

    return new Response(stream, {
      status: 200,
      headers: getStreamingHeaders(origin),
    });
  } catch (error) {
    // Record failed request if billing was obtained
    if (billing) {
      await recordAIRequest(supabase, billing, {
        endpoint: "detect-stream",
        model: "unknown",
        modelType,
        usage: extractTokenUsage(undefined),
        latencyMs: Date.now() - startTime,
        success: false,
        errorCode: "AI_ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return handleAIError(error, origin);
  }
});
