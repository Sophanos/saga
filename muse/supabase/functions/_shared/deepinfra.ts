/**
 * DeepInfra API Integration using Vercel AI SDK 6
 *
 * Provides embeddings and reranking via DeepInfra's API.
 * Uses Vercel AI SDK 6 for built-in retry logic, abort signals, and type safety.
 *
 * ## Models
 * - Embeddings: Qwen/Qwen3-Embedding-8B (4096 dimensions, $0.01/M tokens)
 * - Reranking: Qwen/Qwen3-Reranker-4B ($0.025/M tokens)
 *
 * ## Usage
 * ```typescript
 * import {
 *   generateEmbedding,
 *   generateEmbeddings,
 *   rerankDocuments,
 *   createDeepInfraReranker,
 * } from "./deepinfra.ts";
 *
 * // Single embedding
 * const embedding = await generateEmbedding("search query");
 *
 * // Batch embeddings
 * const result = await generateEmbeddings(["doc1", "doc2", "doc3"]);
 *
 * // Rerank search results (uses AI SDK's native rerank() internally)
 * const ranked = await rerankDocuments("query", documents, { topN: 10 });
 *
 * // Or use the reranker model directly with AI SDK's rerank()
 * import { rerank } from 'ai';
 * const model = createDeepInfraReranker();
 * const result = await rerank({ model, query, documents, topN: 5 });
 * ```
 *
 * @module deepinfra
 */

import { createOpenAI } from "./deps/ai-providers.ts";
import { embed, embedMany, rerank } from "./deps/ai.ts";
import type { RerankingModelV3 } from "./deps/ai-providers.ts";

import {
  DEEPINFRA_BASE_URL,
  DEEPINFRA_INFERENCE_URL,
  DEEPINFRA_EMBED_MODEL,
  DEEPINFRA_RERANK_MODEL,
  DEEPINFRA_DIMENSIONS,
  DeepInfraError,
  type DeepInfraConfig,
  type DeepInfraReranker,
  type EmbeddingResult,
  type RerankResult,
  type RerankItem,
} from "./deepinfra-types.ts";

// Re-export types for convenience
export {
  DeepInfraError,
  type DeepInfraConfig,
  type DeepInfraReranker,
  type EmbeddingResult,
  type RerankResult,
  type RerankItem,
};

// =============================================================================
// Configuration
// =============================================================================

/**
 * Get DeepInfra configuration from environment variables
 *
 * Required:
 * - DEEPINFRA_API_KEY: Your DeepInfra API key
 *
 * Optional:
 * - DEEPINFRA_BASE_URL: Override API base URL
 * - DEEPINFRA_EMBED_MODEL: Override embedding model
 * - DEEPINFRA_RERANK_MODEL: Override reranking model
 * - DEEPINFRA_EMBED_DIMENSIONS: Override embedding dimensions
 */
export function getDeepInfraConfig(): DeepInfraConfig {
  const apiKey = Deno.env.get("DEEPINFRA_API_KEY");
  if (!apiKey) {
    throw new DeepInfraError("DEEPINFRA_API_KEY environment variable not set");
  }

  return {
    apiKey,
    baseUrl: Deno.env.get("DEEPINFRA_BASE_URL") || DEEPINFRA_BASE_URL,
    inferenceUrl: Deno.env.get("DEEPINFRA_INFERENCE_URL") || DEEPINFRA_INFERENCE_URL,
    embedModel: Deno.env.get("DEEPINFRA_EMBED_MODEL") || DEEPINFRA_EMBED_MODEL,
    rerankModel: Deno.env.get("DEEPINFRA_RERANK_MODEL") || DEEPINFRA_RERANK_MODEL,
    dimensions: parseInt(
      Deno.env.get("DEEPINFRA_EMBED_DIMENSIONS") || String(DEEPINFRA_DIMENSIONS),
      10
    ),
  };
}

/**
 * Check if DeepInfra is configured
 */
