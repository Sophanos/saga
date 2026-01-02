/**
 * Base API Client
 *
 * Unified client for calling Supabase edge functions with consistent
 * error handling, status code mapping, abort signal support, and retry logic.
 *
 * Features:
 * - Automatic retry with exponential backoff for transient failures
 * - Rate limit detection and backoff (429 responses)
 * - Configurable retry options (attempts, backoff multiplier, max delay)
 * - Server error retry (5xx responses)
 */

import { getSupabaseClient, isSupabaseInitialized } from "@mythos/db";
import { RETRY_CONFIG } from "./config";

// =============================================================================
// Retry Configuration
// =============================================================================

/** Default retry configuration - uses centralized config values */
export const DEFAULT_RETRY_CONFIG = {
  /** Maximum number of retry attempts (0 = no retries) */
  maxRetries: RETRY_CONFIG.MAX_RETRIES,
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs: RETRY_CONFIG.BASE_DELAY_MS,
  /** Multiplier for exponential backoff (delay = baseDelay * multiplier^attempt) */
  backoffMultiplier: RETRY_CONFIG.BACKOFF_MULTIPLIER,
  /** Maximum delay cap in milliseconds */
  maxDelayMs: RETRY_CONFIG.MAX_DELAY_MS,
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: [...RETRY_CONFIG.RETRYABLE_STATUS_CODES],
} as const;

/** Retry configuration options */
export interface RetryConfig {
  /** Maximum number of retry attempts (0 = no retries, default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs?: number;
  /** HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504]) */
  retryableStatusCodes?: number[];
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Standard error codes for API responses.
 *
 * These codes align with the server-side ErrorCode enum in
 * supabase/functions/_shared/errors.ts to provide consistent
 * error handling across client and server.
 */
export type ApiErrorCode =
  // Client-side error codes
  | "VALIDATION_ERROR"
  | "CONFIGURATION_ERROR"
  | "ABORTED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR"
  // Server-side error codes (from _shared/errors.ts ErrorCode enum)
  | "FORBIDDEN"
  | "AI_ERROR"
  | "BILLING_ERROR"
  | "QUOTA_EXCEEDED";

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

// =============================================================================
// Options & Configuration
// =============================================================================

/** Options for edge function calls */
export interface EdgeFunctionOptions {
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
  /** Optional API key passed via x-openrouter-key header */
  apiKey?: string;
  /** Optional Supabase auth token or Authorization header value */
  authToken?: string;
  /** Retry configuration (set to false to disable retries) */
  retry?: RetryConfig | false;
}

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

// =============================================================================
// Helper Functions
// =============================================================================

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

async function resolveAuthHeader(authToken?: string): Promise<string | null> {
  if (authToken) {
    return authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
  }

  if (!isSupabaseInitialized()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      if (import.meta.env.DEV) {
        console.warn("[api-client] Failed to resolve auth session:", error.message);
      }
      return null;
    }

    return session?.access_token ? `Bearer ${session.access_token}` : null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[api-client] Failed to resolve auth token:", error);
    }
    return null;
  }
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
 * Calculates the delay for exponential backoff with jitter.
 * Respects Retry-After header for 429 responses when available.
 *
 * @param attempt - Current retry attempt (0-indexed)
 * @param config - Retry configuration
 * @param retryAfterHeader - Optional Retry-After header value from 429 response
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(
  attempt: number,
  config: Required<RetryConfig>,
  retryAfterHeader?: string | null
): number {
  // Respect Retry-After header if present (for rate limiting)
  if (retryAfterHeader) {
    const retryAfterSeconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      // Add small jitter (0-500ms) to prevent thundering herd
      const jitter = Math.random() * 500;
      return Math.min(retryAfterSeconds * 1000 + jitter, config.maxDelayMs);
    }
  }

  // Exponential backoff: baseDelay * multiplier^attempt
  const exponentialDelay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Add jitter (10-30% of delay) to prevent synchronized retries
  const jitter = exponentialDelay * (0.1 + Math.random() * 0.2);

  // Cap at maxDelayMs
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Checks if a response status code should trigger a retry.
 */
function isRetryableStatus(
  status: number,
  retryableStatusCodes: number[]
): boolean {
  return retryableStatusCodes.includes(status);
}

/**
 * Sleeps for the specified duration, respecting abort signal.
 * @throws Error if aborted during sleep
 */
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeoutId = setTimeout(resolve, ms);

    const abortHandler = () => {
      clearTimeout(timeoutId);
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", abortHandler, { once: true });
  });
}

