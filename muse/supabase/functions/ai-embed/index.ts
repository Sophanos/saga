/**
 * AI Embed Edge Function
 *
 * POST /ai-embed
 *
 * Generates embeddings using DeepInfra and optionally indexes to Qdrant.
 * This is a server-side only endpoint - no BYOK; uses environment secrets.
 *
 * Request Body:
 * {
 *   inputs: string[],              // Required: texts to embed (1-32 items)
 *   model?: string,                // Optional: override model
 *   dimensions?: number,           // Optional: override dimensions (default 1536)
 *   qdrant?: {                     // Optional: if present, upsert to Qdrant
 *     enabled: boolean,
 *     collection?: string,         // Optional: override collection
 *     points: Array<{              // Required if enabled: metadata for each input
 *       id: string,
 *       payload: Record<string, unknown>
 *     }>
 *   }
 * }
 *
 * Response:
 * {
 *   embeddings: number[][],
 *   model: string,
 *   dimensions: number,
 *   qdrantUpserted?: boolean,
 *   processingTimeMs: number
 * }
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
import {
  generateEmbeddings,
  DeepInfraError,
} from "../_shared/deepinfra.ts";
import {
  upsertPoints,
  isQdrantConfigured,
  QdrantError,
  type QdrantPoint,
} from "../_shared/qdrant.ts";

/**
 * Maximum number of inputs per request
 */
const MAX_BATCH_SIZE = 32;

/**
 * Maximum characters per input (to prevent abuse)
 */
const MAX_INPUT_LENGTH = 32000;

/**
 * Qdrant point metadata for request
 */
interface QdrantPointMeta {
  id: string;
  payload: Record<string, unknown>;
}

/**
 * Qdrant configuration in request
 */
interface QdrantConfig {
  enabled: boolean;
  collection?: string;
  points: QdrantPointMeta[];
}

/**
 * Request body interface
 */
interface EmbedRequest {
  inputs: string[];
  model?: string;
  dimensions?: number;
  qdrant?: QdrantConfig;
}

/**
 * Response interface
 */
interface EmbedResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  qdrantUpserted?: boolean;
  processingTimeMs: number;
}

/**
 * Validate inputs array
 */
function validateInputs(inputs: unknown): { valid: true; data: string[] } | { valid: false; error: string } {
  if (!Array.isArray(inputs)) {
    return { valid: false, error: "inputs must be an array" };
  }

  if (inputs.length === 0) {
    return { valid: false, error: "inputs array must not be empty" };
  }

  if (inputs.length > MAX_BATCH_SIZE) {
    return { valid: false, error: `inputs array must not exceed ${MAX_BATCH_SIZE} items` };
  }

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (typeof input !== "string") {
      return { valid: false, error: `inputs[${i}] must be a string` };
    }
    if (input.trim().length === 0) {
      return { valid: false, error: `inputs[${i}] must not be empty` };
    }
    if (input.length > MAX_INPUT_LENGTH) {
      return { valid: false, error: `inputs[${i}] exceeds maximum length of ${MAX_INPUT_LENGTH} characters` };
    }
  }

  return { valid: true, data: inputs as string[] };
}

/**
 * Validate Qdrant configuration
 */
function validateQdrantConfig(
  qdrant: unknown,
  inputCount: number
): { valid: true; data: QdrantConfig | undefined } | { valid: false; error: string } {
  if (qdrant === undefined || qdrant === null) {
    return { valid: true, data: undefined };
  }

  if (typeof qdrant !== "object") {
    return { valid: false, error: "qdrant must be an object" };
  }

  const config = qdrant as Record<string, unknown>;

  if (config.enabled !== true) {
    return { valid: true, data: undefined };
  }

  if (!Array.isArray(config.points)) {
    return { valid: false, error: "qdrant.points must be an array when qdrant.enabled is true" };
  }

  if (config.points.length !== inputCount) {
    return {
      valid: false,
      error: `qdrant.points length (${config.points.length}) must match inputs length (${inputCount})`,
    };
  }

  for (let i = 0; i < config.points.length; i++) {
    const point = config.points[i] as Record<string, unknown>;
    if (typeof point !== "object" || point === null) {
      return { valid: false, error: `qdrant.points[${i}] must be an object` };
    }
    if (typeof point.id !== "string" || point.id.trim().length === 0) {
      return { valid: false, error: `qdrant.points[${i}].id must be a non-empty string` };
    }
    if (typeof point.payload !== "object" || point.payload === null) {
      return { valid: false, error: `qdrant.points[${i}].payload must be an object` };
    }
  }

  return {
    valid: true,
    data: {
      enabled: true,
      collection: typeof config.collection === "string" ? config.collection : undefined,
      points: config.points as QdrantPointMeta[],
    },
  };
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
    const validation = validateRequestBody(body, ["inputs"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as EmbedRequest;

    // Validate inputs array
    const inputsValidation = validateInputs(request.inputs);
    if (!inputsValidation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        inputsValidation.error,
        origin
      );
    }

    // Validate qdrant configuration
    const qdrantValidation = validateQdrantConfig(request.qdrant, inputsValidation.data.length);
    if (!qdrantValidation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        qdrantValidation.error,
        origin
      );
    }

    // Generate embeddings via DeepInfra
    const embeddingResult = await generateEmbeddings(inputsValidation.data, {
      embedModel: request.model,
      dimensions: request.dimensions,
    });

    // Validate embedding count matches input count
    if (embeddingResult.embeddings.length !== inputsValidation.data.length) {
      return createErrorResponse(
        ErrorCode.AI_ERROR,
        `Embedding count mismatch: expected ${inputsValidation.data.length}, got ${embeddingResult.embeddings.length}`,
        origin
      );
    }

    // Handle Qdrant upsert if requested
    let qdrantUpserted: boolean | undefined;
    if (qdrantValidation.data?.enabled) {
      if (!isQdrantConfigured()) {
        console.warn("[ai-embed] Qdrant requested but not configured, skipping upsert");
      } else {
        try {
          const points: QdrantPoint[] = qdrantValidation.data.points.map((meta, index) => ({
            id: meta.id,
            vector: embeddingResult.embeddings[index],
            payload: meta.payload,
          }));

          await upsertPoints(points, {
            collection: qdrantValidation.data.collection,
          });

          qdrantUpserted = true;
        } catch (error) {
          // Log but don't fail the request - embeddings were generated successfully
          console.error("[ai-embed] Qdrant upsert failed:", error);
          if (error instanceof QdrantError) {
            console.error(`[ai-embed] Qdrant status: ${error.statusCode}, ${error.qdrantStatus}`);
          }
          qdrantUpserted = false;
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    const response: EmbedResponse = {
      embeddings: embeddingResult.embeddings,
      model: embeddingResult.model,
      dimensions: embeddingResult.dimensions,
      ...(qdrantUpserted !== undefined && { qdrantUpserted }),
      processingTimeMs,
    };

    return createSuccessResponse(response, origin);
  } catch (error) {
    // Handle DeepInfra-specific errors
    if (error instanceof DeepInfraError) {
      return handleAIError(error, origin, { providerName: "DeepInfra" });
    }

    // Handle Qdrant errors (shouldn't happen here, but just in case)
    if (error instanceof QdrantError) {
      return createErrorResponse(
        ErrorCode.AI_ERROR,
        `Qdrant error: ${error.message}`,
        origin
      );
    }

    // Handle generic errors
    return handleAIError(error, origin, { providerName: "Embedding service" });
  }
});
