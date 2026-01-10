/**
 * Embeddings Client for Convex Actions
 *
 * Provides text embeddings via AI SDK model adapters.
 * Used for RAG context retrieval and semantic search.
 *
 * Configuration:
 * - DEEPINFRA_API_KEY: DeepInfra API key
 */

import type { EmbeddingModelV3 } from "@ai-sdk/provider";
import { embedMany, type EmbeddingModel } from "ai";
import { createQwenEmbeddingModel, QWEN_EMBEDDING_MODEL } from "./deepinfraEmbedding";
import { getEmbeddingModelWithFallback } from "./providers/registry";
import { getTaskConfigSync } from "./providers/taskConfig";
import type { AITaskSlug } from "./providers/types";

// ============================================================
// Constants
// ============================================================

const DEEPINFRA_DIMENSIONS = 4096;
const DEFAULT_TIMEOUT_MS = 30000;
const E2E_MODE =
  process.env["E2E_TEST_MODE"] === "true" ||
  process.env["E2E_MOCK_AI"] === "true";
const E2E_EMBED_MODEL = "e2e-deterministic";
const DEFAULT_EMBED_TASK = "embed_document";

// ============================================================
// Types
// ============================================================

type EmbeddingTask = "embed_document" | "embed_query";

export interface EmbeddingResult {
  embeddings: number[][];
  dimensions: number;
  model: string;
  tokenCount?: number;
}

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

// ============================================================
// Configuration
// ============================================================

export function isDeepInfraConfigured(): boolean {
  if (E2E_MODE) return true;
  return !!process.env["DEEPINFRA_API_KEY"];
}

function resolveEmbeddingModel(task: EmbeddingTask): EmbeddingModel {
  if (E2E_MODE) {
    return createDeterministicEmbeddingModel();
  }

  const config = getTaskConfigSync(task as AITaskSlug);
  const resolved = getEmbeddingModelWithFallback(
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

  if (config.directProvider === "deepinfra" && config.directModel === QWEN_EMBEDDING_MODEL) {
    return createQwenEmbeddingModel();
  }

  throw new EmbeddingError(`No embedding model available for task: ${task}`);
}

function getEmbeddingModelId(model: EmbeddingModel): string {
  if (typeof model === "string") return model;
  return model.modelId;
}

// ============================================================
// Public API
// ============================================================

export function getEmbeddingModelForTask(task: EmbeddingTask): EmbeddingModel {
  return resolveEmbeddingModel(task);
}

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  texts: string[],
  options?: { signal?: AbortSignal; task?: EmbeddingTask }
): Promise<EmbeddingResult> {
  const task = options?.task ?? DEFAULT_EMBED_TASK;
  const model = resolveEmbeddingModel(task);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const signal = options?.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal;

  try {
    const result = await embedMany({
      model,
      values: texts,
      abortSignal: signal,
    });

    clearTimeout(timeoutId);

    const dimensions = result.embeddings[0]?.length ?? DEEPINFRA_DIMENSIONS;

    return {
      embeddings: result.embeddings,
      dimensions,
      model: getEmbeddingModelId(model),
      tokenCount: result.usage.tokens,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof EmbeddingError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new EmbeddingError("Request timed out or was aborted");
    }

    throw new EmbeddingError(
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  options?: { signal?: AbortSignal; task?: EmbeddingTask }
): Promise<number[]> {
  const task = options?.task ?? "embed_query";
  const result = await generateEmbeddings([text], { ...options, task });
  return result.embeddings[0];
}

// ============================================================
// Helpers
// ============================================================

/**
 * Combine multiple abort signals into one
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }

    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  return controller.signal;
}

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalized) return [];
  return normalized.split(/\s+/).filter(Boolean);
}

function hashStringToSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function addTokenToVector(vector: number[], token: string, weight: number): void {
  const seed = hashStringToSeed(token);
  const index = seed % DEEPINFRA_DIMENSIONS;
  vector[index] = (vector[index] ?? 0) + weight;
}

function buildDeterministicEmbedding(text: string): number[] {
  const tokens = tokenize(text);
  const vector = new Array<number>(DEEPINFRA_DIMENSIONS).fill(0);

  for (const token of tokens) {
    addTokenToVector(vector, token, 1);
  }

  for (let i = 0; i < tokens.length - 1; i += 1) {
    addTokenToVector(vector, `${tokens[i]}_${tokens[i + 1]}`, 0.5);
  }

  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < vector.length; i += 1) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

function createDeterministicEmbeddingModel(): EmbeddingModelV3 {
  return {
    specificationVersion: "v3",
    provider: "deterministic",
    modelId: E2E_EMBED_MODEL,
    maxEmbeddingsPerCall: 256,
    supportsParallelCalls: true,
    async doEmbed({ values }) {
      const embeddings = values.map((value) => buildDeterministicEmbedding(value ?? ""));
      const tokenCount = values.reduce((sum, value) => sum + tokenize(value).length, 0);

      return {
        embeddings,
        usage: { tokens: tokenCount },
        warnings: [],
      };
    },
  };
}
