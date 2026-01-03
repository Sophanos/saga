import { getSupabaseClient } from "../client";
import { DBError } from "../errors";
import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeBulkMutation,
  executeVoidMutation,
} from "../queryHelper";
import type { Database } from "../types/database";
import {
  type PaginationParams,
  type PaginatedResult,
  normalizePaginationParams,
  createPaginatedResult,
  DEFAULT_PAGE_SIZE,
} from "../types/pagination";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];

// Re-export pagination types for convenience
export type { PaginationParams, PaginatedResult };

/**
 * Get documents for a project with optional pagination
 * @param projectId - The project ID
 * @param pagination - Optional pagination params (limit, offset)
 * @returns Paginated result with documents, total count, and hasMore flag
 */
export async function getDocuments(
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Document>> {
  const supabase = getSupabaseClient();
  const { limit, offset } = normalizePaginationParams(pagination);

  // Get total count
  const { count, error: countError } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (countError) {
    throw DBError.fromSupabaseError(countError, "count documents");
  }

  const total = count ?? 0;

  // Get paginated data
  const data = await executeQuery<Document>(
    (client) =>
      client
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index")
        .range(offset, offset + limit - 1),
    { context: "fetch documents" }
  );

  return createPaginatedResult(data, total, { limit, offset });
}

/**
 * Get all documents for a project (fetches all pages internally)
 * Use with caution for large datasets - prefer paginated getDocuments for UI
 * @param projectId - The project ID
 * @returns Array of all documents
 */
export async function fetchAllDocuments(projectId: string): Promise<Document[]> {
  const allDocuments: Document[] = [];
  let offset = 0;
  const pageSize = DEFAULT_PAGE_SIZE;
  let hasMore = true;

  while (hasMore) {
    const result = await getDocuments(projectId, { limit: pageSize, offset });
    allDocuments.push(...result.data);
    hasMore = result.hasMore;
    offset += pageSize;
  }

  return allDocuments;
}

/**
 * Get a single document by id
 */
export async function getDocument(id: string): Promise<Document | null> {
  return executeSingleQuery<Document>(
    (client) => client.from("documents").select("*").eq("id", id).single(),
    { context: "fetch document" }
  );
}

/**
 * Create a new document
 */
export async function createDocument(doc: DocumentInsert): Promise<Document> {
  return executeMutation<Document>(
    (client) =>
      client
        .from("documents")
        .insert(doc as never)
        .select()
        .single(),
    { context: "create document" }
  );
}

/**
 * Update an existing document
 */
export async function updateDocument(
  id: string,
  updates: DocumentUpdate
): Promise<Document> {
  return executeMutation<Document>(
    (client) =>
      client
        .from("documents")
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update document" }
  );
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  const document = await getDocument(id);
  if (!document) return;

  if (document.type === "chapter") {
    await executeVoidMutation(
      (client) => client.from("documents").delete().eq("parent_id", id),
      { context: "delete child documents" }
    );
  }

  return executeVoidMutation(
    (client) => client.from("documents").delete().eq("id", id),
    { context: "delete document" }
  );
}

/**
 * Get child documents for a parent document with optional pagination
 * @param parentId - The parent document ID
 * @param pagination - Optional pagination params
 * @returns Paginated result with child documents
 */
export async function getDocumentsByParent(
  parentId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Document>> {
  const supabase = getSupabaseClient();
  const { limit, offset } = normalizePaginationParams(pagination);

  // Get total count
  const { count, error: countError } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", parentId);

  if (countError) {
    throw DBError.fromSupabaseError(countError, "count child documents");
  }

  const total = count ?? 0;

  // Get paginated data
  const data = await executeQuery<Document>(
    (client) =>
      client
        .from("documents")
        .select("*")
        .eq("parent_id", parentId)
        .order("order_index")
        .range(offset, offset + limit - 1),
    { context: "fetch child documents" }
  );

  return createPaginatedResult(data, total, { limit, offset });
}

/**
 * Get all child documents for a parent (fetches all pages internally)
 * @param parentId - The parent document ID
 * @returns Array of all child documents
 */
export async function fetchAllDocumentsByParent(
  parentId: string
): Promise<Document[]> {
  const allDocuments: Document[] = [];
  let offset = 0;
  const pageSize = DEFAULT_PAGE_SIZE;
  let hasMore = true;

  while (hasMore) {
    const result = await getDocumentsByParent(parentId, {
      limit: pageSize,
      offset,
    });
    allDocuments.push(...result.data);
    hasMore = result.hasMore;
    offset += pageSize;
  }

  return allDocuments;
}

/**
 * Get documents by type within a project with optional pagination
 * @param projectId - The project ID
 * @param type - Document type to filter by
 * @param pagination - Optional pagination params
 * @returns Paginated result with documents
 */
export async function getDocumentsByType(
  projectId: string,
  type: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Document>> {
  const supabase = getSupabaseClient();
  const { limit, offset } = normalizePaginationParams(pagination);

  // Get total count
  const { count, error: countError } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("type", type);

  if (countError) {
    throw DBError.fromSupabaseError(countError, "count documents");
  }

  const total = count ?? 0;

  // Get paginated data
  const data = await executeQuery<Document>(
    (client) =>
      client
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", type)
        .order("order_index")
        .range(offset, offset + limit - 1),
    { context: "fetch documents by type" }
  );

  return createPaginatedResult(data, total, { limit, offset });
}

/**
 * Get all documents by type (fetches all pages internally)
 * @param projectId - The project ID
 * @param type - Document type to filter by
 * @returns Array of all matching documents
 */
export async function fetchAllDocumentsByType(
  projectId: string,
  type: string
): Promise<Document[]> {
  const allDocuments: Document[] = [];
  let offset = 0;
  const pageSize = DEFAULT_PAGE_SIZE;
  let hasMore = true;

  while (hasMore) {
    const result = await getDocumentsByType(projectId, type, {
      limit: pageSize,
      offset,
    });
    allDocuments.push(...result.data);
    hasMore = result.hasMore;
    offset += pageSize;
  }

  return allDocuments;
}

/**
 * Get root-level documents (no parent) for a project with optional pagination
 * @param projectId - The project ID
 * @param pagination - Optional pagination params
 * @returns Paginated result with root documents
 */
export async function getRootDocuments(
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Document>> {
  const supabase = getSupabaseClient();
  const { limit, offset } = normalizePaginationParams(pagination);

  // Get total count
  const { count, error: countError } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("parent_id", null);

  if (countError) {
    throw DBError.fromSupabaseError(countError, "count root documents");
  }

  const total = count ?? 0;

  // Get paginated data
  const data = await executeQuery<Document>(
    (client) =>
      client
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .is("parent_id", null)
        .order("order_index")
        .range(offset, offset + limit - 1),
    { context: "fetch root documents" }
  );

  return createPaginatedResult(data, total, { limit, offset });
}

/**
 * Get all root documents (fetches all pages internally)
 * @param projectId - The project ID
 * @returns Array of all root documents
 */
export async function fetchAllRootDocuments(
  projectId: string
): Promise<Document[]> {
  const allDocuments: Document[] = [];
  let offset = 0;
  const pageSize = DEFAULT_PAGE_SIZE;
  let hasMore = true;

  while (hasMore) {
    const result = await getRootDocuments(projectId, {
      limit: pageSize,
      offset,
    });
    allDocuments.push(...result.data);
    hasMore = result.hasMore;
    offset += pageSize;
  }

  return allDocuments;
}

/**
 * Update document order indices (for reordering)
 * Uses batch upsert to update all documents in a single database call
 */
export async function updateDocumentOrder(
  documents: { id: string; order_index: number }[]
): Promise<void> {
  if (documents.length === 0) return;

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("documents")
    .upsert(
      documents.map((doc) => ({
        id: doc.id,
        order_index: doc.order_index,
        updated_at: new Date().toISOString(),
      })) as never[],
      { onConflict: "id" }
    );

  if (error) {
    throw DBError.fromSupabaseError(error, "update document order");
  }
}

/**
 * Bulk create documents
 */
export async function createDocuments(
  documents: DocumentInsert[]
): Promise<Document[]> {
  return executeBulkMutation<Document>(
    (client) =>
      client
        .from("documents")
        .insert(documents as never[])
        .select(),
    { context: "create documents" }
  );
}

/**
 * Delete all documents for a project
 */
export async function deleteDocumentsByProject(projectId: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("documents").delete().eq("project_id", projectId),
    { context: "delete documents by project" }
  );
}
