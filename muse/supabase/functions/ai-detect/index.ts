/**
 * AI Detect Edge Function
 *
 * POST /ai-detect
 *
 * Entity detection endpoint for automatically identifying characters,
 * locations, items, and other story elements in narrative text.
 * Supports BYOK (Bring Your Own Key) via x-openrouter-key header.
 *
 * @deprecated This is a legacy endpoint. New features should use the unified
 * ai-saga endpoint with the detect_entities tool. This endpoint is maintained
 * for backward compatibility with existing client code.
 *
 * Migration path:
 *   POST /ai-saga { kind: "execute_tool", toolName: "detect_entities", input: {...} }
 *
 * Request Body:
 * {
 *   text: string,                 // The text to analyze for entities
 *   existingEntities?: object[],  // Known entities to match against
 *   options?: {                   // Detection options
 *     minConfidence?: number,
 *     entityTypes?: string[],
 *     detectAliases?: boolean,
 *     matchExisting?: boolean,
 *     maxEntities?: number,
 *     includeContext?: boolean,
 *     contextLength?: number
 *   }
 * }
 *
 * Response:
 * {
 *   entities: DetectedEntity[],
 *   warnings?: DetectionWarning[],
 *   stats?: DetectionStats
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
import { ENTITY_DETECTOR_SYSTEM } from "../_shared/prompts/entity-detector.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  extractTokenUsage,
} from "../_shared/billing.ts";
import type {
  EntityType,
  EntityOccurrence,
  DetectedEntity,
  DetectionWarning,
  DetectionStats,
  DetectionOptions,
  DetectionResult,
  ExistingEntity,
} from "../_shared/tools/types.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Request body interface
 */
interface DetectRequest {
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
// Helper Functions
// ============================================================================

/**
 * Build the user prompt from request
 */
function buildUserPrompt(
  text: string,
  existingEntities?: ExistingEntity[]
): string {
  let prompt = `Analyze the following text and extract all named entities with their exact positions:

---TEXT START---
${text}
---TEXT END---

Remember:
1. Return EXACT character offsets (0-indexed, endOffset is exclusive)
2. Group all mentions of the same entity together
3. Detect potential aliases for the same entity
4. Include confidence scores (minimum 0.5)
5. Add context snippets for each occurrence`;

  if (existingEntities && existingEntities.length > 0) {
    prompt += `

## Existing Entities to Match Against:
The following entities already exist in this project. If you detect any of these (or their aliases), include their ID in matchedExistingId:

${JSON.stringify(existingEntities, null, 2)}

When matching to existing entities, prioritize exact name/alias matches, then consider contextual similarity.`;
  }

  return prompt;
}

/**
 * Find the position of text, searching near the expected position first
 */
function findTextPosition(
  text: string,
  searchText: string,
  expectedPosition: number
): { start: number; end: number } | null {
  // First, try exact match near expected position
  const exactStart = text.indexOf(
    searchText,
    Math.max(0, expectedPosition - 50)
  );
  if (exactStart !== -1 && Math.abs(exactStart - expectedPosition) < 100) {
    return { start: exactStart, end: exactStart + searchText.length };
  }

  // Search from the beginning
  const firstMatch = text.indexOf(searchText);
  if (firstMatch !== -1) {
    return { start: firstMatch, end: firstMatch + searchText.length };
  }

  // Try case-insensitive search
  const lowerText = text.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  const caseInsensitiveMatch = lowerText.indexOf(lowerSearch);
  if (caseInsensitiveMatch !== -1) {
    return {
      start: caseInsensitiveMatch,
      end: caseInsensitiveMatch + searchText.length,
    };
  }

  return null;
}

/**
 * Extract context around a position
 */
function extractContext(
  text: string,
  startOffset: number,
  endOffset: number,
  contextLength: number
): string {
  const contextStart = Math.max(0, startOffset - contextLength);
  const contextEnd = Math.min(text.length, endOffset + contextLength);

  let context = "";

  if (contextStart > 0) {
    context += "...";
  }

  context += text.substring(contextStart, contextEnd);

  if (contextEnd < text.length) {
    context += "...";
  }

  return context;
}

/**
 * Validate a single occurrence and attempt correction if positions are wrong
 */
function validateOccurrence(
  occurrence: EntityOccurrence,
  text: string,
  entityName: string,
  options: Required<DetectionOptions>
): EntityOccurrence | null {
  const { startOffset, endOffset, matchedText } = occurrence;

  // Check if the reported positions are valid
  if (
    startOffset >= 0 &&
    endOffset <= text.length &&
    startOffset < endOffset
  ) {
    const actualText = text.substring(startOffset, endOffset);
    if (actualText === matchedText) {
      // Positions are correct, add context if needed
      return {
        ...occurrence,
        context: options.includeContext
          ? extractContext(text, startOffset, endOffset, options.contextLength)
          : occurrence.context,
      };
    }
  }

  // Positions are wrong, try to find the actual position
  const correctedPosition = findTextPosition(text, matchedText, startOffset);
  if (correctedPosition) {
    return {
      startOffset: correctedPosition.start,
      endOffset: correctedPosition.end,
      matchedText,
      context: options.includeContext
        ? extractContext(
            text,
            correctedPosition.start,
            correctedPosition.end,
            options.contextLength
          )
        : occurrence.context,
    };
  }

  // Try searching for the entity name if matchedText not found
  if (matchedText !== entityName) {
    const namePosition = findTextPosition(text, entityName, startOffset);
    if (namePosition) {
      return {
        startOffset: namePosition.start,
        endOffset: namePosition.end,
        matchedText: entityName,
        context: options.includeContext
          ? extractContext(
              text,
              namePosition.start,
              namePosition.end,
              options.contextLength
            )
          : occurrence.context,
      };
    }
  }

  // Could not validate or correct this occurrence
  console.warn(
    `[ai-detect] Could not validate occurrence of "${matchedText}" at ${startOffset}-${endOffset}`
  );
  return null;
}

/**
 * Validate entity positions and attempt to correct any errors
 */
function validateAndCorrectPositions(
  entities: DetectedEntity[],
  text: string,
  options: Required<DetectionOptions>
): DetectedEntity[] {
  return entities
    .map((entity) => {
      const validatedOccurrences = entity.occurrences
        .map((occ) => validateOccurrence(occ, text, entity.name, options))
        .filter((occ): occ is EntityOccurrence => occ !== null);

      return {
        ...entity,
        occurrences: validatedOccurrences,
      };
    })
    .filter((entity) => entity.occurrences.length > 0);
}

/**
 * Apply filters based on options
 */
function applyFilters(
  entities: DetectedEntity[],
  options: Required<DetectionOptions>
): DetectedEntity[] {
  let filtered = entities;

  // Filter by confidence
  filtered = filtered.filter((e) => e.confidence >= options.minConfidence);

  // Filter by entity type
  if (options.entityTypes.length < 7) {
    filtered = filtered.filter((e) =>
      options.entityTypes.includes(e.type as EntityType)
    );
  }

  // Limit number of entities
  if (options.maxEntities > 0 && filtered.length > options.maxEntities) {
    // Sort by confidence and take top N
    filtered = filtered
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, options.maxEntities);
  }

