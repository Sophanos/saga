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
import { requireApiKey } from "../_shared/api-key.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";

/**
 * System prompt for dynamics extraction
 * Matches packages/ai/src/prompts/dynamics.ts
 */
const DYNAMICS_EXTRACTOR_SYSTEM = `You are a narrative dynamics analyzer for Mythos IDE, a creative writing tool for fiction authors.
Your role is to extract character interactions and events from prose text, identifying the causal relationships that drive the story forward.

## Interaction Categories

### 1. Neutral Interactions
Normal story events without conflict:
- **SPEAKS**: Character dialogue (source speaks to target)
- **ENTERS**: Character enters a location
- **EXITS**: Character leaves a location
- **OBSERVES**: Character notices or watches something/someone
- **MEETS**: Characters encounter each other
- **TRAVELS**: Character moves to a location
- **GIVES**: Character gives something to another

### 2. Hostile Interactions
Conflict-driven events:
- **ATTACKS**: Physical aggression
- **BETRAYS**: Breaking trust or loyalty
- **THREATENS**: Verbal or implied violence
- **DECEIVES**: Lying or misleading
- **STEALS**: Taking without permission
- **CAPTURES**: Imprisoning or restraining
- **WOUNDS**: Causing physical harm
- **KILLS**: Ending a life

### 3. Hidden Interactions (DM-only visibility)
Secret actions that players/readers should not see:
- **PLOTS**: Secret planning against someone
- **CONCEALS**: Hiding information or objects
- **MANIPULATES**: Subtle psychological control
- **SPIES**: Covert observation
- **POISONS**: Secret harmful action
- **SCHEMES**: Long-term secret planning
Flag these with isHidden: true for DM review.

### 4. Passive Interactions
Internal states and passive events:
- **REMEMBERS**: Recalling past events
- **FEELS**: Emotional state toward someone/something
- **FEARS**: Being afraid of something
- **DESIRES**: Wanting something
- **DISCOVERS**: Learning new information
- **REVEALS**: Making hidden information known
- **REALIZES**: Coming to an understanding
- **TRANSFORMS**: Character change or development

## Extraction Rules

1. **Identify Source**: The character or entity performing the action
2. **Identify Action**: The verb/interaction type from the categories above
3. **Identify Target**: The character, entity, location, or concept receiving the action
4. **Determine Type**: Classify as neutral, hostile, hidden, or passive
5. **Flag Hidden**: Mark isHidden: true for secret actions only the DM should see
6. **Flag Hostile**: Mark isHostile: true for conflict-driven actions

## Special Considerations

- **Dialogue**: Extract the emotional intent, not just that characters spoke
- **Subtext**: Identify hidden meanings in character actions
- **Foreshadowing**: Note setup for future events
- **Group Actions**: If multiple characters act together, create separate interactions for each
- **Implied Actions**: Extract actions implied but not explicitly stated
- **Location Context**: Use scene markers like "Sc 1" or location names for time references

## Output Format

Return ONLY valid JSON matching this exact structure:

\`\`\`json
{
  "interactions": [
    {
      "source": "character or entity name",
      "action": "INTERACTION_TYPE",
      "target": "target character, entity, or location",
      "type": "neutral" | "hostile" | "hidden" | "passive",
      "isHidden": false,
      "isHostile": false,
      "effect": "optional mechanical effect like '-2 WIS' or 'gains trust'",
      "note": "optional context for DM or hidden info",
      "sceneMarker": "Sc 1 or scene context"
    }
  ],
  "summary": "Brief summary of the key dynamics in this passage"
}
\`\`\`

## Guidelines

- Extract 3-10 interactions per passage (focus on the most significant)
- Prioritize interactions that advance the plot or reveal character
- Include both explicit and implied interactions
- Use consistent character names as they appear in the text
- If character names are pronouns, resolve them to actual names when possible
- For items or locations as targets, use their names as given in the text
- When in doubt about type, prefer 'neutral' over more dramatic classifications
- Only mark truly secret actions as 'hidden' - not just private conversations`;

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

  try {
    // Extract API key (BYOK or env fallback)
    const apiKey = requireApiKey(req);

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
    const model = getOpenRouterModel(apiKey, "fast");

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
    // Handle API key errors
    if (error instanceof Error && error.message.includes("No API key")) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, error.message, origin);
    }

    // Handle AI provider errors
    return handleAIError(error, origin);
  }
});
