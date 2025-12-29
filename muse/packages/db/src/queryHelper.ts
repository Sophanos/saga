import { getSupabaseClient, type TypedSupabaseClient } from "./client";
import type { PostgrestError } from "@supabase/supabase-js";
import { DBError, mapSupabaseErrorCode } from "./errors";

/**
 * Result shape from Supabase queries
 */
type QueryResult<T> = {
  data: T | null;
  error: PostgrestError | null;
};

/**
 * Options for query execution
 */
type QueryOptions = {
  /** Context for error messages (e.g., "fetch projects", "create entity") */
  context: string;
};

/**
 * Database query error with context and typed error codes.
 * Extends DBError to provide consistent error handling across all DB operations.
 */
export class DbQueryError extends DBError {
  constructor(
    public readonly context: string,
    public readonly originalError: PostgrestError
  ) {
    const code = mapSupabaseErrorCode(originalError.code);
    super(
      `Failed to ${context}: ${originalError.message}`,
      code,
      originalError.code,
      originalError.details ?? undefined
    );
    this.name = "DbQueryError";
  }
}

/**
 * Execute a query that returns an array of items.
 * Handles error checking and provides consistent error messages.
 *
 * @example
 * ```typescript
 * const entities = await executeQuery(
 *   (client) => client.from("entities").select("*").eq("project_id", projectId),
 *   { context: "fetch entities" }
 * );
 * ```
 */
export async function executeQuery<T>(
  queryFn: (client: TypedSupabaseClient) => PromiseLike<QueryResult<T[]>>,
  options: QueryOptions
): Promise<T[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await queryFn(supabase);

  if (error) {
    throw new DbQueryError(options.context, error);
  }

  return (data as T[]) || [];
}

/**
 * Execute a query that returns a single item or null.
 * Handles the PGRST116 "not found" error code gracefully.
 *
 * @example
 * ```typescript
 * const project = await executeSingleQuery(
 *   (client) => client.from("projects").select("*").eq("id", id).single(),
 *   { context: "fetch project" }
 * );
 * ```
 */
export async function executeSingleQuery<T>(
  queryFn: (client: TypedSupabaseClient) => PromiseLike<QueryResult<T>>,
  options: QueryOptions
): Promise<T | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await queryFn(supabase);

  if (error) {
    // PGRST116 = "The result contains 0 rows" - treat as not found
    if (error.code === "PGRST116") {
      return null;
    }
    throw new DbQueryError(options.context, error);
  }

  return data as T;
}

/**
 * Execute a mutation (insert/update) that returns data.
 * Use for operations that return the created/updated record.
 *
 * @example
 * ```typescript
 * const entity = await executeMutation(
 *   (client) => client.from("entities").insert(data).select().single(),
 *   { context: "create entity" }
 * );
 * ```
 */
export async function executeMutation<T>(
  mutationFn: (client: TypedSupabaseClient) => PromiseLike<QueryResult<T>>,
  options: QueryOptions
): Promise<T> {
  const supabase = getSupabaseClient();
  const { data, error } = await mutationFn(supabase);

  if (error) {
    throw new DbQueryError(options.context, error);
  }

  return data as T;
}

/**
 * Execute a mutation (insert/update) that returns an array of items.
 * Use for bulk operations that return created/updated records.
 *
 * @example
 * ```typescript
 * const documents = await executeBulkMutation(
 *   (client) => client.from("documents").insert(docs).select(),
 *   { context: "create documents" }
 * );
 * ```
 */
export async function executeBulkMutation<T>(
  mutationFn: (client: TypedSupabaseClient) => PromiseLike<QueryResult<T[]>>,
  options: QueryOptions
): Promise<T[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await mutationFn(supabase);

  if (error) {
    throw new DbQueryError(options.context, error);
  }

  return (data as T[]) || [];
}

/**
 * Execute a void mutation (delete, update without return).
 * Use for operations that don't need to return data.
 *
 * @example
 * ```typescript
 * await executeVoidMutation(
 *   (client) => client.from("entities").delete().eq("id", id),
 *   { context: "delete entity" }
 * );
 * ```
 */
export async function executeVoidMutation(
  mutationFn: (client: TypedSupabaseClient) => PromiseLike<{ error: PostgrestError | null }>,
  options: QueryOptions
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await mutationFn(supabase);

  if (error) {
    throw new DbQueryError(options.context, error);
  }
}

/**
 * Execute an RPC call that returns data.
 * Use for Supabase RPC functions.
 *
 * @example
 * ```typescript
 * const results = await executeRpc(
 *   (client) => client.rpc("search_entities", { query_embedding: embedding }),
 *   { context: "search entities" }
 * );
 * ```
 */
export async function executeRpc<T>(
  rpcFn: (client: TypedSupabaseClient) => PromiseLike<QueryResult<T>>,
  options: QueryOptions
): Promise<T> {
  const supabase = getSupabaseClient();
  const { data, error } = await rpcFn(supabase);

  if (error) {
    throw new DbQueryError(options.context, error);
  }

  return data as T;
}
