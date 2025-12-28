import { supabase } from "../client";
import type { Database } from "../types/database";

type Document = Database["public"]["Tables"]["documents"]["Row"];
type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];

/**
 * Get all documents for a project, ordered by order_index
 */
export async function getDocuments(projectId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index");

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return (data as Document[]) || [];
}

/**
 * Get a single document by id
 */
export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Create a new document
 */
export async function createDocument(doc: DocumentInsert): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .insert(doc as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Update an existing document
 */
export async function updateDocument(
  id: string,
  updates: DocumentUpdate
): Promise<Document> {
  const { data, error } = await supabase
    .from("documents")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update document: ${error.message}`);
  }

  return data as Document;
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
}

/**
 * Get all child documents for a parent document
 */
export async function getDocumentsByParent(parentId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("parent_id", parentId)
    .order("order_index");

  if (error) {
    throw new Error(`Failed to fetch child documents: ${error.message}`);
  }

  return (data as Document[]) || [];
}

/**
 * Get documents by type within a project
 */
export async function getDocumentsByType(
  projectId: string,
  type: string
): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", type)
    .order("order_index");

  if (error) {
    throw new Error(`Failed to fetch documents by type: ${error.message}`);
  }

  return (data as Document[]) || [];
}

/**
 * Get root-level documents (no parent) for a project
 */
export async function getRootDocuments(projectId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .is("parent_id", null)
    .order("order_index");

  if (error) {
    throw new Error(`Failed to fetch root documents: ${error.message}`);
  }

  return (data as Document[]) || [];
}

/**
 * Update document order indices (for reordering)
 */
export async function updateDocumentOrder(
  documents: { id: string; order_index: number }[]
): Promise<void> {
  // Use a transaction-like approach by updating each document
  for (const doc of documents) {
    const { error } = await supabase
      .from("documents")
      .update({ order_index: doc.order_index, updated_at: new Date().toISOString() } as never)
      .eq("id", doc.id);

    if (error) {
      throw new Error(`Failed to update document order: ${error.message}`);
    }
  }
}

/**
 * Bulk create documents
 */
export async function createDocuments(
  documents: DocumentInsert[]
): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .insert(documents as never[])
    .select();

  if (error) {
    throw new Error(`Failed to create documents: ${error.message}`);
  }

  return (data as Document[]) || [];
}

/**
 * Delete all documents for a project
 */
export async function deleteDocumentsByProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete documents: ${error.message}`);
  }
}
