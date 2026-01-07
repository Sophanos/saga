/**
 * Qdrant REST API Client for Convex Actions
 *
 * Provides vector search and storage operations via Qdrant REST API.
 * Used for RAG context retrieval and memory search.
 *
 * Configuration:
 * - QDRANT_URL: Base URL for Qdrant instance
 * - QDRANT_API_KEY: API key for authentication
 * - QDRANT_COLLECTION: Collection name (default: saga_vectors)
 */

// ============================================================
// Constants
// ============================================================

const DEFAULT_COLLECTION = "saga_vectors";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_RETRY_MAX_DELAY_MS = 5000;

// ============================================================
// Types
// ============================================================

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
  vector?: number[];
}

export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

export type QdrantCondition =
  | { key: string; match: { value: string | number | boolean } }
  | { key: string; match: { any: Array<string | number | boolean> } }
  | { key: string; range: { gte?: number; lte?: number; gt?: number; lt?: number } }
  | { has_id: string[] };

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection: string;
}

export class QdrantError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly qdrantStatus?: string
  ) {
    super(message);
    this.name = "QdrantError";
  }
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

// ============================================================
// Configuration
// ============================================================

function getRetryConfig(): RetryConfig {
  return {
    timeoutMs: parseInt(process.env.QDRANT_TIMEOUT_MS ?? "", 10) || DEFAULT_TIMEOUT_MS,
    maxRetries: parseInt(process.env.QDRANT_MAX_RETRIES ?? "", 10) || DEFAULT_MAX_RETRIES,
    baseDelayMs: parseInt(process.env.QDRANT_RETRY_BASE_DELAY_MS ?? "", 10) || DEFAULT_RETRY_BASE_DELAY_MS,
    maxDelayMs: DEFAULT_RETRY_MAX_DELAY_MS,
  };
}

export function getQdrantConfig(): QdrantConfig {
  const url = process.env.QDRANT_URL;
  if (!url) {
    throw new QdrantError("QDRANT_URL environment variable not set");
  }

  return {
    url: url.replace(/\/$/, ""),
    apiKey: process.env.QDRANT_API_KEY,
    collection: process.env.QDRANT_COLLECTION || DEFAULT_COLLECTION,
  };
}

export function isQdrantConfigured(): boolean {
  return !!process.env.QDRANT_URL;
}

// ============================================================
// Internal Helpers
// ============================================================

function isRetryableError(error: unknown, statusCode?: number): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  if (statusCode) {
    return (
      statusCode === 408 ||
      statusCode === 429 ||
      statusCode >= 500
    );
  }

  return false;
}

function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  return Math.random() * cappedDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function qdrantRequest<T>(
  config: QdrantConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${config.url}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["api-key"] = config.apiKey;
  }

  const retryConfig = getRetryConfig();
  let lastError: Error | null = null;
  let lastStatusCode: number | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), retryConfig.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok || data.status?.error) {
        lastStatusCode = response.status;
        const errorMessage = data.status?.error || `Qdrant API error: ${response.status}`;
        const error = new QdrantError(errorMessage, response.status, data.status?.error);

        if (attempt < retryConfig.maxRetries && isRetryableError(error, response.status)) {
          const delay = calculateBackoffDelay(attempt, retryConfig);
          console.warn(
            `[qdrant] Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), ` +
            `status=${response.status}, retrying in ${Math.round(delay)}ms...`
          );
          await sleep(delay);
          continue;
        }

        throw error;
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error as Error;

      if (attempt < retryConfig.maxRetries && isRetryableError(error, lastStatusCode)) {
        const delay = calculateBackoffDelay(attempt, retryConfig);
        console.warn(
          `[qdrant] Request failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), ` +
          `error=${(error as Error).message}, retrying in ${Math.round(delay)}ms...`
        );
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new QdrantError("Request failed after retries");
}

// ============================================================
// Public API
// ============================================================

export async function searchPoints(
  vector: number[],
  limit: number = 10,
  filter?: QdrantFilter,
  config?: Partial<QdrantConfig>
): Promise<QdrantSearchResult[]> {
  const envConfig = getQdrantConfig();
  const finalConfig: QdrantConfig = { ...envConfig, ...config };

  const body: Record<string, unknown> = {
    vector,
    limit,
    with_payload: true,
  };

  if (filter) {
    body.filter = filter;
  }

  const response = await qdrantRequest<{ result: QdrantSearchResult[] }>(
    finalConfig,
    "POST",
    `/collections/${finalConfig.collection}/points/search`,
    body
  );

  return response.result;
}

export async function upsertPoints(
  points: QdrantPoint[],
  config?: Partial<QdrantConfig>
): Promise<void> {
  const envConfig = getQdrantConfig();
  const finalConfig: QdrantConfig = { ...envConfig, ...config };

  await qdrantRequest(
    finalConfig,
    "PUT",
    `/collections/${finalConfig.collection}/points`,
    {
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    }
  );
}

export async function deletePoints(
  ids: string[],
  config?: Partial<QdrantConfig>
): Promise<void> {
  const envConfig = getQdrantConfig();
  const finalConfig: QdrantConfig = { ...envConfig, ...config };

  await qdrantRequest(
    finalConfig,
    "POST",
    `/collections/${finalConfig.collection}/points/delete`,
    { points: ids }
  );
}

export async function deletePointsByFilter(
  filter: QdrantFilter,
  config?: Partial<QdrantConfig>
): Promise<void> {
  const envConfig = getQdrantConfig();
  const finalConfig: QdrantConfig = { ...envConfig, ...config };

  await qdrantRequest(
    finalConfig,
    "POST",
    `/collections/${finalConfig.collection}/points/delete`,
    { filter }
  );
}

export interface QdrantScrollResult {
  id: string;
  payload: Record<string, unknown>;
  vector?: number[];
}

export interface QdrantOrderBy {
  key: string;
  direction?: "asc" | "desc";
}

export async function scrollPoints(
  filter: QdrantFilter,
  limit: number = 20,
  options?: { orderBy?: QdrantOrderBy },
  config?: Partial<QdrantConfig>
): Promise<QdrantScrollResult[]> {
  const envConfig = getQdrantConfig();
  const finalConfig: QdrantConfig = { ...envConfig, ...config };

  const body: Record<string, unknown> = {
    filter,
    limit,
    with_payload: true,
    with_vector: false,
  };

  if (options?.orderBy?.key) {
    body.order_by = {
      key: options.orderBy.key,
      direction: options.orderBy.direction ?? "desc",
    };
  }

  const response = await qdrantRequest<{
    result: { points: Array<{ id: string; payload: Record<string, unknown> }> };
  }>(
    finalConfig,
    "POST",
    `/collections/${finalConfig.collection}/points/scroll`,
    body
  );

  return response.result.points.map((p) => ({
    id: String(p.id),
    payload: p.payload,
  }));
}

export async function healthCheck(
  config?: Partial<QdrantConfig>
): Promise<{
  healthy: boolean;
  status?: string;
  vectorsCount?: number;
  pointsCount?: number;
  error?: string;
}> {
  try {
    const envConfig = getQdrantConfig();
    const finalConfig: QdrantConfig = { ...envConfig, ...config };

    const response = await qdrantRequest<{ result: Record<string, unknown> }>(
      finalConfig,
      "GET",
      `/collections/${finalConfig.collection}`
    );

    return {
      healthy: true,
      status: response.result.status as string,
      vectorsCount: response.result.vectors_count as number,
      pointsCount: response.result.points_count as number,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
