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
 *   projectConfig?: object,       // Project settings
 *   stream?: boolean              // Enable streaming mode (default: false)
 * }
 *
 * Response (Non-streaming):
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
 *
 * Response (Streaming - SSE):
 * - { type: "metrics", data: Partial<SceneMetrics> }  // Progressive metrics updates
 * - { type: "issue", data: StyleIssue }               // Each issue as detected
 * - { type: "insight", data: string }                 // Each insight as generated
 * - { type: "done" }                                  // Stream complete
 * - { type: "error", message: string }                // Error occurred
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { generateText, streamText, Output } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import { getOpenRouterModel } from "../_shared/providers.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import { WRITING_COACH_SYSTEM } from "../_shared/prompts/coach.ts";
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

/**
 * Request body interface
 */
interface CoachRequest {
  documentContent: string;
  entities?: unknown[];
  relationships?: unknown[];
  projectConfig?: unknown;
  stream?: boolean;
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

// ============================================================================
// Zod Schemas for Streaming
// ============================================================================

/**
 * Zod schema for style issue fix
 */
const styleIssueFixSchema = z.object({
  oldText: z.string().describe("Original text to replace"),
  newText: z.string().describe("Suggested replacement text"),
});

/**
 * Zod schema for text position
 */
const positionSchema = z.object({
  start: z.number().int().min(0).describe("Start character offset"),
  end: z.number().int().min(0).describe("End character offset"),
});

/**
 * Zod schema for a style issue
 */
const styleIssueSchema = z.object({
  type: z.enum(["telling", "passive", "adverb", "repetition"]).describe("Issue category"),
  text: z.string().describe("The problematic text"),
  line: z.number().int().optional().describe("Line number if applicable"),
  position: positionSchema.optional().describe("Character position in document"),
  suggestion: z.string().describe("How to improve the text"),
  fix: styleIssueFixSchema.optional().describe("Direct replacement suggestion"),
});

/**
 * Zod schema for sensory details
 */
const sensorySchema = z.object({
  sight: z.number().min(0).max(100).describe("Visual imagery score 0-100"),
  sound: z.number().min(0).max(100).describe("Auditory imagery score 0-100"),
  touch: z.number().min(0).max(100).describe("Tactile imagery score 0-100"),
  smell: z.number().min(0).max(100).describe("Olfactory imagery score 0-100"),
  taste: z.number().min(0).max(100).describe("Gustatory imagery score 0-100"),
});

/**
 * Zod schema for scene metrics
 */
const sceneMetricsSchema = z.object({
  tension: z.array(z.number().min(0).max(100)).describe("Tension curve values 0-100"),
  sensory: sensorySchema.describe("Sensory detail scores"),
  pacing: z.enum(["accelerating", "steady", "decelerating"]).describe("Narrative pacing"),
  mood: z.string().describe("Overall mood/tone of the scene"),
  showDontTellScore: z.number().min(0).max(100).describe("Show vs tell score 0-100"),
  showDontTellGrade: z.enum(["A", "B", "C", "D", "F"]).describe("Letter grade for showing"),
});

/**
 * Complete coach result schema for streaming
 */
const coachResultSchema = z.object({
  metrics: sceneMetricsSchema.describe("Scene analysis metrics"),
  issues: z.array(styleIssueSchema).describe("Style issues found in the text"),
  insights: z.array(z.string()).describe("Writing insights and suggestions"),
});

type StreamingCoachResult = z.infer<typeof coachResultSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

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

  const startTime = Date.now();
  const supabase = createSupabaseClient();
  const modelType = "fast";
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
    const model = getOpenRouterModel(billing.apiKey!, modelType);

    // Build the prompt
    const userPrompt = buildAnalysisPrompt(request);

    // Check if streaming is requested
    const shouldStream = request.stream === true;

