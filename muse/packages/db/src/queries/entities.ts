import { supabase } from "../client";
import type { Database } from "../types/database";

type Entity = Database["public"]["Tables"]["entities"]["Row"];
type EntityInsert = Database["public"]["Tables"]["entities"]["Insert"];
type EntityUpdate = Database["public"]["Tables"]["entities"]["Update"];

export async function getEntities(projectId: string): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`);
  }

  return (data as Entity[]) || [];
}

export async function getEntitiesByType(
  projectId: string,
  type: string
): Promise<Entity[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", type)
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`);
  }

  return (data as Entity[]) || [];
}

export async function getEntity(id: string): Promise<Entity | null> {
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch entity: ${error.message}`);
  }

  return data as Entity;
}

export async function createEntity(entity: EntityInsert): Promise<Entity> {
  const { data, error } = await supabase
    .from("entities")
    .insert(entity as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create entity: ${error.message}`);
  }

  return data as Entity;
}

export async function updateEntity(
  id: string,
  updates: EntityUpdate
): Promise<Entity> {
  const { data, error } = await supabase
    .from("entities")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update entity: ${error.message}`);
  }

  return data as Entity;
}

export async function deleteEntity(id: string): Promise<void> {
  const { error } = await supabase.from("entities").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete entity: ${error.message}`);
  }
}

export async function searchEntities(
  projectId: string,
  query: string
): Promise<Entity[]> {
  // Text search on name and aliases
  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("project_id", projectId)
    .or(`name.ilike.%${query}%,aliases.cs.{${query}}`);

  if (error) {
    throw new Error(`Failed to search entities: ${error.message}`);
  }

  return (data as Entity[]) || [];
}

// Semantic search using embeddings (requires pgvector)
// Note: This function requires the search_entities RPC to be set up in Supabase
export async function semanticSearchEntities(
  projectId: string,
  embedding: number[],
  threshold: number = 0.7,
  limit: number = 10
): Promise<{ id: string; name: string; type: string; similarity: number }[]> {
  const { data, error } = await supabase.rpc("search_entities", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    project_filter: projectId,
  } as never);

  if (error) {
    throw new Error(`Failed to search entities: ${error.message}`);
  }

  return (data as { id: string; name: string; type: string; similarity: number }[]) || [];
}
