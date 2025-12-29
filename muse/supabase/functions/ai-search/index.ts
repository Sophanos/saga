/**
 * AI Search Edge Function
 *
 * POST /ai-search
 *
 * Semantic search: embed query → Qdrant search → optional rerank.
 * Designed for Cmd+K style search across documents and entities.
 *
 * Request Body:
 * {
 *   query: string,                    // Required: search query
 *   projectId: string,                // Required: filter by project
 *   scope?: "all" | "documents" | "entities",  // Default: "all"
 *   limit?: number,                   // Default: 20
 *   rerank?: boolean,                 // Default: false (enable DeepInfra reranker)
 *   rerankTopK?: number               // Default: 10 (final results after rerank)
 * }
 *
 * Response:
 * {
 *   results: SemanticResult[],
 *   query: string,
 *   processingTimeMs: number
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  handleAIError,
  validateRequestBody,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  generateEmbedding,
  DeepInfraError,
  getDeepInfraConfig,
} from "../_shared/deepinfra.ts";
import {
  searchPoints,
  isQdrantConfigured,
  QdrantError,
  type QdrantFilter,
} from "../_shared/qdrant.ts";

/**
 * Search scope options
 */
type SearchScope = "all" | "documents" | "entities";

/**
 * Request body interface
 */
interface SearchRequest {
  query: string;
  projectId: string;
  scope?: SearchScope;
  limit?: number;
  rerank?: boolean;
  rerankTopK?: number;
}

/**
 * Individual search result
 */
interface SemanticResult {
  id: string;
  type: "document" | "entity";
  title: string;
  preview?: string;
  vectorScore: number;
  rerankScore?: number;
  // Additional metadata from Qdrant payload
  entityType?: string;
  documentId?: string;
  entityId?: string;
}

/**
 * Response interface
 */
interface SearchResponse {
  results: SemanticResult[];
  query: string;
  processingTimeMs: number;
}

/**
 * DeepInfra reranker request
 */
interface RerankRequest {
  queries: string[];
  documents: string[];
}

/**
 * DeepInfra reranker response
 */
interface RerankResponse {
  scores: number[];
  input_tokens: number;
}

/**
 * Rerank results using DeepInfra reranker
 */
async function rerankResults(
  query: string,
  results: SemanticResult[],
  topK: number
): Promise<SemanticResult[]> {
  if (results.length === 0) return results;

  const config = getDeepInfraConfig();
  const documents = results.map((r) => `${r.title}\n${r.preview || ""}`);

  const response = await fetch("https://api.deepinfra.com/v1/inference/Qwen/Qwen3-Reranker-4B", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      queries: [query],
      documents,
    } as RerankRequest),
  });

  if (!response.ok) {
    console.warn("[ai-search] Reranker failed, returning vector scores only");
    return results.slice(0, topK);
  }

  const data = (await response.json()) as RerankResponse;

  // Attach rerank scores and sort
  const reranked = results
    .map((result, idx) => ({
      ...result,
      rerankScore: data.scores[idx] ?? 0,
    }))
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
    .slice(0, topK);

  return reranked;
}

/**
 * Build Qdrant filter for project and scope
 */
function buildFilter(projectId: string, scope: SearchScope): QdrantFilter {
  const conditions: QdrantFilter["must"] = [
    { key: "project_id", match: { value: projectId } },
  ];

  if (scope === "documents") {
    conditions.push({ key: "type", match: { value: "document" } });
  } else if (scope === "entities") {
    conditions.push({ key: "type", match: { value: "entity" } });
  }

  return { must: conditions };
}

/**
 * Transform Qdrant results to SemanticResult format
 */
function transformResults(
  qdrantResults: Awaited<ReturnType<typeof searchPoints>>
): SemanticResult[] {
  return qdrantResults.map((hit) => {
    const payload = hit.payload as Record<string, unknown>;
    const type = payload.type as "document" | "entity";

    return {
      id: String(hit.id),
      type,
      title: String(payload.title || "Untitled"),
      preview: payload.content_preview ? String(payload.content_preview) : undefined,
      vectorScore: hit.score,
      entityType: type === "entity" ? String(payload.entity_type || "") : undefined,
      documentId: type === "document" ? String(payload.document_id || hit.id) : undefined,
      entityId: type === "entity" ? String(payload.entity_id || hit.id) : undefined,
    };
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.BAD_REQUEST,
      "Method not allowed. Use POST.",
      origin
    );
  }

  try {
    // Check Qdrant configuration
    if (!isQdrantConfigured()) {
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Qdrant is not configured. Set QDRANT_URL environment variable.",
        origin
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        "Invalid JSON in request body",
        origin
      );
    }

    // Validate required fields
    const validation = validateRequestBody(body, ["query", "projectId"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as SearchRequest;

    // Validate query
    if (typeof request.query !== "string" || request.query.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "query must be a non-empty string",
        origin
      );
    }

    // Validate projectId
    if (typeof request.projectId !== "string" || request.projectId.trim().length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "projectId must be a non-empty string",
        origin
      );
    }

    const scope: SearchScope = request.scope || "all";
    const limit = Math.min(request.limit || 20, 100);
    const rerank = request.rerank ?? false;
    const rerankTopK = Math.min(request.rerankTopK || 10, limit);

    // Step 1: Generate query embedding via DeepInfra
    const queryEmbedding = await generateEmbedding(request.query.trim());

    // Step 2: Search Qdrant with project filter
    const filter = buildFilter(request.projectId, scope);
    const qdrantResults = await searchPoints(
      queryEmbedding,
      rerank ? limit * 3 : limit, // Fetch more if reranking
      filter
    );

    // Step 3: Transform results
    let results = transformResults(qdrantResults);

    // Step 4: Optional reranking
    if (rerank && results.length > 0) {
      try {
        results = await rerankResults(request.query, results, rerankTopK);
      } catch (error) {
        console.warn("[ai-search] Reranking failed:", error);
        // Continue with vector-only results
        results = results.slice(0, rerankTopK);
      }
    }

    const processingTimeMs = Date.now() - startTime;

    const response: SearchResponse = {
      results,
      query: request.query,
      processingTimeMs,
    };

    return createSuccessResponse(response, origin);
  } catch (error) {
    // Handle DeepInfra-specific errors
    if (error instanceof DeepInfraError) {
      return handleAIError(error, origin, { providerName: "DeepInfra" });
    }

    // Handle Qdrant errors
    if (error instanceof QdrantError) {
      return createErrorResponse(
        ErrorCode.AI_ERROR,
        `Vector search error: ${error.message}`,
        origin
      );
    }

    // Handle generic errors
    return handleAIError(error, origin, { providerName: "Search service" });
  }
});
