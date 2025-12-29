/**
 * Qdrant REST API Helper for Supabase Edge Functions
 *
 * Provides a thin wrapper around Qdrant's REST API for vector operations.
 * Uses server-side environment variables (not exposed to client).
 */

/**
 * Default collection name
 */
const DEFAULT_COLLECTION = "saga_vectors";

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
 * Make a request to Qdrant API
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

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok || data.status?.error) {
    const errorMessage = data.status?.error || `Qdrant API error: ${response.status}`;
    throw new QdrantError(errorMessage, response.status, data.status?.error);
  }

  return data as T;
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
