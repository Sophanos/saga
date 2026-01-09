/**
 * DeepInfra reranker client.
 */

const DEEPINFRA_INFERENCE_URL = "https://api.deepinfra.com/v1/inference";
const DEFAULT_RERANK_MODEL = "Qwen/Qwen3-Reranker-4B";
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

function getApiKey(): string {
  const apiKey = process.env["DEEPINFRA_API_KEY"];
  if (!apiKey) {
    throw new RerankError("DEEPINFRA_API_KEY environment variable not set");
  }
  return apiKey;
}

export async function rerank(
  query: string,
  documents: string[],
  options?: { timeoutMs?: number }
): Promise<number[]> {
  if (documents.length === 0) return [];

  const apiKey = getApiKey();
  const modelId = process.env["DEEPINFRA_RERANK_MODEL"] ?? DEFAULT_RERANK_MODEL;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${DEEPINFRA_INFERENCE_URL}/${modelId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        queries: [query],
        documents,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let message = `DeepInfra rerank error: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          message = errorData.error.message;
        }
      } catch {
        // ignore JSON errors
      }
      throw new RerankError(message, response.status);
    }

    const data = (await response.json()) as { scores?: number[] };
    if (!Array.isArray(data.scores)) {
      throw new RerankError("Invalid rerank response: missing scores");
    }

    return data.scores;
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
