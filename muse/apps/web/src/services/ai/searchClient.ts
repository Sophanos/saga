/**
 * Search API Client - Calls Supabase edge function /functions/v1/ai-search
 *
 * Performs semantic search using DeepInfra embeddings + Qdrant vector search.
 * Optionally reranks results using DeepInfra reranker.
 */

import { ApiError, callEdgeFunction, type ApiErrorCode } from "../api-client";

/**
 * Search scope options
 */
export type SearchScope = "all" | "documents" | "entities";

/**
 * Individual search result
 */
export interface SemanticResult {
  id: string;
  type: "document" | "entity";
  title: string;
  preview?: string;
  vectorScore: number;
  rerankScore?: number;
  entityType?: string;
  documentId?: string;
  entityId?: string;
}

/**
 * Search request payload
 */
export interface SearchRequestPayload {
  query: string;
  projectId: string;
  scope?: SearchScope;
  limit?: number;
  rerank?: boolean;
  rerankTopK?: number;
}

/**
 * Search response payload
 */
export interface SearchResponsePayload {
  results: SemanticResult[];
  query: string;
  processingTimeMs: number;
}

/**
 * Search request options
 */
export interface SearchRequestOptions {
  signal?: AbortSignal;
}

/** Error codes returned by the search API */
export type SearchApiErrorCode = ApiErrorCode;

/**
 * Search-specific API error
 */
export class SearchApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    code?: SearchApiErrorCode
  ) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "SearchApiError";
  }
}

/** Internal request payload shape */
interface SearchEdgeRequest {
  query: string;
  projectId: string;
  scope?: SearchScope;
  limit?: number;
  rerank?: boolean;
  rerankTopK?: number;
}

/** Internal response payload shape */
interface SearchEdgeResponse {
  results?: SemanticResult[];
  query?: string;
  processingTimeMs?: number;
}

/**
 * Perform semantic search via edge function
 *
 * @param payload - Search request parameters
 * @param opts - Request options (abort signal)
 * @returns Search results with scores
 */
export async function searchViaEdge(
  payload: SearchRequestPayload,
  opts?: SearchRequestOptions
): Promise<SearchResponsePayload> {
  // Validate required fields
  if (!payload.query || payload.query.trim().length === 0) {
    throw new SearchApiError("query must be non-empty", 400, "VALIDATION_ERROR");
  }

  if (!payload.projectId || payload.projectId.trim().length === 0) {
    throw new SearchApiError("projectId must be non-empty", 400, "VALIDATION_ERROR");
  }

  try {
    const result = await callEdgeFunction<SearchEdgeRequest, SearchEdgeResponse>(
      "ai-search",
      {
        query: payload.query,
        projectId: payload.projectId,
        scope: payload.scope,
        limit: payload.limit,
        rerank: payload.rerank,
        rerankTopK: payload.rerankTopK,
      },
      {
        signal: opts?.signal,
      }
    );

    return {
      results: Array.isArray(result.results) ? result.results : [],
      query: result.query ?? payload.query,
      processingTimeMs: result.processingTimeMs ?? 0,
    };
  } catch (error) {
    if (error instanceof ApiError && !(error instanceof SearchApiError)) {
      throw new SearchApiError(error.message, error.statusCode, error.code);
    }
    throw error;
  }
}

/**
 * Search for entities similar to a given entity
 *
 * @param entityText - Text representation of the entity to find similar items for
 * @param projectId - Project ID to search within
 * @param opts - Request options
 * @returns Similar entities and documents
 */
export async function findSimilarViaEdge(
  entityText: string,
  projectId: string,
  opts?: SearchRequestOptions & { limit?: number }
): Promise<SearchResponsePayload> {
  return searchViaEdge(
    {
      query: entityText,
      projectId,
      limit: opts?.limit ?? 10,
      rerank: true,
      rerankTopK: 5,
    },
    opts
  );
}
