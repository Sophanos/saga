import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeBulkMutation,
  executeVoidMutation,
} from "../queryHelper";
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
  return executeQuery<Mention>(
    (client) =>
      client
        .from("mentions")
        .select("*")
        .eq("document_id", documentId)
        .order("position_start"),
    { context: "fetch mentions by document" }
  );
}

/**
 * Get all mentions for a specific entity across all documents
 */
export async function getMentionsByEntity(
  entityId: string
): Promise<Mention[]> {
  return executeQuery<Mention>(
    (client) =>
      client
        .from("mentions")
        .select("*")
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false }),
    { context: "fetch mentions by entity" }
  );
}

/**
 * Get a single mention by ID
 */
export async function getMention(id: string): Promise<Mention | null> {
  return executeSingleQuery<Mention>(
    (client) => client.from("mentions").select("*").eq("id", id).single(),
    { context: "fetch mention" }
  );
}

/**
 * Create a new mention
 */
export async function createMention(mention: MentionInsert): Promise<Mention> {
  return executeMutation<Mention>(
    (client) =>
      client
        .from("mentions")
        .insert(mention as never)
        .select()
        .single(),
    { context: "create mention" }
  );
}

/**
 * Create multiple mentions in a batch
 */
export async function createMentions(
  mentions: MentionInsert[]
): Promise<Mention[]> {
  if (mentions.length === 0) return [];

  return executeBulkMutation<Mention>(
    (client) =>
      client
        .from("mentions")
        .insert(mentions as never[])
        .select(),
    { context: "create mentions" }
  );
}

/**
 * Update an existing mention
 */
export async function updateMention(
  id: string,
  updates: MentionUpdate
): Promise<Mention> {
  return executeMutation<Mention>(
    (client) =>
      client
        .from("mentions")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update mention" }
  );
}

/**
 * Delete a single mention
 */
export async function deleteMention(id: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("mentions").delete().eq("id", id),
    { context: "delete mention" }
  );
}

/**
 * Delete all mentions for a specific document
 * Useful when re-analyzing a document's entity mentions
 */
export async function deleteMentionsByDocument(
  documentId: string
): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("mentions").delete().eq("document_id", documentId),
    { context: "delete mentions by document" }
  );
}

/**
 * Delete all mentions for a specific entity
 */
export async function deleteMentionsByEntity(entityId: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("mentions").delete().eq("entity_id", entityId),
    { context: "delete mentions by entity" }
  );
}

/**
 * Get mention counts grouped by entity for a document
 */
export async function getMentionCountsByEntity(
  documentId: string
): Promise<{ entity_id: string; count: number }[]> {
  const data = await executeQuery<{ entity_id: string }>(
    (client) =>
      client.from("mentions").select("entity_id").eq("document_id", documentId),
    { context: "fetch mention counts" }
  );

  // Group and count manually since Supabase doesn't support GROUP BY directly
  const counts = new Map<string, number>();
  for (const row of data) {
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
