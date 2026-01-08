/**
 * Custom DeepInfra Embedding Model for AI SDK
 *
 * Why custom? The official @ai-sdk/deepinfra doesn't include Qwen/Qwen3-Embedding-8B.
 * This wrapper implements the EmbeddingModelV1 interface for use with Convex Agent.
 *
 * Model: Qwen/Qwen3-Embedding-8B (4096 dimensions)
 * Endpoint: https://api.deepinfra.com/v1/inference/{model}
 */

const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";
const QWEN_EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-8B";
const EMBEDDING_DIMENSIONS = 4096;

interface DeepInfraEmbeddingResponse {
  embeddings: number[][];
  input_tokens?: number;
}

/**
 * AI SDK EmbeddingModelV1 interface (simplified for our use case)
 */
interface EmbeddingModelV1<VALUE> {
  readonly specificationVersion: "v1";
  readonly modelId: string;
  readonly provider: string;
  readonly maxEmbeddingsPerCall?: number;
  readonly supportsParallelCalls?: boolean;

  doEmbed(options: {
    values: VALUE[];
    abortSignal?: AbortSignal;
  }): Promise<{
    embeddings: number[][];
    usage?: { tokens: number };
    rawResponse?: { headers?: Record<string, string> };
  }>;
}

/**
 * Creates an AI SDK compatible embedding model for Qwen3-Embedding-8B.
 *
 * Usage with Convex Agent:
 * ```ts
 * const agent = new Agent(components.agent, {
 *   textEmbeddingModel: createQwenEmbeddingModel(),
 *   // ...
 * });
 * ```
 */
export function createQwenEmbeddingModel(): EmbeddingModelV1<string> {
  return {
    specificationVersion: "v1",
    modelId: QWEN_EMBEDDING_MODEL,
    provider: "deepinfra",
    maxEmbeddingsPerCall: 96,
    supportsParallelCalls: true,

    async doEmbed({ values, abortSignal }) {
      const apiKey = process.env.DEEPINFRA_API_KEY;
      if (!apiKey) {
        throw new Error("DEEPINFRA_API_KEY not configured");
      }

      const response = await fetch(
        `${DEEPINFRA_INFERENCE_URL}/${QWEN_EMBEDDING_MODEL}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            inputs: values,
            normalize: true,
            truncate: true,
          }),
          signal: abortSignal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`DeepInfra embedding error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as DeepInfraEmbeddingResponse;
      const embeddings = data.embeddings;

      if (!Array.isArray(embeddings) || embeddings.length === 0) {
        throw new Error("Invalid response: no embeddings returned");
      }

      return {
        embeddings,
        usage: data.input_tokens ? { tokens: data.input_tokens } : undefined,
      };
    },
  };
}

/**
 * Embedding model dimensions (for reference).
 */
export const QWEN_EMBEDDING_DIMENSIONS = EMBEDDING_DIMENSIONS;
