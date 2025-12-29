/**
 * Base API Client
 *
 * Unified client for calling Supabase edge functions with consistent
 * error handling, status code mapping, and abort signal support.
 */

/** Standard error codes for API responses */
export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "CONFIGURATION_ERROR"
  | "ABORTED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Base API error class for all edge function calls.
 * Extended by domain-specific error classes for backwards compatibility.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Options for edge function calls */
export interface EdgeFunctionOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Optional API key passed via x-openrouter-key header */
  apiKey?: string;
}

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

/**
 * Maps HTTP status codes to standardized API error codes.
 */
function mapStatusToErrorCode(status: number): ApiErrorCode {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "UNKNOWN_ERROR";
}

/**
 * Gets a human-readable default error message for a status code.
 */
function getDefaultErrorMessage(status: number, endpoint: string): string {
  switch (status) {
    case 401:
      return "Invalid or missing API key";
    case 429:
      return "Rate limit exceeded. Please try again later.";
    default:
      return `Request to ${endpoint} failed: ${status}`;
  }
}

/**
 * Parses error response from edge function.
 * Handles both nested format { error: { code, message } } and flat format { code, message }.
 */
async function parseErrorResponse(
  response: Response,
  defaultMessage: string,
  defaultCode: ApiErrorCode
): Promise<{ message: string; code: ApiErrorCode }> {
  let message = defaultMessage;
  let code = defaultCode;

  try {
    const errorData = await response.json();
    // Handle edge function error format: { error: { code, message } }
    if (errorData.error) {
      if (errorData.error.message) message = errorData.error.message;
      if (errorData.error.code) code = errorData.error.code as ApiErrorCode;
    } else {
      // Fallback to flat format
      if (errorData.message) message = errorData.message;
      if (errorData.code) code = errorData.code as ApiErrorCode;
    }
  } catch {
    // Ignore JSON parse errors, use defaults
  }

  return { message, code };
}

/**
 * Calls a Supabase edge function with unified error handling.
 *
 * @param endpoint - Function name (e.g., "ai-lint") or full path (e.g., "/functions/v1/ai-lint")
 * @param payload - Request body to send as JSON
 * @param options - Optional abort signal and API key
 * @returns Parsed JSON response
 * @throws ApiError on failure
 *
 * @example
 * ```typescript
 * const result = await callEdgeFunction<RequestType, ResponseType>(
 *   "ai-lint",
 *   { content: "..." },
 *   { signal: abortController.signal }
 * );
 * ```
 */
export async function callEdgeFunction<TReq, TRes>(
  endpoint: string,
  payload: TReq,
  options?: EdgeFunctionOptions
): Promise<TRes> {
  const { signal, apiKey } = options ?? {};

  if (!SUPABASE_URL) {
    throw new ApiError(
      "VITE_SUPABASE_URL not configured",
      "CONFIGURATION_ERROR",
      500
    );
  }

  // Normalize endpoint: add /functions/v1/ prefix if not present
  const functionPath = endpoint.startsWith("/functions/v1/")
    ? endpoint
    : `/functions/v1/${endpoint}`;

  const url = `${SUPABASE_URL}${functionPath}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const defaultCode = mapStatusToErrorCode(response.status);
      const defaultMessage = getDefaultErrorMessage(response.status, endpoint);
      const { message, code } = await parseErrorResponse(
        response,
        defaultMessage,
        defaultCode
      );
      throw new ApiError(message, code, response.status);
    }

    return (await response.json()) as TRes;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) throw error;

    // Handle abort
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request aborted", "ABORTED");
    }

    // Wrap unknown errors
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ApiError(message, "UNKNOWN_ERROR");
  }
}

/**
 * Creates a domain-specific error class that extends ApiError.
 * Provides backwards compatibility for existing code expecting specific error types.
 */
export function createDomainError(
  name: string
): new (
  message: string,
  statusCode?: number,
  code?: ApiErrorCode
) => ApiError & { name: string } {
  return class DomainError extends ApiError {
    constructor(message: string, statusCode?: number, code?: ApiErrorCode) {
      super(message, code ?? "UNKNOWN_ERROR", statusCode);
      this.name = name;
    }
  };
}
