import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeBulkMutation,
  executeVoidMutation,
} from "../queryHelper";
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
  return executeQuery<Relationship>(
    (client) =>
      client
        .from("relationships")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    { context: "fetch relationships" }
  );
}

/**
 * Get a single relationship by ID
 */
export async function getRelationship(id: string): Promise<Relationship | null> {
  return executeSingleQuery<Relationship>(
    (client) => client.from("relationships").select("*").eq("id", id).single(),
    { context: "fetch relationship" }
  );
}

/**
 * Get all relationships involving a specific entity (as source or target)
 */
export async function getRelationshipsByEntity(
  projectId: string,
  entityId: string
): Promise<Relationship[]> {
  return executeQuery<Relationship>(
    (client) =>
      client
        .from("relationships")
        .select("*")
        .eq("project_id", projectId)
        .or(`source_id.eq.${entityId},target_id.eq.${entityId}`)
        .order("created_at", { ascending: false }),
    { context: "fetch relationships by entity" }
  );
}

/**
 * Get relationships by type
 */
export async function getRelationshipsByType(
  projectId: string,
  type: string
): Promise<Relationship[]> {
  return executeQuery<Relationship>(
    (client) =>
      client
        .from("relationships")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", type)
        .order("created_at", { ascending: false }),
    { context: "fetch relationships by type" }
  );
}

/**
 * Get relationship between two specific entities
 */
export async function getRelationshipBetween(
  projectId: string,
  entityA: string,
  entityB: string
): Promise<Relationship[]> {
  return executeQuery<Relationship>(
    (client) =>
      client
        .from("relationships")
        .select("*")
        .eq("project_id", projectId)
        .or(
          `and(source_id.eq.${entityA},target_id.eq.${entityB}),and(source_id.eq.${entityB},target_id.eq.${entityA})`
        ),
    { context: "fetch relationship between entities" }
  );
}

/**
 * Create a new relationship
 */
export async function createRelationship(
  relationship: RelationshipInsert
): Promise<Relationship> {
  return executeMutation<Relationship>(
    (client) =>
      client
        .from("relationships")
        .insert(relationship as never)
        .select()
        .single(),
    { context: "create relationship" }
  );
}

/**
 * Create multiple relationships in a batch
 */
export async function createRelationships(
  relationships: RelationshipInsert[]
): Promise<Relationship[]> {
  if (relationships.length === 0) return [];

  return executeBulkMutation<Relationship>(
    (client) =>
      client
        .from("relationships")
        .insert(relationships as never[])
        .select(),
    { context: "create relationships" }
  );
}

/**
 * Update an existing relationship
 */
export async function updateRelationship(
  id: string,
  updates: RelationshipUpdate
): Promise<Relationship> {
  return executeMutation<Relationship>(
    (client) =>
      client
        .from("relationships")
        .update(updates as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update relationship" }
  );
}

/**
 * Delete a single relationship
 */
export async function deleteRelationship(id: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("relationships").delete().eq("id", id),
    { context: "delete relationship" }
  );
}

/**
 * Delete all relationships involving a specific entity
 */
export async function deleteRelationshipsByEntity(
  entityId: string
): Promise<void> {
  return executeVoidMutation(
    (client) =>
      client
        .from("relationships")
        .delete()
        .or(`source_id.eq.${entityId},target_id.eq.${entityId}`),
    { context: "delete relationships by entity" }
  );
}

/**
 * Delete all relationships for a project
 */
export async function deleteRelationshipsByProject(
  projectId: string
): Promise<void> {
  return executeVoidMutation(
    (client) =>
      client.from("relationships").delete().eq("project_id", projectId),
    { context: "delete relationships by project" }
  );
}
