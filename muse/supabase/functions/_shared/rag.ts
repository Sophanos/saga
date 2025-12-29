/**
 * RAG Context Retrieval Module
 *
 * Unified RAG (Retrieval-Augmented Generation) context retrieval for edge functions.
 * Provides consistent retrieval patterns across ai-chat, ai-saga, and ai-agent.
 *
 * Key features:
 * - Consistent use of `project_id` (canonical key, not `projectId`)
 * - Uses vectorPayload helpers for legacy key compatibility
 * - Properly separates documents and entities
 * - Optional memory exclusion filter
 */

import {
  generateEmbedding,
  isDeepInfraConfigured,
} from "./deepinfra.ts";
import {
  searchPoints,
  isQdrantConfigured,
  type QdrantFilter,
} from "./qdrant.ts";
import {
  getPayloadType,
  getPayloadTitle,
  getPayloadPreview,
  getEntityType,
} from "./vectorPayload.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Single item in RAG context (document or entity)
 */
export interface RAGContextItem {
  id: string;
  title: string;
  type: string;
  preview: string;
}

/**
 * RAG context containing retrieved documents and entities
 */
export interface RAGContext {
  documents: RAGContextItem[];
  entities: RAGContextItem[];
}

/**
 * Options for RAG retrieval
 */
export interface RAGRetrievalOptions {
  /** Maximum number of items per category (documents/entities). Default: 5 */
  limit?: number;
  /** Whether to exclude memory vectors from results. Default: true */
  excludeMemories?: boolean;
  /** Function name for logging purposes */
  logPrefix?: string;
}

// =============================================================================
// Main Retrieval Function
// =============================================================================

/**
 * Retrieve RAG context for a query within a project.
 *
 * Performs semantic search against the vector store, filtering by project
 * and optionally excluding memory vectors. Returns separate lists of
 * documents and entities.
 *
 * Uses `project_id` as the canonical filter key (not `projectId`).
 *
 * @param query - The search query text
 * @param projectId - The project UUID to filter by
 * @param options - Optional retrieval settings
 * @returns RAG context with documents and entities arrays
 *
 * @example
 * ```typescript
 * const context = await retrieveRAGContext(
 *   "Tell me about the protagonist",
 *   "123e4567-e89b-12d3-a456-426614174000",
 *   { limit: 5, excludeMemories: true, logPrefix: "[ai-chat]" }
 * );
 * ```
 */
export async function retrieveRAGContext(
  query: string,
  projectId: string,
  options: RAGRetrievalOptions = {}
): Promise<RAGContext> {
  const {
    limit = 5,
    excludeMemories = true,
    logPrefix = "[rag]",
  } = options;

  // Check if RAG infrastructure is configured
  if (!isDeepInfraConfigured() || !isQdrantConfigured()) {
    console.log(`${logPrefix} RAG not configured, skipping retrieval`);
    return { documents: [], entities: [] };
  }

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Build filter with canonical project_id key (not projectId)
    const filter: QdrantFilter = {
      must: [
        { key: "project_id", match: { value: projectId } },
      ],
    };

    // Optionally exclude memory vectors
    if (excludeMemories) {
      filter.must_not = [
        { key: "type", match: { value: "memory" } },
      ];
    }

    // Search for similar vectors (fetch more to allow for category balancing)
    const results = await searchPoints(embedding, limit * 2, filter);

    // Separate results into documents and entities
    const documents: RAGContextItem[] = [];
    const entities: RAGContextItem[] = [];

    for (const point of results) {
      const payload = point.payload;
      const type = getPayloadType(payload);

      if (type === "document") {
        if (documents.length < limit) {
          documents.push({
            id: String(point.id),
            title: getPayloadTitle(payload),
            type: "document",
            preview: getPayloadPreview(payload),
          });
        }
      } else if (type === "entity") {
        if (entities.length < limit) {
          entities.push({
            id: String(point.id),
            title: getPayloadTitle(payload),
            type: getEntityType(payload) ?? "unknown",
            preview: getPayloadPreview(payload),
          });
        }
      }
    }

    return { documents, entities };
  } catch (error) {
    console.error(`${logPrefix} RAG retrieval error:`, error);
    return { documents: [], entities: [] };
  }
}

/**
 * Check if RAG retrieval is available.
 *
 * Returns true only if both DeepInfra (embeddings) and Qdrant (vector store)
 * are properly configured.
 */
export function isRAGConfigured(): boolean {
  return isDeepInfraConfigured() && isQdrantConfigured();
}
