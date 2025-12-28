import { supabase } from "../client";
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
  let query = supabase
    .from("interactions")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (documentId) {
    query = query.eq("document_id", documentId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch interactions: ${error.message}`);
  }

  return (data as Interaction[]) || [];
}

/**
 * Get a single interaction by id
 */
export async function getInteraction(id: string): Promise<Interaction | null> {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch interaction: ${error.message}`);
  }

  return data as Interaction;
}

/**
 * Create a new interaction
 */
export async function createInteraction(
  interaction: InteractionInsert
): Promise<Interaction> {
  const { data, error } = await supabase
    .from("interactions")
    .insert(interaction as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create interaction: ${error.message}`);
  }

  return data as Interaction;
}

/**
 * Update an existing interaction
 */
export async function updateInteraction(
  id: string,
  updates: InteractionUpdate
): Promise<Interaction> {
  const { data, error } = await supabase
    .from("interactions")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update interaction: ${error.message}`);
  }

  return data as Interaction;
}

/**
 * Delete an interaction
 */
export async function deleteInteraction(id: string): Promise<void> {
  const { error } = await supabase.from("interactions").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete interaction: ${error.message}`);
  }
}

/**
 * Get all interactions involving a specific entity (as source or target)
 */
export async function getInteractionsByEntity(
  projectId: string,
  entityId: string
): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("project_id", projectId)
    .or(`source_id.eq.${entityId},target_id.eq.${entityId}`)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch interactions by entity: ${error.message}`);
  }

  return (data as Interaction[]) || [];
}

/**
 * Get interactions by type (neutral, hostile, hidden, passive)
 */
export async function getInteractionsByType(
  projectId: string,
  type: string
): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("interactions")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", type)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch interactions by type: ${error.message}`);
  }

  return (data as Interaction[]) || [];
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
  const { data, error } = await supabase
    .from("interactions")
    .insert(interactions as never[])
    .select();

  if (error) {
    throw new Error(`Failed to create interactions: ${error.message}`);
  }

  return (data as Interaction[]) || [];
}

/**
 * Delete all interactions for a document
 */
export async function deleteInteractionsByDocument(
  documentId: string
): Promise<void> {
  const { error } = await supabase
    .from("interactions")
    .delete()
    .eq("document_id", documentId);

  if (error) {
    throw new Error(`Failed to delete interactions: ${error.message}`);
  }
}