    if (shouldStream) {
      // ========================================================================
      // Streaming Mode - Progressive structured output
      // ========================================================================
      console.log("[ai-coach] Starting streaming analysis:", {
        contentLength: request.documentContent.length,
      });

      // Use streamText with Output.object() for progressive structured output
      const result = streamText({
        model,
        output: Output.object({
          schema: coachResultSchema,
        }),
        system: WRITING_COACH_SYSTEM,
        prompt: userPrompt,
        temperature: 0.3,
        maxOutputTokens: 4096,
      });

      // Track what we've already emitted to avoid duplicates
      let lastMetricsJson = "";
      let lastIssueCount = 0;
      let lastInsightCount = 0;

      // Create SSE stream for progressive output
      const stream = createSSEStream(async (sse: SSEStreamController) => {
        try {
          // Stream partial results as they're generated
          for await (const partial of result.partialOutputStream) {
            const partialResult = partial as Partial<StreamingCoachResult>;

            // Emit metrics updates when they change
            if (partialResult.metrics) {
              const metricsJson = JSON.stringify(partialResult.metrics);
              if (metricsJson !== lastMetricsJson) {
                lastMetricsJson = metricsJson;
                sse.sendContext({
                  type: "metrics",
                  data: partialResult.metrics,
                });
              }
            }

            // Emit new issues as they appear
            if (partialResult.issues && partialResult.issues.length > lastIssueCount) {
              for (let i = lastIssueCount; i < partialResult.issues.length; i++) {
                const issue = partialResult.issues[i];
                // Only emit complete issues (have required fields)
                if (issue && issue.type && issue.text && issue.suggestion) {
                  sse.sendContext({
                    type: "issue",
                    data: issue,
                  });
                }
              }
              lastIssueCount = partialResult.issues.length;
            }

            // Emit new insights as they appear
            if (partialResult.insights && partialResult.insights.length > lastInsightCount) {
              for (let i = lastInsightCount; i < partialResult.insights.length; i++) {
                const insight = partialResult.insights[i];
                if (insight && typeof insight === "string" && insight.length > 0) {
                  sse.sendContext({
                    type: "insight",
                    data: insight,
                  });
                }
              }
              lastInsightCount = partialResult.insights.length;
            }
          }

          // Wait for final usage data
          const usage = await result.usage;

          // Record usage
          await recordAIRequest(supabase, billing!, {
            endpoint: "coach",
            model: "stream",
            modelType,
            usage: extractTokenUsage(usage),
            latencyMs: Date.now() - startTime,
            metadata: { streaming: true, issuesFound: lastIssueCount },
          });

          console.log("[ai-coach] Streaming analysis complete:", {
            issuesFound: lastIssueCount,
            insightsGenerated: lastInsightCount,
            processingTimeMs: Date.now() - startTime,
          });

          sse.complete();
        } catch (error) {
          console.error("[ai-coach] Streaming error:", error);

          // Record failed request
          await recordAIRequest(supabase, billing!, {
            endpoint: "coach",
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
    }

    // ========================================================================
    // Non-streaming Mode - Original blocking behavior
    // ========================================================================

    // Call the AI
    const result = await generateText({
      model,
      system: WRITING_COACH_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    // Record usage
    const usage = extractTokenUsage(result.usage);
    await recordAIRequest(supabase, billing, {
      endpoint: "coach",
      model: result.response?.modelId ?? "unknown",
      modelType,
      usage,
      latencyMs: Date.now() - startTime,
    });

    // Parse and return the response
    const analysis = parseResponse(result.text);

    return createSuccessResponse(analysis, origin);
  } catch (error) {
    // Record failed request if billing was successfully obtained
    if (billing) {
      await recordAIRequest(supabase, billing, {
        endpoint: "coach",
        model: "unknown",
        modelType,
        usage: extractTokenUsage(undefined),
        latencyMs: Date.now() - startTime,
        success: false,
        errorCode: "AI_ERROR",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
    // Handle AI provider errors
    return handleAIError(error, origin);
  }
});