  return filtered;
}

/**
 * Build statistics for the detection run
 */
function buildStats(
  entities: DetectedEntity[],
  text: string,
  startTime: number
): DetectionStats {
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
  let newEntities = 0;

  for (const entity of entities) {
    byType[entity.type]++;
    if (entity.matchedExistingId) {
      matchedToExisting++;
    } else {
      newEntities++;
    }
  }

  return {
    charactersAnalyzed: text.length,
    totalEntities: entities.length,
    byType,
    matchedToExisting,
    newEntities,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Return an empty result for error cases
 */
function emptyResult(text: string, startTime: number): DetectionResult {
  return {
    entities: [],
    warnings: [
      {
        type: "low_confidence",
        message: "Failed to parse AI response. No entities detected.",
      },
    ],
    stats: {
      charactersAnalyzed: text.length,
      totalEntities: 0,
      byType: {
        character: 0,
        location: 0,
        item: 0,
        magic_system: 0,
        faction: 0,
        event: 0,
        concept: 0,
      },
      matchedToExisting: 0,
      newEntities: 0,
      processingTimeMs: Date.now() - startTime,
    },
  };
}

/**
 * Parse and validate the AI response
 */
function parseResponse(
  response: string,
  text: string,
  options: Required<DetectionOptions>,
  startTime: number
): DetectionResult {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        entities?: DetectedEntity[];
        warnings?: DetectionWarning[];
      };

      // Validate and correct positions
      const validatedEntities = validateAndCorrectPositions(
        parsed.entities || [],
        text,
        options
      );

      // Apply filters
      const filteredEntities = applyFilters(validatedEntities, options);

      // Build stats
      const stats = buildStats(filteredEntities, text, startTime);

      return {
        entities: filteredEntities,
        warnings: parsed.warnings || [],
        stats,
      };
    }
  } catch (error) {
    console.error("[ai-detect] Failed to parse response:", error);
    console.debug("[ai-detect] Raw response:", response);
  }

  return emptyResult(text, startTime);
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
    const validation = validateRequestBody(body, ["text"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as DetectRequest;

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

    // Prepare existing entities for matching
    const existingEntities =
      options.matchExisting && request.existingEntities
        ? request.existingEntities
        : undefined;

    // Get the model (analysis type for thorough entity detection)
    const modelType = "analysis";
    const model = getOpenRouterModel(billing.apiKey!, modelType);

    // Build the prompt
    const userPrompt = buildUserPrompt(request.text, existingEntities);

    console.log("[ai-detect] Processing request:", {
      textLength: request.text.length,
      existingEntitiesCount: existingEntities?.length || 0,
      options: {
        minConfidence: options.minConfidence,
        entityTypes: options.entityTypes,
        maxEntities: options.maxEntities,
      },
    });

    // Call the AI
    const result = await generateText({
      model,
      system: ENTITY_DETECTOR_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2, // Low temperature for accurate position detection
      maxTokens: 8192, // Allow for long responses with many entities
    });

    // Record usage
    const usage = extractTokenUsage(result.usage);
    await recordAIRequest(supabase, billing, {
      endpoint: "detect",
      model: result.response?.modelId ?? "unknown",
      modelType,
      usage,
      latencyMs: Date.now() - startTime,
    });

    // Parse and return the response
    const detectionResult = parseResponse(
      result.text,
      request.text,
      options,
      startTime
    );

    console.log("[ai-detect] Detection complete:", {
      entitiesDetected: detectionResult.entities.length,
      warningsCount: detectionResult.warnings?.length || 0,
      processingTimeMs: detectionResult.stats?.processingTimeMs,
    });

    return createSuccessResponse(detectionResult, origin);
  } catch (error) {
    // Record failed request
    await recordAIRequest(supabase, billing, {
      endpoint: "detect",
      model: "unknown",
      modelType,
      usage: extractTokenUsage(undefined),
      latencyMs: Date.now() - startTime,
      success: false,
      errorCode: "AI_ERROR",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    // Handle AI provider errors
    return handleAIError(error, origin);
  }
});
