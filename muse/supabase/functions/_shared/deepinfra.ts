/**
 * DeepInfra API Helper for Supabase Edge Functions
 *
 * Provides a thin wrapper around DeepInfra's OpenAI-compatible embeddings API.
 * Uses server-side environment variables (not exposed to client).
 */

/**
 * Default configuration values
 *
 * Using 4096 dimensions (native for Qwen3-Embedding-8B) for best quality.
 * Qdrant-only architecture - no pgvector compatibility constraints.
 */
const DEFAULT_BASE_URL = "https://api.deepinfra.com/v1/openai";
const DEFAULT_EMBED_MODEL = "Qwen/Qwen3-Embedding-8B";
const DEFAULT_RERANK_MODEL = "Qwen/Qwen3-Reranker-4B";
const DEFAULT_RERANK_URL = "https://api.deepinfra.com/v1/inference";
const DEFAULT_DIMENSIONS = 4096;

/**
 * DeepInfra embeddings request shape (OpenAI-compatible)
 */
interface DeepInfraEmbeddingsRequest {
  model: string;
  input: string | string[];
  dimensions?: number;
}

/**
 * Single embedding object in DeepInfra response
 */
interface EmbeddingObject {
  object: "embedding";
  embedding: number[];
  index: number;
}

/**
 * DeepInfra embeddings response shape (OpenAI-compatible)
 */
interface DeepInfraEmbeddingsResponse {
  object: "list";
  data: EmbeddingObject[];
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * DeepInfra error response shape
 */
interface DeepInfraErrorResponse {
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

/**
 * Configuration for DeepInfra client
 */
export interface DeepInfraConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  rerankModel?: string;
  rerankUrl?: string;
}

/**
 * Result from embedding generation
 */
export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
  tokensUsed: number;
}

/**
 * DeepInfra API error
 */
export class DeepInfraError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly errorType?: string
  ) {
    super(message);
    this.name = "DeepInfraError";
  }
}

/**
 * Get DeepInfra configuration from environment
 */
export function getDeepInfraConfig(): DeepInfraConfig {
  const apiKey = Deno.env.get("DEEPINFRA_API_KEY");
  if (!apiKey) {
    throw new DeepInfraError("DEEPINFRA_API_KEY environment variable not set");
  }

  return {
    apiKey,
    baseUrl: Deno.env.get("DEEPINFRA_BASE_URL") || DEFAULT_BASE_URL,
    model: Deno.env.get("DEEPINFRA_EMBED_MODEL") || DEFAULT_EMBED_MODEL,
    dimensions: parseInt(Deno.env.get("DEEPINFRA_EMBED_DIMENSIONS") || String(DEFAULT_DIMENSIONS), 10),
    rerankModel: Deno.env.get("DEEPINFRA_RERANK_MODEL") || DEFAULT_RERANK_MODEL,
    rerankUrl: Deno.env.get("DEEPINFRA_RERANK_URL") || DEFAULT_RERANK_URL,
  };
}

/**
 * Generate embeddings using DeepInfra API
 *
 * @param inputs - Array of texts to embed
 * @param config - Optional configuration override
 * @returns Embedding result with vectors and metadata
 */
export async function generateEmbeddings(
  inputs: string[],
  config?: Partial<DeepInfraConfig>
): Promise<EmbeddingResult> {
  // Merge with environment config
  const envConfig = getDeepInfraConfig();
  const finalConfig: DeepInfraConfig = {
    ...envConfig,
    ...config,
  };

  const url = `${finalConfig.baseUrl}/embeddings`;

  const requestBody: DeepInfraEmbeddingsRequest = {
    model: finalConfig.model!,
    input: inputs,
    dimensions: finalConfig.dimensions,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${finalConfig.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    let errorMessage = `DeepInfra API error: ${response.status}`;
    let errorType: string | undefined;

    try {
      const errorData = (await response.json()) as DeepInfraErrorResponse;
      if (errorData.error) {
        errorMessage = errorData.error.message;
        errorType = errorData.error.type;
      }
    } catch {
      // Ignore JSON parse errors
    }

    throw new DeepInfraError(errorMessage, response.status, errorType);
  }

  const data = (await response.json()) as DeepInfraEmbeddingsResponse;

  // Sort by index to ensure correct order
  const sortedData = [...data.data].sort((a, b) => a.index - b.index);
  const embeddings = sortedData.map((item) => item.embedding);

  // Validate dimensions
  const actualDimensions = embeddings[0]?.length ?? 0;
  if (actualDimensions !== finalConfig.dimensions) {
    console.warn(
      `[DeepInfra] Expected ${finalConfig.dimensions} dimensions, got ${actualDimensions}`
    );
  }

  return {
    embeddings,
    model: data.model,
    dimensions: actualDimensions,
    tokensUsed: data.usage.total_tokens,
  };
}

/**
 * Generate a single embedding (convenience wrapper)
 */
export async function generateEmbedding(
  input: string,
  config?: Partial<DeepInfraConfig>
): Promise<number[]> {
  const result = await generateEmbeddings([input], config);
  return result.embeddings[0];
}

/**
 * Check if DeepInfra is configured
 *
 * Returns true if the DEEPINFRA_API_KEY environment variable is set.
 */
export function isDeepInfraConfigured(): boolean {
  return !!Deno.env.get("DEEPINFRA_API_KEY");
}
