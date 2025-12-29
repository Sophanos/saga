// Client initialization
export {
  initSupabaseClient,
  getSupabaseClient,
  isSupabaseInitialized,
  resetSupabaseClient,
  createServerClient,
  type SupabaseInitConfig,
  type ServerClientConfig,
  type TypedSupabaseClient,
} from "./client";

// Errors
export {
  DBError,
  NotFoundError,
  QueryError,
  ValidationError,
  ConstraintViolationError,
  isDBError,
  isNotFoundError,
  isDuplicateError,
  isValidationError,
  isConstraintViolationError,
  isQueryError,
  mapSupabaseErrorCode,
  type DBErrorCode,
} from "./errors";

// Query helpers
export {
  executeQuery,
  executeSingleQuery,
  executeMutation,
  executeBulkMutation,
  executeVoidMutation,
  executeRpc,
  DbQueryError,
} from "./queryHelper";

// Legacy export for backwards compatibility
// TODO: Remove after all consumers are updated to use getSupabaseClient()
export { supabase } from "./client";

// Types
export type { Database } from "./types/database";
export {
  type PaginationParams,
  type PaginatedResult,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePaginationParams,
  createPaginatedResult,
} from "./types/pagination";

// Queries
export * from "./queries";

// Mappers
export * from "./mappers";
