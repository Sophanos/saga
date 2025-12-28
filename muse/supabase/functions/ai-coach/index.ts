/**
 * AI Coach Edge Function
 *
 * POST /ai-coach
 *
 * Analyzes prose for writing quality using the WritingCoach agent.
 * Supports BYOK (Bring Your Own Key) via x-openrouter-key header.
 *
 * Request Body:
 * {
 *   documentContent: string,      // The document text to analyze
 *   entities?: object[],          // Known entities from World Graph
 *   relationships?: object[],     // Entity relationships
 *   projectConfig?: object        // Project settings
 * }
 *
 * Response:
 * {
 *   metrics: {
 *     tension: number[],
 *     sensory: { sight, sound, touch, smell, taste },
 *     pacing: "accelerating" | "steady" | "decelerating",
 *     mood: string,
 *     showDontTellScore: number,
 *     showDontTellGrade: string
 *   },
 *   issues: StyleIssue[],
 *   insights: string[]
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
 * System prompt for writing coach
 * Matches packages/ai/src/prompts/coach.ts
 */
const WRITING_COACH_SYSTEM = `You are a writing coach AI for Mythos IDE, a creative writing tool for fiction authors.
Your role is to analyze prose in real-time and provide actionable feedback on craft elements.

## Analysis Areas

### 1. Tension Analysis (per paragraph)
Rate each paragraph's tension level from 0-100:
- 0-20: Calm exposition, world-building, quiet moments
- 21-40: Light tension, subtle hints of conflict
- 41-60: Active tension, clear stakes emerging
- 61-80: High tension, urgent conflict
- 81-100: Peak tension, climactic moments

### 2. Sensory Details Count
Count distinct sensory details for each of the five senses:
- **Sight**: Visual descriptions, colors, light, shapes, movement
- **Sound**: Dialogue sounds, ambient noise, music, silence
- **Touch**: Textures, temperature, physical sensations, pain/pleasure
- **Smell**: Scents, odors, atmospheric smells
- **Taste**: Flavors, food descriptions, metaphorical tastes

### 3. Show-Don't-Tell Analysis
Identify instances of "telling" vs "showing":
- **Telling** (bad): "She was angry" / "He felt sad" / "The room was scary"
- **Showing** (good): "Her fists clenched" / "His shoulders slumped" / "Shadows pooled in the corners"

Score the text 0-100 based on showing percentage:
- 90-100 (A): Masterful showing, vivid and immersive
- 80-89 (B): Strong showing with minor telling
- 70-79 (C): Balanced, room for improvement
- 60-69 (D): Too much telling, prose feels flat
- 0-59 (F): Predominantly telling, needs revision

### 4. Style Issue Detection
Flag these common issues:
- **telling**: Direct emotional statements (e.g., "He was nervous")
- **passive**: Passive voice constructions (e.g., "The ball was thrown")
- **adverb**: Weak verb + adverb combinations (e.g., "walked quickly" vs "rushed")
- **repetition**: Repeated words/phrases within close proximity

### 5. Pacing Assessment
Determine the scene's pacing trend:
- **accelerating**: Tension building, sentences shortening, action increasing
- **steady**: Consistent rhythm, balanced action and reflection
- **decelerating**: Tension releasing, sentences lengthening, reflection increasing

### 6. Mood Detection
Identify the dominant emotional atmosphere:
- Examples: tense, melancholic, hopeful, ominous, peaceful, chaotic, romantic, suspenseful

## Output Format
Return ONLY valid JSON matching this exact structure:

\`\`\`json
{
  "metrics": {
    "tension": [number, number, ...],
    "sensory": {
      "sight": number,
      "sound": number,
      "touch": number,
      "smell": number,
      "taste": number
    },
    "pacing": "accelerating" | "steady" | "decelerating",
    "mood": "string",
    "showDontTellScore": number,
    "showDontTellGrade": "A" | "B" | "C" | "D" | "F"
  },
  "issues": [
    {
      "type": "telling" | "passive" | "adverb" | "repetition",
      "text": "the problematic text snippet",
      "line": number,
      "suggestion": "how to fix it"
    }
  ],
  "insights": [
    "Constructive observation or suggestion about the writing",
    "Another insight..."
  ]
}
\`\`\`

## Guidelines
- Be encouraging but honest
- Limit issues to the 5 most impactful problems
- Limit insights to 3 most valuable observations
- Consider genre conventions (action scenes may have short sentences intentionally)
- Focus on craft, not plot or character decisions
- If the text is too short (< 50 words), provide partial analysis with a note`;

