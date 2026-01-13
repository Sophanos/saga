/**
 * Custom DeepInfra Embedding Model for AI SDK
 *
 * Why custom? The official @ai-sdk/deepinfra doesn't include Qwen/Qwen3-Embedding-8B.
 * This wrapper implements the EmbeddingModelV3 interface for use with Convex Agent.
 *
 * Model: Qwen/Qwen3-Embedding-8B (4096 dimensions)
 * Endpoint: https://api.deepinfra.com/v1/inference/{model}
 */

import type { EmbeddingModelV3 } from "@ai-sdk/provider";

const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";
export const QWEN_EMBEDDING_MODEL = "Qwen/Qwen3-Embedding-8B";
const EMBEDDING_DIMENSIONS = 4096;
const MIN_EMBEDDING_DIMENSIONS = 32;

interface DeepInfraEmbeddingResponse {
  embeddings: number[][];
  input_tokens?: number;
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
export function createQwenEmbeddingModel(): EmbeddingModelV3 {
  return {
    specificationVersion: "v3",
    modelId: QWEN_EMBEDDING_MODEL,
    provider: "deepinfra",
    maxEmbeddingsPerCall: 96,
    supportsParallelCalls: true,

    async doEmbed({ values, abortSignal }) {
      const apiKey = process.env["DEEPINFRA_API_KEY"];
      if (!apiKey) {
        throw new Error("DEEPINFRA_API_KEY not configured");
      }

      const configuredDimensions = parseInt(
        process.env["DEEPINFRA_EMBEDDING_DIMENSIONS"] ?? "",
        10
      );
      const dimensions =
        Number.isFinite(configuredDimensions) &&
        configuredDimensions >= MIN_EMBEDDING_DIMENSIONS &&
        configuredDimensions <= EMBEDDING_DIMENSIONS
          ? configuredDimensions
          : EMBEDDING_DIMENSIONS;

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
            dimensions,
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
        warnings: [],
      };
    },
  };
}

/**
 * Embedding model dimensions (for reference).
 */
export const QWEN_EMBEDDING_DIMENSIONS = EMBEDDING_DIMENSIONS;