export function isDeepInfraConfigured(): boolean {
  return !!Deno.env.get("DEEPINFRA_API_KEY");
}

// =============================================================================
// Provider Factory
// =============================================================================

/**
 * Create an OpenAI-compatible provider for DeepInfra
 */
function createDeepInfraProvider(apiKey: string, baseUrl: string) {
  return createOpenAI({
    apiKey,
    baseURL: baseUrl,
  });
}

// =============================================================================
// Embeddings
// =============================================================================

/**
 * Generate embeddings for multiple texts using AI SDK
 *
 * Uses embedMany for batch processing with automatic retry logic.
 *
 * @param inputs - Array of texts to embed (max recommended: 32)
 * @param config - Optional configuration override
 * @returns Embedding result with vectors and metadata
 *
 * @example
 * ```typescript
 * const result = await generateEmbeddings(["hello world", "test query"]);
 * console.log(result.embeddings.length); // 2
 * console.log(result.dimensions); // 4096
 * ```
 */
export async function generateEmbeddings(
  inputs: string[],
  config?: Partial<DeepInfraConfig>
): Promise<EmbeddingResult> {
  const envConfig = getDeepInfraConfig();
  const finalConfig: DeepInfraConfig = { ...envConfig, ...config };

  const provider = createDeepInfraProvider(finalConfig.apiKey, finalConfig.baseUrl);

  try {
    // Create embedding model (dimensions passed in embed call in v6)
    const embeddingModel = provider.embeddingModel(finalConfig.embedModel);

    if (inputs.length === 1) {
      // Use embed() for single input (slightly more efficient)
      const result = await embed({
        model: embeddingModel,
        value: inputs[0],
        experimental_dimensions: finalConfig.dimensions,
      });

      return {
        embeddings: [result.embedding],
        model: finalConfig.embedModel,
        dimensions: result.embedding.length,
        tokensUsed: result.usage?.tokens ?? 0,
      };
    }

    // Use embedMany() for batch processing
    const result = await embedMany({
      model: embeddingModel,
      values: inputs,
      experimental_dimensions: finalConfig.dimensions,
    });

    const actualDimensions = result.embeddings[0]?.length ?? 0;
    if (actualDimensions !== finalConfig.dimensions) {
      console.warn(
        `[DeepInfra] Expected ${finalConfig.dimensions} dimensions, got ${actualDimensions}`
      );
    }

    return {
      embeddings: result.embeddings,
      model: finalConfig.embedModel,
      dimensions: actualDimensions,
      tokensUsed: result.usage?.tokens ?? 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DeepInfraError(`Failed to generate embeddings: ${message}`, undefined, undefined, error);
  }
}

/**
 * Generate a single embedding (convenience wrapper)
 *
 * @param input - Text to embed
 * @param config - Optional configuration override
 * @returns Embedding vector (array of numbers)
 *
 * @example
 * ```typescript
 * const embedding = await generateEmbedding("search query");
 * console.log(embedding.length); // 4096
 * ```
 */
export async function generateEmbedding(
  input: string,
  config?: Partial<DeepInfraConfig>
): Promise<number[]> {
  const result = await generateEmbeddings([input], config);
  return result.embeddings[0];
}

// =============================================================================
// Reranking - AI SDK Native Implementation
// =============================================================================

/**
 * DeepInfra reranker request shape (internal)
 */
interface DeepInfraRerankRequest {
  queries: string[];
  documents: string[];
}

/**
 * DeepInfra reranker response shape (internal)
 */
interface DeepInfraRerankResponse {
  scores: number[];
  input_tokens: number;
}

/**
 * Create a DeepInfra reranking model compatible with AI SDK's rerank() function.
 *
 * This implements the RerankingModelV3 interface to wrap DeepInfra's proprietary
 * reranker API, enabling use with the standard AI SDK rerank() function.
 *
 * @param modelId - The model ID (default: Qwen/Qwen3-Reranker-4B)
 * @param config - Optional configuration override
 * @returns A RerankingModelV3 compatible model
 *
 * @example
 * ```typescript
 * import { rerank } from 'ai';
 *
 * const model = createDeepInfraReranker();
 * const result = await rerank({
 *   model,
 *   query: "What is the capital of France?",
 *   documents: ["Paris is the capital", "London is big"],
 *   topN: 5,
 * });
 * ```
 */
export function createDeepInfraReranker(
  modelId?: string,
  config?: Partial<DeepInfraConfig>
): RerankingModelV3 {
  const envConfig = getDeepInfraConfig();
  const finalConfig: DeepInfraConfig = { ...envConfig, ...config };
  const finalModelId = modelId ?? finalConfig.rerankModel;

  return {
    specificationVersion: "v3",
    provider: "deepinfra",
    modelId: finalModelId,

    async doRerank(options) {
      const { documents, query, topN, abortSignal, headers: additionalHeaders } = options;

      // Extract text values from documents
      const documentTexts =
        documents.type === "text"
          ? documents.values
          : documents.values.map((obj) => JSON.stringify(obj));

      if (documentTexts.length === 0) {
        return { ranking: [] };
      }

      const rerankUrl = `${finalConfig.inferenceUrl}/${finalModelId}`;

      const response = await fetch(rerankUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${finalConfig.apiKey}`,
          ...additionalHeaders,
        },
        body: JSON.stringify({
          queries: [query],
          documents: documentTexts,
        } as DeepInfraRerankRequest),
        signal: abortSignal,
      });

      if (!response.ok) {
        let errorMessage = `DeepInfra reranker error: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new DeepInfraError(errorMessage, response.status, "rerank_error");
      }

      const data = (await response.json()) as DeepInfraRerankResponse;

      // Build ranking sorted by score (descending)
      const ranking = documentTexts
        .map((_, index) => ({
          index,
          relevanceScore: data.scores[index] ?? 0,
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, topN ?? documentTexts.length);

      return {
        ranking,
        response: {
          modelId: finalModelId,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    },
  };
}

/**
 * Rerank documents using AI SDK's native rerank() function
 *
 * This is the recommended way to rerank documents, using AI SDK's built-in
 * retry logic, abort signals, and telemetry support.
 *
 * @param query - The search query
 * @param documents - Array of documents to rerank
 * @param options - Reranking options (topN, config, abortSignal)
 * @returns Rerank result with sorted documents and scores
 *
 * @example
 * ```typescript
 * const result = await rerankDocuments(
 *   "What is the capital of France?",
 *   ["Paris is beautiful", "London is big", "France's capital is Paris"],
 *   { topN: 2 }
 * );
 * console.log(result.ranking[0].document); // "France's capital is Paris"
 * ```
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  options?: {
    topN?: number;
    config?: Partial<DeepInfraConfig>;
    abortSignal?: AbortSignal;
    maxRetries?: number;
  }
): Promise<RerankResult> {
  if (documents.length === 0) {
    return { ranking: [], rerankedDocuments: [], tokensUsed: 0 };
  }

  const model = createDeepInfraReranker(undefined, options?.config);

  try {
    const result = await rerank({
      model,
      query,
      documents,
      topN: options?.topN,
      abortSignal: options?.abortSignal,
      maxRetries: options?.maxRetries ?? 2,
    });

    // Map AI SDK result to our RerankResult format
    const ranking: RerankItem[] = result.results.map((item) => ({
      originalIndex: item.index,
      score: item.relevanceScore,
      document: documents[item.index],
    }));

    return {
      ranking,
      rerankedDocuments: ranking.map((item) => item.document),
      // Note: AI SDK doesn't expose token usage for reranking
      tokensUsed: 0,
    };
  } catch (error) {
    if (error instanceof DeepInfraError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DeepInfraError(
      `Failed to rerank documents: ${message}`,
      undefined,
      undefined,
      error
    );
  }
}
