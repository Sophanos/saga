/**
 * Embeddings Client for Convex Actions
 *
 * Provides text embeddings via DeepInfra API (Qwen3-Embedding-8B).
 * Used for RAG context retrieval and semantic search.
 *
 * Configuration:
 * - DEEPINFRA_API_KEY: DeepInfra API key
 */

// ============================================================
// Constants
// ============================================================

const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";
const DEEPINFRA_EMBED_MODEL = "Qwen/Qwen3-Embedding-8B";
const DEEPINFRA_DIMENSIONS = 4096;
const DEFAULT_TIMEOUT_MS = 30000;

// ============================================================
// Types
// ============================================================

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
  return !!process.env["DEEPINFRA_API_KEY"];
}

function getApiKey(): string {
  const apiKey = process.env["DEEPINFRA_API_KEY"];
  if (!apiKey) {
    throw new EmbeddingError("DEEPINFRA_API_KEY environment variable not set");
  }
  return apiKey;
}

// ============================================================
// Public API
// ============================================================

/**
 * Generate embeddings for multiple texts
 */
export async function generateEmbeddings(
  texts: string[],
  options?: { signal?: AbortSignal }
): Promise<EmbeddingResult> {
  const apiKey = getApiKey();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  // Combine signals if one was provided
  const signal = options?.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal;

  try {
    const response = await fetch(`${DEEPINFRA_INFERENCE_URL}/${DEEPINFRA_EMBED_MODEL}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: texts,
        normalize: true,
        truncate: true,
      }),
      signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new EmbeddingError(
        `DeepInfra API error: ${response.status} - ${errorText}`,
        response.status
      );
    }

    const data = await response.json();

    // DeepInfra returns embeddings directly in the response
    const embeddings = data.embeddings ?? data;

    if (!Array.isArray(embeddings) || embeddings.length === 0) {
      throw new EmbeddingError("Invalid response: no embeddings returned");
    }

    return {
      embeddings,
      dimensions: DEEPINFRA_DIMENSIONS,
      model: DEEPINFRA_EMBED_MODEL,
      tokenCount: data.input_tokens,
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
  options?: { signal?: AbortSignal }
): Promise<number[]> {
  const result = await generateEmbeddings([text], options);
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
