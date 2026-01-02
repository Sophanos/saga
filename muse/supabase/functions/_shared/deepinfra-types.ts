/**
 * DeepInfra Shared Types and Constants
 *
 * Centralized configuration for DeepInfra API integration.
 * Used by deepinfra.ts and edge functions.
 */

// =============================================================================
// Constants
// =============================================================================

/** DeepInfra OpenAI-compatible API base URL */
export const DEEPINFRA_BASE_URL = "https://api.deepinfra.com/v1/openai";

/** DeepInfra inference API base URL (for reranking) */
export const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";

/** Default embedding model - Qwen3-Embedding-8B with 4096 native dimensions */
export const DEEPINFRA_EMBED_MODEL = "Qwen/Qwen3-Embedding-8B";

/** Default reranking model */
export const DEEPINFRA_RERANK_MODEL = "Qwen/Qwen3-Reranker-4B";

/** Default embedding dimensions (native for Qwen3-Embedding-8B) */
export const DEEPINFRA_DIMENSIONS = 4096;

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * DeepInfra client configuration
 */
export interface DeepInfraConfig {
  apiKey: string;
  baseUrl: string;
  inferenceUrl: string;
  embedModel: string;
  rerankModel: string;
  dimensions: number;
}

// =============================================================================
// Embedding Types
// =============================================================================

/**
 * Result from embedding generation
 */
export interface EmbeddingResult {
  /** Generated embedding vectors */
  embeddings: number[][];
  /** Model ID used */
  model: string;
  /** Actual dimensions of embeddings */
  dimensions: number;
  /** Tokens consumed */
  tokensUsed: number;
}

// =============================================================================
// Reranking Types
// =============================================================================

/**
 * DeepInfra reranking model type (AI SDK RerankingModelV3 compatible)
 *
 * This type is returned by createDeepInfraReranker() and can be used
 * directly with the AI SDK's rerank() function.
 *
 * @example
 * ```typescript
 * import { rerank } from 'ai';
 * import { createDeepInfraReranker, type DeepInfraReranker } from './deepinfra.ts';
 *
 * const model: DeepInfraReranker = createDeepInfraReranker();
 * const result = await rerank({ model, query, documents });
 * ```
 */
export type DeepInfraReranker = {
  readonly specificationVersion: "v3";
  readonly provider: "deepinfra";
  readonly modelId: string;
  doRerank(options: {
    documents: { type: "text"; values: string[] } | { type: "object"; values: Record<string, unknown>[] };
    query: string;
    topN?: number;
    abortSignal?: AbortSignal;
    headers?: Record<string, string | undefined>;
  }): PromiseLike<{
    ranking: Array<{ index: number; relevanceScore: number }>;
    response?: { modelId?: string; headers?: Record<string, string> };
  }>;
};

/**
 * Single rerank result item
 */
export interface RerankItem {
  /** Original index in the input documents array */
  originalIndex: number;
  /** Relevance score (higher = more relevant) */
  score: number;
  /** The original document */
  document: string;
}

/**
 * Result from reranking operation
 */
export interface RerankResult {
  /** Ranked items sorted by relevance (highest first) */
  ranking: RerankItem[];
  /** Documents in ranked order (convenience accessor) */
  rerankedDocuments: string[];
  /** Tokens consumed */
  tokensUsed: number;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * DeepInfra API error
 */
export class DeepInfraError extends Error {
  public readonly statusCode?: number;
  public readonly errorType?: string;

  constructor(
    message: string,
    statusCode?: number,
    errorType?: string,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = "DeepInfraError";
    this.statusCode = statusCode;
    this.errorType = errorType;
  }
}
