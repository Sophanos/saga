import { getSupabaseClient } from "../client";
import type { Database } from "../types/database";

type Entity = Database["public"]["Tables"]["entities"]["Row"];
type Document = Database["public"]["Tables"]["documents"]["Row"];

// Result type for semantic search
export interface SemanticSearchResult {
  id: string;
  title?: string;
  name?: string;
  type: string;
  similarity: number;
}

/**
 * Search entities by embedding similarity
 * Uses the search_entities RPC function for efficient vector search
 */
export async function searchEntitiesByEmbedding(
  projectId: string,
  embedding: number[],
  limit: number = 10,
  threshold: number = 0.7
): Promise<SemanticSearchResult[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("search_entities", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    project_filter: projectId,
  } as never);

  if (error) {
    throw new Error(`Failed to search entities by embedding: ${error.message}`);
  }

  return (data as SemanticSearchResult[]) || [];
}

/**
 * Search documents by embedding similarity
 * Uses the search_documents RPC function for efficient vector search
 */
export async function searchDocumentsByEmbedding(
  projectId: string,
  embedding: number[],
  limit: number = 10,
  threshold: number = 0.7
): Promise<SemanticSearchResult[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("search_documents", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    project_filter: projectId,
  } as never);

  if (error) {
    throw new Error(`Failed to search documents by embedding: ${error.message}`);
  }

  return (data as SemanticSearchResult[]) || [];
}

/**
 * Full-text search on documents
 */
export async function fulltextSearchDocuments(
  projectId: string,
  searchQuery: string,
  limit: number = 20
): Promise<{ id: string; title: string; type: string; rank: number }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("fulltext_search_documents", {
    search_query: searchQuery,
    project_filter: projectId,
    result_limit: limit,
  } as never);

  if (error) {
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  return (data as { id: string; title: string; type: string; rank: number }[]) || [];
}

/**
 * Hybrid search combining semantic and full-text search
 */
export async function hybridSearchDocuments(
  projectId: string,
  embedding: number[],
  searchQuery: string,
  limit: number = 20,
  semanticWeight: number = 0.7
): Promise<{ id: string; title: string; type: string; combined_score: number }[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("hybrid_search_documents", {
    query_embedding: embedding,
    search_query: searchQuery,
    project_filter: projectId,
    semantic_weight: semanticWeight,
    result_limit: limit,
  } as never);

  if (error) {
    throw new Error(`Failed to hybrid search documents: ${error.message}`);
  }

  return (data as { id: string; title: string; type: string; combined_score: number }[]) || [];
}

/**
 * Update entity embedding
 */
export async function updateEntityEmbedding(
  entityId: string,
  embedding: number[]
): Promise<Entity> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("entities")
    .update({ embedding, updated_at: new Date().toISOString() } as never)
    .eq("id", entityId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update entity embedding: ${error.message}`);
  }

  return data as Entity;
}

/**
 * Update document embedding
 */
export async function updateDocumentEmbedding(
  documentId: string,
  embedding: number[]
): Promise<Document> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ embedding, updated_at: new Date().toISOString() } as never)
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document embedding: ${error.message}`);
  }

  return data as Document;
}

/**
 * Update document content text (for full-text search indexing)
 */
export async function updateDocumentContentText(
  documentId: string,
  contentText: string
): Promise<Document> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ content_text: contentText, updated_at: new Date().toISOString() } as never)
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document content text: ${error.message}`);
  }

  return data as Document;
}

/**
 * Update document with both embedding and content text
 */
export async function updateDocumentSearchData(
  documentId: string,
  embedding: number[],
  contentText: string
): Promise<Document> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .update({
      embedding,
      content_text: contentText,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", documentId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document search data: ${error.message}`);
  }

  return data as Document;
}

/**
 * Batch update entity embeddings
 */
export async function batchUpdateEntityEmbeddings(
  updates: { id: string; embedding: number[] }[]
): Promise<void> {
  const supabase = getSupabaseClient();
  // Supabase doesn't support native batch updates, so we use Promise.all
  const promises = updates.map(({ id, embedding }) =>
    supabase
      .from("entities")
      .update({ embedding, updated_at: new Date().toISOString() } as never)
      .eq("id", id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    throw new Error(
      `Failed to update ${errors.length} entity embeddings: ${errors[0].error?.message}`
    );
  }
}

/**
 * Batch update document embeddings
 */
export async function batchUpdateDocumentEmbeddings(
  updates: { id: string; embedding: number[]; contentText?: string }[]
): Promise<void> {
  const supabase = getSupabaseClient();
  const promises = updates.map(({ id, embedding, contentText }) =>
    supabase
      .from("documents")
      .update({
        embedding,
        ...(contentText !== undefined && { content_text: contentText }),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter((r) => r.error);

  if (errors.length > 0) {
    throw new Error(
      `Failed to update ${errors.length} document embeddings: ${errors[0].error?.message}`
    );
  }
}

/**
 * Get entities without embeddings (for batch embedding generation)
 */
export async function getEntitiesWithoutEmbeddings(
  projectId: string,
  limit: number = 100
): Promise<Entity[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .is("embedding", null)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch entities without embeddings: ${error.message}`);
  }

  return (data as Entity[]) || [];
}

/**
 * Get documents without embeddings (for batch embedding generation)
 */
export async function getDocumentsWithoutEmbeddings(
  projectId: string,
  limit: number = 100
): Promise<Document[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .is("embedding", null)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch documents without embeddings: ${error.message}`);
  }

  return (data as Document[]) || [];
}

/**
 * Update document embedding only if the document hasn't changed since expectedUpdatedAt.
 * This prevents stale embeddings from overwriting newer content.
 *
 * @param documentId - Document ID
 * @param embedding - Embedding vector (1536 dimensions)
 * @param expectedUpdatedAt - The updated_at timestamp when embedding generation started
 * @returns The updated document, or null if the document was modified (stale write prevented)
 */
export async function updateDocumentEmbeddingIfUnchanged(
  documentId: string,
  embedding: number[],
  expectedUpdatedAt: string
): Promise<Document | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ embedding, updated_at: new Date().toISOString() } as never)
    .eq("id", documentId)
    .eq("updated_at", expectedUpdatedAt)
    .select();

  if (error) {
    throw new Error(`Failed to update document embedding: ${error.message}`);
  }

  // If no rows were updated, the document was modified since we started
  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as Document;
}

/**
 * Update entity embedding only if the entity hasn't changed since expectedUpdatedAt.
 * This prevents stale embeddings from overwriting newer content.
 *
 * @param entityId - Entity ID
 * @param embedding - Embedding vector (1536 dimensions)
 * @param expectedUpdatedAt - The updated_at timestamp when embedding generation started
 * @returns The updated entity, or null if the entity was modified (stale write prevented)
 */
export async function updateEntityEmbeddingIfUnchanged(
  entityId: string,
  embedding: number[],
  expectedUpdatedAt: string
): Promise<Entity | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("entities")
    .update({ embedding, updated_at: new Date().toISOString() } as never)
    .eq("id", entityId)
    .eq("updated_at", expectedUpdatedAt)
    .select();

  if (error) {
    throw new Error(`Failed to update entity embedding: ${error.message}`);
  }

  // If no rows were updated, the entity was modified since we started
  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as Entity;
}
