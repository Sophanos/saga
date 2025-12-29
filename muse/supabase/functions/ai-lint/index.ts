/**
 * AI Lint Edge Function
 *
 * POST /ai-lint
 *
 * Analyzes narrative content for consistency issues using the ConsistencyLinter agent.
 * Supports BYOK (Bring Your Own Key) via x-openrouter-key header.
 *
 * @deprecated This is a legacy endpoint. New features should use the unified
 * ai-saga endpoint with the check_consistency tool. This endpoint is maintained
 * for backward compatibility with existing client code.
 *
 * Migration path:
 *   POST /ai-saga { kind: "execute_tool", toolName: "check_consistency", input: {...} }
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
 *   issues: [
 *     {
 *       type: "character" | "world" | "plot" | "timeline",
 *       severity: "info" | "warning" | "error",
 *       location: { line: number, text: string },
 *       message: string,
 *       suggestion: string,
 *       relatedLocations?: { line: number, text: string }[]
 *     }
 *   ]
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
import { CONSISTENCY_LINTER_SYSTEM } from "../_shared/prompts/linter.ts";
import {
  checkBillingAndGetKey,
  createSupabaseClient,
  recordAIRequest,
  extractTokenUsage,
} from "../_shared/billing.ts";

/**
 * Request body interface
 */
interface LintRequest {
  documentContent: string;
  entities?: unknown[];
  relationships?: unknown[];
  projectConfig?: unknown;
}

/**
 * Consistency issue interface
 */
interface ConsistencyIssue {
  type: "character" | "world" | "plot" | "timeline";
  severity: "info" | "warning" | "error";
  location: { line: number; text: string };
  message: string;
  suggestion: string;
  relatedLocations?: { line: number; text: string }[];
}

/**
 * Build the analysis prompt from context
 */
function buildAnalysisPrompt(request: LintRequest): string {
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
 * Parse the AI response and extract issues
 */
function parseResponse(response: string): { issues: ConsistencyIssue[] } {
  try {
    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.issues && Array.isArray(parsed.issues)) {
        return { issues: parsed.issues };
      }
    }
  } catch (error) {
    console.error("[ai-lint] Failed to parse response:", error);
    console.debug("[ai-lint] Raw response:", response);
  }

  return { issues: [] };
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
    const validation = validateRequestBody(body, ["documentContent"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as LintRequest;

    // Validate document content
    if (typeof request.documentContent !== "string" || request.documentContent.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "documentContent must be a non-empty string",
        origin
      );
    }

    // Get the model (analysis type for thorough checking)
    const modelType = "analysis";
    const model = getOpenRouterModel(billing.apiKey!, modelType);

    // Build the prompt
    const userPrompt = buildAnalysisPrompt(request);

    // Call the AI
    const result = await generateText({
      model,
      system: CONSISTENCY_LINTER_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.2,
      maxTokens: 4096,
    });

    // Record usage (for both managed and BYOK - analytics)
    const usage = extractTokenUsage(result.usage);
    await recordAIRequest(supabase, billing, {
      endpoint: "lint",
      model: result.response?.modelId ?? "unknown",
      modelType,
      usage,
      latencyMs: Date.now() - startTime,
    });

    // Parse and return the response
    const issues = parseResponse(result.text);

    return createSuccessResponse(issues, origin);
  } catch (error) {
    // Record failed request
    await recordAIRequest(supabase, billing, {
      endpoint: "lint",
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