/**
 * Request body interface
 */
interface CoachRequest {
  documentContent: string;
  entities?: unknown[];
  relationships?: unknown[];
  projectConfig?: unknown;
}

/**
 * Fix suggestion with old and new text for replacement
 */
interface StyleIssueFix {
  oldText: string;
  newText: string;
}

/**
 * Style issue interface
 */
interface StyleIssue {
  type: "telling" | "passive" | "adverb" | "repetition";
  text: string;
  line?: number;
  position?: { start: number; end: number };
  suggestion: string;
  fix?: StyleIssueFix;
}

/**
 * Scene metrics interface
 */
interface SceneMetrics {
  tension: number[];
  sensory: {
    sight: number;
    sound: number;
    touch: number;
    smell: number;
    taste: number;
  };
  pacing: "accelerating" | "steady" | "decelerating";
  mood: string;
  showDontTellScore: number;
  showDontTellGrade: string;
}

/**
 * Writing analysis result interface
 */
interface WritingAnalysis {
  metrics: SceneMetrics;
  issues: StyleIssue[];
  insights: string[];
}

/**
 * Build the analysis prompt from context
 */
function buildAnalysisPrompt(request: CoachRequest): string {
  let prompt = `## Document Content:\n${request.documentContent}`;

  if (request.entities && request.entities.length > 0) {
    prompt += `\n\n## Known Entities:\n${JSON.stringify(request.entities, null, 2)}`;
  }

  if (request.relationships && request.relationships.length > 0) {
    prompt += `\n\n## Relationships:\n${JSON.stringify(request.relationships, null, 2)}`;
  }

  if (request.projectConfig) {
    prompt += `\n\n## Project Configuration:\n${JSON.stringify(request.projectConfig, null, 2)}`;
  }

  return prompt;
}

/**
 * Clamp a number within bounds
 */