// =============================================================================
// Fetch with Retry
// =============================================================================

/**
 * Internal fetch wrapper with retry logic and exponential backoff.
 * Handles transient failures (network errors, rate limits, server errors).
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @param retryConfig - Retry configuration
 * @returns Response object
 * @throws Error on final failure or abort
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryConfig: RetryConfig | false | undefined
): Promise<Response> {
  // If retry is disabled, just fetch once
  if (retryConfig === false) {
    return fetch(url, options);
  }

  // Merge with defaults
  const config: Required<RetryConfig> = {
    maxRetries: retryConfig?.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
    baseDelayMs: retryConfig?.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs,
    backoffMultiplier:
      retryConfig?.backoffMultiplier ?? DEFAULT_RETRY_CONFIG.backoffMultiplier,
    maxDelayMs: retryConfig?.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
    retryableStatusCodes:
      retryConfig?.retryableStatusCodes ??
      [...DEFAULT_RETRY_CONFIG.retryableStatusCodes],
  };

  let lastError: Error | undefined;
  let lastResponse: Response | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Check if we should retry based on status code
      if (isRetryableStatus(response.status, config.retryableStatusCodes)) {
        lastResponse = response;

        // Don't retry if this was the last attempt
        if (attempt < config.maxRetries) {
          const delay = calculateBackoffDelay(
            attempt,
            config,
            response.headers.get("Retry-After")
          );

          // Log retry for observability
          if (import.meta.env.DEV) {
            console.warn(
              `[api-client] Retrying request (attempt ${attempt + 1}/${config.maxRetries}) ` +
                `after ${Math.round(delay)}ms due to status ${response.status}`
            );
          }

          await sleep(delay, options.signal as AbortSignal | undefined);
          continue;
        }
      }

      return response;
    } catch (error) {
      // Don't retry abort errors
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if this was the last attempt
      if (attempt < config.maxRetries) {
        const delay = calculateBackoffDelay(attempt, config);

        if (import.meta.env.DEV) {
          console.warn(
            `[api-client] Retrying request (attempt ${attempt + 1}/${config.maxRetries}) ` +
              `after ${Math.round(delay)}ms due to network error: ${lastError.message}`
          );
        }

        await sleep(delay, options.signal as AbortSignal | undefined);
        continue;
      }
    }
  }

  // All retries exhausted
  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error("Max retries exceeded");
}

// =============================================================================
// Main API Function
// =============================================================================

/**
 * Calls a Supabase edge function with unified error handling and retry logic.
 *
 * @param endpoint - Function name (e.g., "ai-lint") or full path (e.g., "/functions/v1/ai-lint")
 * @param payload - Request body to send as JSON
 * @param options - Optional abort signal, API key, and retry configuration
 * @returns Parsed JSON response
 * @throws ApiError on failure
 *
 * @example
 * ```typescript
 * // Basic call with default retry (3 attempts)
 * const result = await callEdgeFunction<RequestType, ResponseType>(
 *   "ai-lint",
 *   { content: "..." },
 *   { signal: abortController.signal }
 * );
 *
 * // Custom retry configuration
 * const result = await callEdgeFunction<RequestType, ResponseType>(
 *   "ai-embed",
 *   { text: "..." },
 *   {
 *     retry: {
 *       maxRetries: 5,
 *       baseDelayMs: 500,
 *       backoffMultiplier: 1.5,
 *     }
 *   }
 * );
 *
 * // Disable retry for time-sensitive operations
 * const result = await callEdgeFunction<RequestType, ResponseType>(
 *   "ai-quick-check",
 *   { content: "..." },
 *   { retry: false }
 * );
 * ```
 */
export async function callEdgeFunction<TReq, TRes>(
  endpoint: string,
  payload: TReq,
  options?: EdgeFunctionOptions
): Promise<TRes> {
  const { signal, apiKey, retry, authToken } = options ?? {};

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
  const resolvedAuthHeader = await resolveAuthHeader(authToken);

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey && { "x-openrouter-key": apiKey }),
          ...(resolvedAuthHeader && { Authorization: resolvedAuthHeader }),
        },
        body: JSON.stringify(payload),
        signal,
      },
      retry
    );

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

// =============================================================================
// Domain Error Factory
// =============================================================================

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
