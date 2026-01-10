/**
 * DeepInfra reranking model adapter for AI SDK.
 */

import type { RerankingModelV3 } from "@ai-sdk/provider";

const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";
const DEFAULT_RERANK_MODEL = "Qwen/Qwen3-Reranker-4B";

interface DeepInfraRerankResponse {
  scores?: number[];
}

function serializeHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

export function createDeepInfraRerankingModel(options?: {
  apiKey?: string;
  modelId?: string;
  baseUrl?: string;
}): RerankingModelV3 {
  const apiKey = options?.apiKey ?? process.env["DEEPINFRA_API_KEY"];
  if (!apiKey) {
    throw new Error("DEEPINFRA_API_KEY not configured");
  }

  const modelId = options?.modelId ?? process.env["DEEPINFRA_RERANK_MODEL"] ?? DEFAULT_RERANK_MODEL;
  const baseUrl = options?.baseUrl ?? DEEPINFRA_INFERENCE_URL;

  return {
    specificationVersion: "v3",
    provider: "deepinfra",
    modelId,
    async doRerank({ documents, query, topN, abortSignal, headers }) {
      const values =
        documents.type === "text"
          ? documents.values
          : documents.values.map((value) => JSON.stringify(value));

      const response = await fetch(`${baseUrl}/${modelId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(headers ?? {}),
        },
        body: JSON.stringify({
          queries: [query],
          documents: values,
        }),
        signal: abortSignal,
      });

      const responseBody = (await response.json()) as DeepInfraRerankResponse;
      if (!response.ok || !Array.isArray(responseBody.scores)) {
        throw new Error("DeepInfra rerank error: invalid response");
      }

      const ranking = responseBody.scores
        .map((score, index) => ({ index, relevanceScore: score }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);

      const limitedRanking = topN ? ranking.slice(0, topN) : ranking;

      return {
        ranking: limitedRanking,
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId,
          headers: serializeHeaders(response.headers),
          body: responseBody,
        },
      };
    },
  };
}
