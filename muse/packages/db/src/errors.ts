/**
 * Database Error Types
 *
 * Typed error classes for database operations with standardized error codes.
 * Provides consistent error handling across all DB query functions.
 *
 * Usage:
 * - Use `DBError.fromSupabaseError()` for wrapping raw Supabase errors
 * - Use `NotFoundError` when a specific record cannot be found
 * - Use `QueryError` when a database query fails with context
 * - Use type guards (`isDBError`, `isNotFoundError`) for error handling
 */

/** Standard error codes for database operations */
export type DBErrorCode =
  | "QUERY_FAILED"
  | "NOT_FOUND"
  | "CONSTRAINT_VIOLATION"
  | "DUPLICATE_KEY"
  | "FOREIGN_KEY_VIOLATION"
  | "INVALID_INPUT"
  | "CONNECTION_ERROR"
  | "TIMEOUT"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Maps Supabase/PostgreSQL error codes to DBErrorCode.
 * See: https://postgrest.org/en/stable/errors.html
 */
export function mapSupabaseErrorCode(code: string | undefined): DBErrorCode {
  if (!code) return "UNKNOWN_ERROR";

  // PostgREST error codes
  if (code === "PGRST116") return "NOT_FOUND"; // "Searched for a single row but found 0"
  if (code === "PGRST301") return "TIMEOUT";
  if (code.startsWith("PGRST")) return "QUERY_FAILED";

  // PostgreSQL error codes
  if (code === "23505") return "DUPLICATE_KEY"; // unique_violation
  if (code === "23503") return "FOREIGN_KEY_VIOLATION"; // foreign_key_violation
  if (code === "23514") return "CONSTRAINT_VIOLATION"; // check_violation
  if (code === "23502") return "CONSTRAINT_VIOLATION"; // not_null_violation
  if (code === "42501") return "PERMISSION_DENIED"; // insufficient_privilege
  if (code === "22P02") return "INVALID_INPUT"; // invalid_text_representation
  if (code === "08006") return "CONNECTION_ERROR"; // connection_failure

  return "QUERY_FAILED";
}

/**
 * Base database error class for all DB query operations.
 * Provides typed error codes and preserves the original Supabase error details.
 */
export class DBError extends Error {
  constructor(
    message: string,
    public readonly code: DBErrorCode,
    public readonly originalCode?: string,
    public readonly details?: string,
    public readonly table?: string,
    public readonly operation?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "DBError";
  }

  /**
   * Create a DBError from a Supabase error response.
   * Automatically maps Supabase error codes to typed DBErrorCode.
   */
  static fromSupabaseError(
    error: { message: string; code?: string; details?: string },
    context?: string,
    table?: string,
    operation?: string
  ): DBError {
    const code = mapSupabaseErrorCode(error.code);
    const message = context
      ? `${context}: ${error.message}`
      : error.message;

    return new DBError(message, code, error.code, error.details, table, operation);
  }
}

/**
 * Error thrown when a record is not found in the database.
 * Use for explicit "not found" conditions (distinct from query failures).
 */
export class NotFoundError extends DBError {
  constructor(table: string, identifier: string) {
    super(
      `${table} not found: ${identifier}`,
      "NOT_FOUND",
      undefined,
      undefined,
      table,
      "find"
    );
    this.name = "NotFoundError";
  }
}

/**
 * Error thrown when a database query fails.
 * Wraps the original error with table and operation context.
 */
export class QueryError extends DBError {
  constructor(
    table: string,
    operation: string,
    cause: Error & { code?: string; details?: string }
  ) {
    const code = mapSupabaseErrorCode(cause.code);
    super(
      `Failed to ${operation} ${table}: ${cause.message}`,
      code,
      cause.code,
      cause.details,
      table,
      operation,
      cause
    );
    this.name = "QueryError";
  }
}

/**
 * Error thrown when input validation fails before reaching the database.
 */
export class ValidationError extends DBError {
  constructor(message: string, field?: string) {
    super(
      message,
      "VALIDATION_ERROR",
      undefined,
      field ? `Field: ${field}` : undefined
    );
    this.name = "ValidationError";
  }
}

/**
 * Error thrown when a database constraint is violated.
 */
export class ConstraintViolationError extends DBError {
  constructor(
    table: string,
    constraint: string,
    cause?: Error & { code?: string; details?: string }
  ) {
    super(
      `Constraint violation on ${table}: ${constraint}`,
      "CONSTRAINT_VIOLATION",
      cause?.code,
      cause?.details,
      table,
      "constraint_check",
      cause
    );
    this.name = "ConstraintViolationError";
  }
}

/**
 * Type guard to check if an error is a DBError
 */
export function isDBError(error: unknown): error is DBError {
  return error instanceof DBError;
}

/**
 * Check if a DBError indicates a not-found condition
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    (error instanceof NotFoundError) ||
    (isDBError(error) && error.code === "NOT_FOUND")
  );
}

/**
 * Check if a DBError indicates a duplicate key/unique constraint violation
 */
export function isDuplicateError(error: unknown): boolean {
  return isDBError(error) && error.code === "DUPLICATE_KEY";
}

/**
 * Check if a DBError indicates a validation error
 */
export function isValidationError(error: unknown): boolean {
  return (
    (error instanceof ValidationError) ||
    (isDBError(error) && error.code === "VALIDATION_ERROR")
  );
}

/**
 * Check if a DBError indicates a constraint violation
 */
export function isConstraintViolationError(error: unknown): boolean {
  return (
    (error instanceof ConstraintViolationError) ||
    (isDBError(error) && error.code === "CONSTRAINT_VIOLATION")
  );
}

/**
 * Check if a DBError indicates a query error
 */
export function isQueryError(error: unknown): error is QueryError {
  return error instanceof QueryError;
}