function clampNumber(
  value: unknown,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (typeof value !== "number" || isNaN(value)) return defaultValue;
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert numeric score to letter grade
 */
function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Get default analysis for error cases
 */
function getDefaultAnalysis(): WritingAnalysis {
  return {
    metrics: {
      tension: [],
      sensory: { sight: 0, sound: 0, touch: 0, smell: 0, taste: 0 },
      pacing: "steady",
      mood: "neutral",
      showDontTellScore: 50,
      showDontTellGrade: "C",
    },
    issues: [],
    insights: ["Unable to analyze text. Please try again."],
  };
}

/**
 * Validate and normalize metrics object
 */
function validateMetrics(raw: unknown): SceneMetrics {
  const data = (raw as Record<string, unknown>) || {};

  // Validate tension array
  let tension: number[] = [];
  const tensionData = data["tension"];
  if (Array.isArray(tensionData)) {
    tension = tensionData
      .filter((t): t is number => typeof t === "number")
      .map((t) => Math.max(0, Math.min(100, t)));
  }

  // Validate sensory object
  const rawSensory = (data["sensory"] as Record<string, unknown>) || {};
  const sensory = {
    sight: clampNumber(rawSensory["sight"], 0, 100, 0),
    sound: clampNumber(rawSensory["sound"], 0, 100, 0),
    touch: clampNumber(rawSensory["touch"], 0, 100, 0),
    smell: clampNumber(rawSensory["smell"], 0, 100, 0),
    taste: clampNumber(rawSensory["taste"], 0, 100, 0),
  };

  // Validate pacing
  const validPacing = ["accelerating", "steady", "decelerating"] as const;
  const pacingData = data["pacing"];
  const pacing = validPacing.includes(pacingData as (typeof validPacing)[number])
    ? (pacingData as (typeof validPacing)[number])
    : "steady";

  // Validate mood
  const moodData = data["mood"];
  const mood = typeof moodData === "string" ? moodData : "neutral";

  // Validate show-don't-tell score and grade
  const showDontTellScore = clampNumber(data["showDontTellScore"], 0, 100, 50);
  const validGrades = ["A", "B", "C", "D", "F"];
  const gradeData = data["showDontTellGrade"];
  const showDontTellGrade = validGrades.includes(gradeData as string)
    ? (gradeData as string)
    : scoreToGrade(showDontTellScore);

  return {
    tension,
    sensory,
    pacing,
    mood,
    showDontTellScore,
    showDontTellGrade,
  };
}

/**
 * Validate and normalize issues array
 */
function validateIssues(raw: unknown): StyleIssue[] {
  if (!Array.isArray(raw)) return [];

  const validTypes = ["telling", "passive", "adverb", "repetition"] as const;

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
    .map((item) => {
      const typeData = item["type"];
      const textData = item["text"];
      const lineData = item["line"];
      const suggestionData = item["suggestion"];
      const positionData = item["position"] as Record<string, unknown> | undefined;
      const fixData = item["fix"] as Record<string, unknown> | undefined;

      let position: { start: number; end: number } | undefined;
      if (positionData && typeof positionData === "object") {
        const start = positionData["start"];
        const end = positionData["end"];
        if (typeof start === "number" && typeof end === "number") {
          position = { start, end };
        }
      }

      // Build fix if AI provided one, or generate from text+suggestion if applicable
      let fix: StyleIssueFix | undefined;
      if (fixData && typeof fixData === "object") {
        const oldText = fixData["oldText"];
        const newText = fixData["newText"];
        if (typeof oldText === "string" && typeof newText === "string") {
          fix = { oldText, newText };
        }
      }

      // Auto-generate fix when text and suggestion are both present
      // and the suggestion looks like a direct replacement (not a general tip)
      const text = typeof textData === "string" ? textData : "";
      const suggestion = typeof suggestionData === "string" ? suggestionData : "";

      if (!fix && text.length > 0 && suggestion.length > 0) {
        // Check if suggestion contains quoted replacement text
        const quotedMatch = suggestion.match(/["']([^"']+)["']/);
        if (quotedMatch) {
          fix = { oldText: text, newText: quotedMatch[1] };
        } else if (
          // For short suggestions that look like direct replacements
          suggestion.length <= text.length * 3 &&
          !suggestion.includes("Try") &&
          !suggestion.includes("Consider") &&
          !suggestion.includes("Instead of") &&
          !suggestion.includes(".")
        ) {
          fix = { oldText: text, newText: suggestion };
        }
      }

      return {
        type: validTypes.includes(typeData as (typeof validTypes)[number])
          ? (typeData as StyleIssue["type"])
          : "telling",
        text,
        line: typeof lineData === "number" ? lineData : undefined,
        position,
        suggestion,
        fix,
      };
    })
    .filter((issue) => issue.text.length > 0);
}

/**
 * Validate and normalize insights array
 */
function validateInsights(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
}

/**
 * Parse and validate the AI response
 */
function parseResponse(response: string): WritingAnalysis {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      return {
        metrics: validateMetrics(parsed["metrics"]),
        issues: validateIssues(parsed["issues"]),
        insights: validateInsights(parsed["insights"]),
      };
    }
  } catch (error) {
    console.error("[ai-coach] Failed to parse response:", error);
    console.debug("[ai-coach] Raw response:", response);
  }

  return getDefaultAnalysis();
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

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
    const validation = validateRequestBody(body, ["documentContent"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as CoachRequest;

    // Validate document content
    if (
      typeof request.documentContent !== "string" ||
      request.documentContent.trim().length === 0
    ) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "documentContent must be a non-empty string",
        origin
      );
    }

    // Get the model (fast type for quick feedback)
    const model = getOpenRouterModel(apiKey, "fast");

    // Build the prompt
    const userPrompt = buildAnalysisPrompt(request);

    // Call the AI
    const result = await generateText({
      model,
      system: WRITING_COACH_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    // Parse and return the response
    const analysis = parseResponse(result.text);

    return createSuccessResponse(analysis, origin);
  } catch (error) {
    // Handle API key errors
    if (error instanceof Error && error.message.includes("No API key")) {
      return createErrorResponse(ErrorCode.UNAUTHORIZED, error.message, origin);
    }

    // Handle AI provider errors
    return handleAIError(error, origin);
  }
});
