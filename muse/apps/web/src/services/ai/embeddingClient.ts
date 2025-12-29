/**
 * Embedding API Client - Calls Supabase edge function /functions/v1/ai-embed
 *
 * Generates embeddings via DeepInfra and optionally indexes to Qdrant.
 * This client uses server-side secrets only - no API keys passed from client.
 */

import { ApiError, callEdgeFunction, type ApiErrorCode } from "../api-client";

/**
 * Qdrant point metadata for indexing
 */
export interface QdrantPointMeta {
  id: string;
  payload: Record<string, unknown>;
}

/**
 * Qdrant indexing options
 */
export interface QdrantIndexOptions {
  enabled: boolean;
  collection?: string;
  /** Point metadata - must match inputs array length */
  points: QdrantPointMeta[];
}

/**
 * Request options for embedding calls
 */
export interface EmbedRequestOptions {
  signal?: AbortSignal;
  /** Optional Qdrant indexing (for "one-call index") */
  qdrant?: QdrantIndexOptions;
}

/**
 * Response from embedding endpoint
 */
export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
  qdrantUpserted?: boolean;
  processingTimeMs: number;
}

/** Error codes returned by the embedding API */
export type EmbeddingApiErrorCode = ApiErrorCode;

/**
 * Embedding-specific API error
 */
export class EmbeddingApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    code?: EmbeddingApiErrorCode
  ) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "EmbeddingApiError";
  }
}

/** Internal request payload shape */
interface EmbedEdgeRequest {
  inputs: string[];
  model?: string;
  dimensions?: number;
  qdrant?: {
    enabled: boolean;
    collection?: string;
    points: QdrantPointMeta[];
  };
}

/** Internal response payload shape */
interface EmbedEdgeResponse {
  embeddings?: number[][];
  model?: string;
  dimensions?: number;
  qdrantUpserted?: boolean;
  processingTimeMs?: number;
}

/**
 * Expected embedding dimensions (native for Qwen3-Embedding-8B)
 * Using Qdrant-only architecture for best quality.
 */
const EXPECTED_DIMENSIONS = 4096;

/**
 * Validate embeddings from response
 */
function validateEmbeddings(
  embeddings: unknown,
  expectedCount: number
): number[][] {
  if (!Array.isArray(embeddings)) {
    throw new EmbeddingApiError("Invalid response: embeddings is not an array", undefined, "VALIDATION_ERROR");
  }

  if (embeddings.length !== expectedCount) {
    throw new EmbeddingApiError(
      `Invalid response: expected ${expectedCount} embeddings, got ${embeddings.length}`,
      undefined,
      "VALIDATION_ERROR"
    );
  }

  for (let i = 0; i < embeddings.length; i++) {
    const embedding = embeddings[i];
    if (!Array.isArray(embedding)) {
      throw new EmbeddingApiError(
        `Invalid response: embedding[${i}] is not an array`,
        undefined,
        "VALIDATION_ERROR"
      );
    }
    if (embedding.length !== EXPECTED_DIMENSIONS) {
      throw new EmbeddingApiError(
        `Invalid response: embedding[${i}] has ${embedding.length} dimensions, expected ${EXPECTED_DIMENSIONS}`,
        undefined,
        "VALIDATION_ERROR"
      );
    }
  }

  return embeddings as number[][];
}

/**
 * Generate embedding for a single text
 *
 * @param text - Text to embed
 * @param opts - Request options (signal, qdrant indexing)
 * @returns Embedding vector (1536 dimensions)
 */
export async function embedTextViaEdge(
  text: string,
  opts?: EmbedRequestOptions & {
    /** Qdrant indexing for single point */
    qdrant?: { enabled: boolean; collection?: string; pointId: string; payload: Record<string, unknown> };
  }
): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new EmbeddingApiError("text must be non-empty", 400, "VALIDATION_ERROR");
  }

  // Convert single-point qdrant options to array format
  let qdrantConfig: EmbedEdgeRequest["qdrant"] | undefined;
  if (opts?.qdrant?.enabled) {
    qdrantConfig = {
      enabled: true,
      collection: opts.qdrant.collection,
      points: [{ id: opts.qdrant.pointId, payload: opts.qdrant.payload }],
    };
  }

  try {
    const result = await callEdgeFunction<EmbedEdgeRequest, EmbedEdgeResponse>(
      "ai-embed",
      {
        inputs: [text],
        qdrant: qdrantConfig,
      },
      {
        signal: opts?.signal,
        // No apiKey - server uses environment secrets
      }
    );

    const embeddings = validateEmbeddings(result.embeddings, 1);
    return embeddings[0];
  } catch (error) {
    if (error instanceof ApiError && !(error instanceof EmbeddingApiError)) {
      throw new EmbeddingApiError(error.message, error.statusCode, error.code);
    }
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts
 *
 * @param texts - Array of texts to embed (max 32)
 * @param opts - Request options (signal, qdrant indexing)
 * @returns Array of embedding vectors (1536 dimensions each)
 */
export async function embedManyViaEdge(
  texts: string[],
  opts?: EmbedRequestOptions
): Promise<EmbedResponse> {
  if (!texts || texts.length === 0) {
    throw new EmbeddingApiError("texts array must be non-empty", 400, "VALIDATION_ERROR");
  }

  for (let i = 0; i < texts.length; i++) {
    if (!texts[i] || texts[i].trim().length === 0) {
      throw new EmbeddingApiError(`texts[${i}] must be non-empty`, 400, "VALIDATION_ERROR");
    }
  }

  // Validate qdrant points match texts length
  if (opts?.qdrant?.enabled && opts.qdrant.points.length !== texts.length) {
    throw new EmbeddingApiError(
      `qdrant.points length (${opts.qdrant.points.length}) must match texts length (${texts.length})`,
      400,
      "VALIDATION_ERROR"
    );
  }

  try {
    const result = await callEdgeFunction<EmbedEdgeRequest, EmbedEdgeResponse>(
      "ai-embed",
      {
        inputs: texts,
        qdrant: opts?.qdrant,
      },
      {
        signal: opts?.signal,
      }
    );

    const embeddings = validateEmbeddings(result.embeddings, texts.length);

    return {
      embeddings,
      model: result.model ?? "unknown",
      dimensions: result.dimensions ?? EXPECTED_DIMENSIONS,
      qdrantUpserted: result.qdrantUpserted,
      processingTimeMs: result.processingTimeMs ?? 0,
    };
  } catch (error) {
    if (error instanceof ApiError && !(error instanceof EmbeddingApiError)) {
      throw new EmbeddingApiError(error.message, error.statusCode, error.code);
    }
    throw error;
  }
}
