/**
 * Reranking client using AI SDK model adapters.
 */

import { rerank as aiRerank, type RerankingModel } from "ai";
import { createDeepInfraRerankingModel } from "./deepinfraRerank";
import { getRerankingModelWithFallback } from "./providers/registry";
import { getTaskConfigSync } from "./providers/taskConfig";
import type { AITaskSlug } from "./providers/types";

const DEFAULT_TIMEOUT_MS = 10000;

export class RerankError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "RerankError";
  }
}

export function isRerankConfigured(): boolean {
  return !!process.env["DEEPINFRA_API_KEY"];
}

function resolveRerankingModel(): RerankingModel {
  const config = getTaskConfigSync("rerank_candidates" as AITaskSlug);
  const resolved = getRerankingModelWithFallback(
    config.directProvider,
    config.directModel,
    config.fallback1Provider,
    config.fallback1Model,
    config.fallback2Provider,
    config.fallback2Model
  );

  if (resolved) {
    return resolved.model;
  }

  return createDeepInfraRerankingModel();
}

export async function rerank(
  query: string,
  documents: string[],
  options?: { timeoutMs?: number; topN?: number }
): Promise<number[]> {
  if (documents.length === 0) return [];

  const model = resolveRerankingModel();
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await aiRerank({
      model,
      documents,
      query,
      topN: options?.topN,
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutId);

    const scores = new Array<number>(documents.length).fill(0);
    for (const item of result.ranking) {
      scores[item.originalIndex] = item.score;
    }

    return scores;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof RerankError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new RerankError("Rerank request timed out");
    }
    throw new RerankError(error instanceof Error ? error.message : "Rerank failed");
  }
}
