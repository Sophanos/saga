/**
 * AI Genesis Edge Function
 *
 * Generates story world scaffolding from a concept prompt.
 * Used in Architect mode project creation.
 *
 * @deprecated This is a legacy endpoint. New features should use the unified
 * ai-saga endpoint with the genesis_world tool. This endpoint is maintained
 * for backward compatibility with existing client code.
 *
 * Migration path:
 *   POST /ai-saga { kind: "execute_tool", toolName: "genesis_world", input: {...} }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { generateText } from "https://esm.sh/ai@4.0.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import { requireApiKey } from "../_shared/api-key.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  GENESIS_SYSTEM_PROMPT,
  buildGenesisUserPrompt,
} from "../_shared/prompts/mod.ts";
import type { GeneratedEntity, GenesisResult } from "../_shared/genesis-types.ts";

// ============================================================================
// Types
// ============================================================================

interface GenesisRequest {
  prompt: string;
  genre?: string;
  preferences?: {
    entityCount?: number;
    includeOutline?: boolean;
    detailLevel?: "minimal" | "standard" | "detailed";
  };
}

// Re-export GenesisResult as GenesisResponse for local use
type GenesisResponse = GenesisResult;

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  const origin = req.headers.get("Origin");

  try {
    // Validate request method
    if (req.method !== "POST") {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Method not allowed",
        origin
      );
    }

    // Get API key
    const apiKey = requireApiKey(req);

    // Parse request body
    let body: GenesisRequest;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid JSON body",
        origin
      );
    }

    // Validate required fields
    const validation = validateRequestBody(body, ["prompt"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    // Validate prompt length
    if (body.prompt.length < 10) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Prompt must be at least 10 characters",
        origin
      );
    }

    if (body.prompt.length > 2000) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Prompt must be less than 2000 characters",
        origin
      );
    }

    // Build the user prompt
    const userPrompt = buildGenesisUserPrompt({
      prompt: body.prompt,
      genre: body.genre,
      entityCount: body.preferences?.entityCount ?? 10,
      detailLevel: body.preferences?.detailLevel ?? "standard",
      includeOutline: body.preferences?.includeOutline ?? true,
    });

    // Get model - using "creative" for world generation
    const model = getOpenRouterModel(apiKey, "creative");

    console.log("[ai-genesis] Generating world from prompt:", body.prompt.slice(0, 50) + "...");

    // Generate world
    const { text } = await generateText({
      model,
      system: GENESIS_SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: 4096,
      temperature: 0.8, // Higher for creativity
    });

    // Parse response
    const result = parseResponse(text);

    console.log(
      `[ai-genesis] Generated ${result.entities.length} entities, ` +
      `${result.outline?.length ?? 0} outline sections`
    );

    return createSuccessResponse(result, origin);
  } catch (error) {
    return handleAIError(error, origin, { providerName: "genesis" });
  }
});

// ============================================================================
// Response Parsing
// ============================================================================

function parseResponse(response: string): GenesisResponse {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as GenesisResponse;
      
      // Validate structure
      if (!Array.isArray(parsed.entities)) {
        parsed.entities = [];
      }
      
      // Ensure worldSummary exists
      if (!parsed.worldSummary) {
        parsed.worldSummary = "A world waiting to be explored.";
      }

      // Validate entity structure
      parsed.entities = parsed.entities
        .filter((e) => e && typeof e.name === "string" && typeof e.type === "string")
        .map((e) => ({
          name: e.name,
          type: e.type,
          description: e.description ?? "",
          properties: e.properties ?? {},
          relationships: Array.isArray(e.relationships) ? e.relationships : [],
        }));

      return parsed;
    }
  } catch (error) {
    console.error("[ai-genesis] Failed to parse response:", error);
  }

  // Return empty result if parsing fails
  return {
    entities: [],
    worldSummary: "Failed to generate world. Please try again.",
  };
}
