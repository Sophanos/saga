import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeBulkMutation,
  executeVoidMutation,
} from "../queryHelper";
import type { Database } from "../types/database";

type Interaction = Database["public"]["Tables"]["interactions"]["Row"];
type InteractionInsert = Database["public"]["Tables"]["interactions"]["Insert"];
type InteractionUpdate = Database["public"]["Tables"]["interactions"]["Update"];

/**
 * Get all interactions for a project, optionally filtered by document
 */
export async function getInteractions(
  projectId: string,
  documentId?: string
): Promise<Interaction[]> {
  return executeQuery<Interaction>(
    (client) => {
      let query = client
        .from("interactions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (documentId) {
        query = query.eq("document_id", documentId);
      }

      return query;
    },
    { context: "fetch interactions" }
  );
}

/**
 * Get a single interaction by id
 */
export async function getInteraction(id: string): Promise<Interaction | null> {
  return executeSingleQuery<Interaction>(
    (client) =>
      client.from("interactions").select("*").eq("id", id).single(),
    { context: "fetch interaction" }
  );
}

/**
 * Create a new interaction
 */
export async function createInteraction(
  interaction: InteractionInsert
): Promise<Interaction> {
  return executeMutation<Interaction>(
    (client) =>
      client
        .from("interactions")
        .insert(interaction as never)
        .select()
        .single(),
    { context: "create interaction" }
  );
}

/**
 * Update an existing interaction
 */
export async function updateInteraction(
  id: string,
  updates: InteractionUpdate
): Promise<Interaction> {
  return executeMutation<Interaction>(
    (client) =>
      client
        .from("interactions")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update interaction" }
  );
}

/**
 * Delete an interaction
 */
export async function deleteInteraction(id: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("interactions").delete().eq("id", id),
    { context: "delete interaction" }
  );
}

/**
 * Get all interactions involving a specific entity (as source or target)
 */
export async function getInteractionsByEntity(
  projectId: string,
  entityId: string
): Promise<Interaction[]> {
  return executeQuery<Interaction>(
    (client) =>
      client
        .from("interactions")
        .select("*")
        .eq("project_id", projectId)
        .or(`source_id.eq.${entityId},target_id.eq.${entityId}`)
        .order("created_at", { ascending: true }),
    { context: "fetch interactions by entity" }
  );
}

/**
 * Get interactions by type (neutral, hostile, hidden, passive)
 */
export async function getInteractionsByType(
  projectId: string,
  type: string
): Promise<Interaction[]> {
  return executeQuery<Interaction>(
    (client) =>
      client
        .from("interactions")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", type)
        .order("created_at", { ascending: true }),
    { context: "fetch interactions by type" }
  );
}

/**
 * Get hidden interactions for a project
 */
export async function getHiddenInteractions(
  projectId: string
): Promise<Interaction[]> {
  return getInteractionsByType(projectId, "hidden");
}

/**
 * Bulk create interactions
 */
export async function createInteractions(
  interactions: InteractionInsert[]
): Promise<Interaction[]> {
  return executeBulkMutation<Interaction>(
    (client) =>
      client
        .from("interactions")
        .insert(interactions as never[])
        .select(),
    { context: "create interactions" }
  );
}

/**
 * Delete all interactions for a document
 */
export async function deleteInteractionsByDocument(
  documentId: string
): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("interactions").delete().eq("document_id", documentId),
    { context: "delete interactions" }
  );
}
