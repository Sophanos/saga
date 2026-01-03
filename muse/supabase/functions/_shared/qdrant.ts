/**
 * Qdrant REST API Helper for Supabase Edge Functions (MLP 2.x)
 *
 * Provides a thin wrapper around Qdrant's REST API for vector operations.
 * Uses server-side environment variables (not exposed to client).
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Configurable timeouts
 * - Graceful degradation support
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Default collection name
 */
const DEFAULT_COLLECTION = "saga_vectors";

/**
 * Default timeout in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Default retry configuration
 */
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_RETRY_MAX_DELAY_MS = 5000;

/**
 * Qdrant point structure
 */
export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

/**
 * Qdrant search result
 */
export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
  vector?: number[];
}

/**
 * Qdrant filter condition
 */
export interface QdrantFilter {
  must?: QdrantCondition[];
  should?: QdrantCondition[];
  must_not?: QdrantCondition[];
}

/**
 * Qdrant condition types
 */
export type QdrantCondition =
  | { key: string; match: { value: string | number | boolean } }
  | { key: string; match: { any: Array<string | number | boolean> } }
  | { key: string; range: { gte?: number; lte?: number; gt?: number; lt?: number } }
  | { has_id: string[] };

/**
 * Qdrant configuration
 */
export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection: string;
}

/**
 * Qdrant API error
 */
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

/**
 * Retry configuration
 */
export interface QdrantRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

/**
 * Get retry configuration from environment
 */
function getRetryConfig(): QdrantRetryConfig {
  return {
    timeoutMs: parseInt(Deno.env.get("QDRANT_TIMEOUT_MS") ?? "", 10) || DEFAULT_TIMEOUT_MS,
    maxRetries: parseInt(Deno.env.get("QDRANT_MAX_RETRIES") ?? "", 10) || DEFAULT_MAX_RETRIES,
    baseDelayMs: parseInt(Deno.env.get("QDRANT_RETRY_BASE_DELAY_MS") ?? "", 10) || DEFAULT_RETRY_BASE_DELAY_MS,
    maxDelayMs: DEFAULT_RETRY_MAX_DELAY_MS,
  };
}

/**
 * Get Qdrant configuration from environment
 */
export function getQdrantConfig(): QdrantConfig {
  const url = Deno.env.get("QDRANT_URL");
  if (!url) {
    throw new QdrantError("QDRANT_URL environment variable not set");
  }

  return {
    url: url.replace(/\/$/, ""), // Remove trailing slash
    apiKey: Deno.env.get("QDRANT_API_KEY"),
    collection: Deno.env.get("QDRANT_COLLECTION") || DEFAULT_COLLECTION,
  };
}

/**
 * Check if Qdrant is configured
 */
export function isQdrantConfigured(): boolean {
  return !!Deno.env.get("QDRANT_URL");
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown, statusCode?: number): boolean {
  // Network errors are retryable
  if (error instanceof TypeError) {
    return true; // fetch network error
  }

  // Timeout/abort errors are retryable
  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  // Specific HTTP status codes are retryable
  if (statusCode) {
    return (
      statusCode === 408 || // Request Timeout
      statusCode === 429 || // Too Many Requests
      statusCode >= 500 // Server errors
    );
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(attempt: number, config: QdrantRetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Full jitter: random value between 0 and cappedDelay
  return Math.random() * cappedDelay;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Make a request to Qdrant API with retry logic
 */
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
    // Create abort controller with timeout
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

        // Check if retryable
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

      // Check if retryable
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

  // Should not reach here, but just in case
  throw lastError ?? new QdrantError("Request failed after retries");
}

/**
 * Make a request to Qdrant API without retries (for non-critical operations)
 */
async function qdrantRequestNoRetry<T>(
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), retryConfig.timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok || data.status?.error) {
      const errorMessage = data.status?.error || `Qdrant API error: ${response.status}`;
      throw new QdrantError(errorMessage, response.status, data.status?.error);
    }

    return data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Upsert points to Qdrant collection
 *
 * @param points - Array of points to upsert
 * @param config - Optional configuration override
 */
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

/**
 * Search for similar vectors in Qdrant
 *
 * @param vector - Query vector
 * @param limit - Maximum number of results
 * @param filter - Optional filter conditions
 * @param config - Optional configuration override
 */
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

/**
 * Delete points by IDs
 *
 * @param ids - Array of point IDs to delete
 * @param config - Optional configuration override
 */
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
    {
      points: ids,
    }
  );
}

/**
 * Delete points by filter (e.g., all points for a project)
 *
 * @param filter - Filter conditions for deletion
 * @param config - Optional configuration override
 */
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
    {
      filter,
    }
  );
}

/**
 * Get collection info (useful for health checks)
 *
 * @param config - Optional configuration override
 */
export async function getCollectionInfo(
  config?: Partial<QdrantConfig>
): Promise<Record<string, unknown>> {
  const envConfig = getQdrantConfig();
  const finalConfig: QdrantConfig = { ...envConfig, ...config };

  const response = await qdrantRequest<{ result: Record<string, unknown> }>(
    finalConfig,
    "GET",
    `/collections/${finalConfig.collection}`
  );

  return response.result;
}

/**
 * Scroll result from Qdrant (for listing without query vector)
 */
export interface QdrantScrollResult {
  id: string;
  payload: Record<string, unknown>;
  vector?: number[];
}

export interface QdrantOrderBy {
  key: string;
  direction?: "asc" | "desc";
}

export interface QdrantScrollOptions {
  orderBy?: QdrantOrderBy;
}

/**
 * Scroll points in Qdrant collection (list without query vector)
 *
 * Use this when you need to list/filter points without semantic search.
 * Results are returned in arbitrary order unless you sort client-side.
 *
 * @param filter - Filter conditions
 * @param limit - Maximum number of results
 * @param config - Optional configuration override
 */
export async function scrollPoints(
  filter: QdrantFilter,
  limit: number = 20,
  options?: QdrantScrollOptions,
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

/**
 * Count points matching a filter
 *
 * @param filter - Filter conditions
 * @param config - Optional configuration override
 */
export async function countPoints(
  filter: QdrantFilter,
  config?: Partial<QdrantConfig>
): Promise<number> {
  const envConfig = getQdrantConfig();
  const finalConfig: QdrantConfig = { ...envConfig, ...config };

  const response = await qdrantRequest<{ result: { count: number } }>(
    finalConfig,
    "POST",
    `/collections/${finalConfig.collection}/points/count`,
    { filter, exact: true }
  );

  return response.result.count;
}

/**
 * Health check for Qdrant connection.
 * Returns status and basic metrics.
 */
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
    const info = await getCollectionInfo(config);
    return {
      healthy: true,
      status: info.status as string,
      vectorsCount: info.vectors_count as number,
      pointsCount: info.points_count as number,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
