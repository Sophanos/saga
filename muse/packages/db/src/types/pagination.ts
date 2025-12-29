/**
 * Pagination types for database queries
 */

/**
 * Parameters for paginated queries
 */
export interface PaginationParams {
  /** Maximum number of records to return (default: 50) */
  limit?: number;
  /** Number of records to skip (default: 0) */
  offset?: number;
}

/**
 * Result wrapper for paginated queries
 */
export interface PaginatedResult<T> {
  /** The data for the current page */
  data: T[];
  /** Total number of records matching the query */
  total: number;
  /** Whether there are more records after this page */
  hasMore: boolean;
}

/**
 * Default pagination values
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 500;

/**
 * Normalize pagination params with defaults and limits
 */
export function normalizePaginationParams(
  params?: PaginationParams
): Required<PaginationParams> {
  const limit = Math.min(
    Math.max(params?.limit ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const offset = Math.max(params?.offset ?? 0, 0);
  return { limit, offset };
}

/**
 * Create a paginated result from data array and count
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: Required<PaginationParams>
): PaginatedResult<T> {
  return {
    data,
    total,
    hasMore: params.offset + data.length < total,
  };
}
