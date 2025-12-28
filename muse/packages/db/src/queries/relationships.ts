import { supabase } from "../client";
import type { Database } from "../types/database";

type Relationship = Database["public"]["Tables"]["relationships"]["Row"];
type RelationshipInsert = Database["public"]["Tables"]["relationships"]["Insert"];
type RelationshipUpdate = Database["public"]["Tables"]["relationships"]["Update"];

/**
 * Get all relationships for a project
 */
export async function getRelationships(
  projectId: string
): Promise<Relationship[]> {
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch relationships: ${error.message}`);
  }

  return (data as Relationship[]) || [];
}

/**
 * Get a single relationship by ID
 */
export async function getRelationship(id: string): Promise<Relationship | null> {
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch relationship: ${error.message}`);
  }

  return data as Relationship;
}

/**
 * Get all relationships involving a specific entity (as source or target)
 */
export async function getRelationshipsByEntity(
  projectId: string,
  entityId: string
): Promise<Relationship[]> {
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .eq("project_id", projectId)
    .or(`source_id.eq.${entityId},target_id.eq.${entityId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch relationships: ${error.message}`);
  }

  return (data as Relationship[]) || [];
}

/**
 * Get relationships by type
 */
export async function getRelationshipsByType(
  projectId: string,
  type: string
): Promise<Relationship[]> {
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .eq("project_id", projectId)
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch relationships: ${error.message}`);
  }

  return (data as Relationship[]) || [];
}

/**
 * Get relationship between two specific entities
 */
export async function getRelationshipBetween(
  projectId: string,
  entityA: string,
  entityB: string
): Promise<Relationship[]> {
  const { data, error } = await supabase
    .from("relationships")
    .select("*")
    .eq("project_id", projectId)
    .or(
      `and(source_id.eq.${entityA},target_id.eq.${entityB}),and(source_id.eq.${entityB},target_id.eq.${entityA})`
    );

  if (error) {
    throw new Error(`Failed to fetch relationships: ${error.message}`);
  }

  return (data as Relationship[]) || [];
}

/**
 * Create a new relationship
 */
export async function createRelationship(
  relationship: RelationshipInsert
): Promise<Relationship> {
  const { data, error } = await supabase
    .from("relationships")
    .insert(relationship as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create relationship: ${error.message}`);
  }

  return data as Relationship;
}

/**
 * Create multiple relationships in a batch
 */
export async function createRelationships(
  relationships: RelationshipInsert[]
): Promise<Relationship[]> {
  if (relationships.length === 0) return [];

  const { data, error } = await supabase
    .from("relationships")
    .insert(relationships as never[])
    .select();

  if (error) {
    throw new Error(`Failed to create relationships: ${error.message}`);
  }

  return (data as Relationship[]) || [];
}

/**
 * Update an existing relationship
 */
export async function updateRelationship(
  id: string,
  updates: RelationshipUpdate
): Promise<Relationship> {
  const { data, error } = await supabase
    .from("relationships")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update relationship: ${error.message}`);
  }

  return data as Relationship;
}

/**
 * Delete a single relationship
 */
export async function deleteRelationship(id: string): Promise<void> {
  const { error } = await supabase.from("relationships").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete relationship: ${error.message}`);
  }
}

/**
 * Delete all relationships involving a specific entity
 */
export async function deleteRelationshipsByEntity(
  entityId: string
): Promise<void> {
  const { error } = await supabase
    .from("relationships")
    .delete()
    .or(`source_id.eq.${entityId},target_id.eq.${entityId}`);

  if (error) {
    throw new Error(`Failed to delete relationships: ${error.message}`);
  }
}

/**
 * Delete all relationships for a project
 */
export async function deleteRelationshipsByProject(
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from("relationships")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete relationships: ${error.message}`);
  }
}
