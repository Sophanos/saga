import {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeVoidMutation,
  executeRpc,
} from "../queryHelper";
import { getSupabaseClient } from "../client";
import { QueryError } from "../errors";
import type { Database } from "../types/database";
import {
  type PaginationParams,
  type PaginatedResult,
  normalizePaginationParams,
  createPaginatedResult,
  DEFAULT_PAGE_SIZE,
} from "../types/pagination";

type Entity = Database["public"]["Tables"]["entities"]["Row"];
type EntityInsert = Database["public"]["Tables"]["entities"]["Insert"];
type EntityUpdate = Database["public"]["Tables"]["entities"]["Update"];

// Re-export pagination types for convenience
export type { PaginationParams, PaginatedResult };

/**
 * Get entities for a project with optional pagination
 * @param projectId - The project ID to fetch entities for
 * @param pagination - Optional pagination params (limit, offset)
 * @returns Paginated result with entities, total count, and hasMore flag
 */
export async function getEntities(
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Entity>> {
  const supabase = getSupabaseClient();
  const { limit, offset } = normalizePaginationParams(pagination);

  // Get total count
  const { count, error: countError } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (countError) {
    throw new QueryError("entities", "count", countError);
  }

  const total = count ?? 0;

  // Get paginated data
  const data = await executeQuery<Entity>(
    (client) =>
      client
        .from("entities")
        .select("*")
        .eq("project_id", projectId)
        .order("name")
        .range(offset, offset + limit - 1),
    { context: "fetch entities" }
  );

  return createPaginatedResult(data, total, { limit, offset });
}

/**
 * Get all entities for a project (fetches all pages internally)
 * Use with caution for large datasets - prefer paginated getEntities for UI
 * @param projectId - The project ID to fetch entities for
 * @returns Array of all entities
 */
export async function fetchAllEntities(projectId: string): Promise<Entity[]> {
  const allEntities: Entity[] = [];
  let offset = 0;
  const pageSize = DEFAULT_PAGE_SIZE;
  let hasMore = true;

  while (hasMore) {
    const result = await getEntities(projectId, { limit: pageSize, offset });
    allEntities.push(...result.data);
    hasMore = result.hasMore;
    offset += pageSize;
  }

  return allEntities;
}

/**
 * Get entities by type with optional pagination
 * @param projectId - The project ID
 * @param type - Entity type to filter by
 * @param pagination - Optional pagination params
 * @returns Paginated result with entities
 */
export async function getEntitiesByType(
  projectId: string,
  type: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Entity>> {
  const supabase = getSupabaseClient();
  const { limit, offset } = normalizePaginationParams(pagination);

  // Get total count for this type
  const { count, error: countError } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("type", type);

  if (countError) {
    throw new QueryError("entities", "count by type", countError);
  }

  const total = count ?? 0;

  // Get paginated data
  const data = await executeQuery<Entity>(
    (client) =>
      client
        .from("entities")
        .select("*")
        .eq("project_id", projectId)
        .eq("type", type)
        .order("name")
        .range(offset, offset + limit - 1),
    { context: "fetch entities by type" }
  );

  return createPaginatedResult(data, total, { limit, offset });
}

/**
 * Get all entities by type (fetches all pages internally)
 * @param projectId - The project ID
 * @param type - Entity type to filter by
 * @returns Array of all matching entities
 */
export async function fetchAllEntitiesByType(
  projectId: string,
  type: string
): Promise<Entity[]> {
  const allEntities: Entity[] = [];
  let offset = 0;
  const pageSize = DEFAULT_PAGE_SIZE;
  let hasMore = true;

  while (hasMore) {
    const result = await getEntitiesByType(projectId, type, {
      limit: pageSize,
      offset,
    });
    allEntities.push(...result.data);
    hasMore = result.hasMore;
    offset += pageSize;
  }

  return allEntities;
}

export async function getEntity(id: string): Promise<Entity | null> {
  return executeSingleQuery<Entity>(
    (client) => client.from("entities").select("*").eq("id", id).single(),
    { context: "fetch entity" }
  );
}

export async function createEntity(entity: EntityInsert): Promise<Entity> {
  return executeMutation<Entity>(
    (client) =>
      client
        .from("entities")
        .insert(entity as never)
        .select()
        .single(),
    { context: "create entity" }
  );
}

export async function updateEntity(
  id: string,
  updates: EntityUpdate
): Promise<Entity> {
  return executeMutation<Entity>(
    (client) =>
      client
        .from("entities")
        .update({ ...updates, updated_at: new Date().toISOString() } as never)
        .eq("id", id)
        .select()
        .single(),
    { context: "update entity" }
  );
}

export async function deleteEntity(id: string): Promise<void> {
  return executeVoidMutation(
    (client) => client.from("entities").delete().eq("id", id),
    { context: "delete entity" }
  );
}

/**
 * Search entities with optional pagination
 * @param projectId - The project ID
 * @param query - Search query string
 * @param pagination - Optional pagination params
 * @returns Paginated result with matching entities
 */
export async function searchEntities(
  projectId: string,
  query: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<Entity>> {
  const supabase = getSupabaseClient();
  const { limit, offset } = normalizePaginationParams(pagination);

  // Get total count
  const { count, error: countError } = await supabase
    .from("entities")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId)
    .or(`name.ilike.%${query}%,aliases.cs.{${query}}`);

  if (countError) {
    throw new QueryError("entities", "count search results", countError);
  }

  const total = count ?? 0;

  // Get paginated data
  const data = await executeQuery<Entity>(
    (client) =>
      client
        .from("entities")
        .select("*")
        .eq("project_id", projectId)
        .or(`name.ilike.%${query}%,aliases.cs.{${query}}`)
        .range(offset, offset + limit - 1),
    { context: "search entities" }
  );

  return createPaginatedResult(data, total, { limit, offset });
}

// Semantic search using embeddings (requires pgvector)
// Note: This function requires the search_entities RPC to be set up in Supabase
export async function semanticSearchEntities(
  projectId: string,
  embedding: number[],
  threshold: number = 0.7,
  limit: number = 10
): Promise<{ id: string; name: string; type: string; similarity: number }[]> {
  return executeRpc<
    { id: string; name: string; type: string; similarity: number }[]
  >(
    (client) =>
      client.rpc("search_entities", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit,
        project_filter: projectId,
      } as never),
    { context: "semantic search entities" }
  );
}
