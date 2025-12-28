import { supabase } from "../client";
import type { Database } from "../types/database";

type Mention = Database["public"]["Tables"]["mentions"]["Row"];
type MentionInsert = Database["public"]["Tables"]["mentions"]["Insert"];
type MentionUpdate = Database["public"]["Tables"]["mentions"]["Update"];

/**
 * Get all mentions for a specific document
 */
export async function getMentionsByDocument(
  documentId: string
): Promise<Mention[]> {
  const { data, error } = await supabase
    .from("mentions")
    .select("*")
    .eq("document_id", documentId)
    .order("position_start");

  if (error) {
    throw new Error(`Failed to fetch mentions: ${error.message}`);
  }

  return (data as Mention[]) || [];
}

/**
 * Get all mentions for a specific entity across all documents
 */
export async function getMentionsByEntity(
  entityId: string
): Promise<Mention[]> {
  const { data, error } = await supabase
    .from("mentions")
    .select("*")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch mentions: ${error.message}`);
  }

  return (data as Mention[]) || [];
}

/**
 * Get a single mention by ID
 */
export async function getMention(id: string): Promise<Mention | null> {
  const { data, error } = await supabase
    .from("mentions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch mention: ${error.message}`);
  }

  return data as Mention;
}

/**
 * Create a new mention
 */
export async function createMention(mention: MentionInsert): Promise<Mention> {
  const { data, error } = await supabase
    .from("mentions")
    .insert(mention as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create mention: ${error.message}`);
  }

  return data as Mention;
}

/**
 * Create multiple mentions in a batch
 */
export async function createMentions(
  mentions: MentionInsert[]
): Promise<Mention[]> {
  if (mentions.length === 0) return [];

  const { data, error } = await supabase
    .from("mentions")
    .insert(mentions as never[])
    .select();

  if (error) {
    throw new Error(`Failed to create mentions: ${error.message}`);
  }

  return (data as Mention[]) || [];
}

/**
 * Update an existing mention
 */
export async function updateMention(
  id: string,
  updates: MentionUpdate
): Promise<Mention> {
  const { data, error } = await supabase
    .from("mentions")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update mention: ${error.message}`);
  }

  return data as Mention;
}

/**
 * Delete a single mention
 */
export async function deleteMention(id: string): Promise<void> {
  const { error } = await supabase.from("mentions").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete mention: ${error.message}`);
  }
}

/**
 * Delete all mentions for a specific document
 * Useful when re-analyzing a document's entity mentions
 */
export async function deleteMentionsByDocument(
  documentId: string
): Promise<void> {
  const { error } = await supabase
    .from("mentions")
    .delete()
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Failed to delete mentions: ${error.message}`);
  }
}

/**
 * Delete all mentions for a specific entity
 */
export async function deleteMentionsByEntity(entityId: string): Promise<void> {
  const { error } = await supabase
    .from("mentions")
    .delete()
    .eq("entity_id", entityId);

  if (error) {
    throw new Error(`Failed to delete mentions: ${error.message}`);
  }
}

/**
 * Get mention counts grouped by entity for a document
 */
export async function getMentionCountsByEntity(
  documentId: string
): Promise<{ entity_id: string; count: number }[]> {
  const { data, error } = await supabase
    .from("mentions")
    .select("entity_id")
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Failed to fetch mention counts: ${error.message}`);
  }

  // Group and count manually since Supabase doesn't support GROUP BY directly
  const counts = new Map<string, number>();
  const rows = (data || []) as { entity_id: string }[];
  for (const row of rows) {
    const current = counts.get(row.entity_id) || 0;
    counts.set(row.entity_id, current + 1);
  }

  return Array.from(counts.entries()).map(([entity_id, count]) => ({
    entity_id,
    count,
  }));
}

/**
 * Replace all mentions for a document (delete existing, insert new)
 * Transactional replacement for when re-analyzing entity mentions
 */
export async function replaceMentionsForDocument(
  documentId: string,
  mentions: Omit<MentionInsert, "document_id">[]
): Promise<Mention[]> {
  // Delete existing mentions for this document
  await deleteMentionsByDocument(documentId);

  // Insert new mentions with the document_id
  if (mentions.length === 0) return [];

  const mentionsWithDoc: MentionInsert[] = mentions.map((m) => ({
    ...m,
    document_id: documentId,
  }));

  return createMentions(mentionsWithDoc);
}
