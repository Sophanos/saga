/**
 * Base API Client
 *
 * Unified client for calling Convex HTTP actions with consistent
 * error handling, status code mapping, abort signal support, and retry logic.
 */

import { getConvexToken } from "../lib/tokenCache";
import { CONVEX_SITE_URL, RETRY_CONFIG } from "./config";

// =============================================================================
// Retry Configuration
// =============================================================================

export const DEFAULT_RETRY_CONFIG = {
  maxRetries: RETRY_CONFIG.MAX_RETRIES,
  baseDelayMs: RETRY_CONFIG.BASE_DELAY_MS,
  backoffMultiplier: RETRY_CONFIG.BACKOFF_MULTIPLIER,
  maxDelayMs: RETRY_CONFIG.MAX_DELAY_MS,
  retryableStatusCodes: [...RETRY_CONFIG.RETRYABLE_STATUS_CODES],
} as const;

export interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
  retryableStatusCodes?: number[];
}

// =============================================================================
// Error Types
// =============================================================================

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "CONFIGURATION_ERROR"
  | "ABORTED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR"
  | "FORBIDDEN"
  | "AI_ERROR"
  | "BILLING_ERROR"
  | "QUOTA_EXCEEDED";

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

export interface EdgeFunctionOptions {
  signal?: AbortSignal;
  apiKey?: string;
  authToken?: string;
  retry?: RetryConfig | false;
}

// =============================================================================
// Helper Functions
// =============================================================================

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
  const token = await getConvexToken();
  return token ? `Bearer ${token}` : null;
}

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

async function parseErrorResponse(
  response: Response,
  defaultMessage: string,
  defaultCode: ApiErrorCode
): Promise<{ message: string; code: ApiErrorCode }> {
  let message = defaultMessage;
  let code = defaultCode;

  try {
    const errorData = await response.json();
    if (errorData.error) {
      if (errorData.error.message) message = errorData.error.message;
      if (errorData.error.code) code = errorData.error.code as ApiErrorCode;
    } else {
      if (errorData.message) message = errorData.message;
      if (errorData.code) code = errorData.code as ApiErrorCode;
    }
  } catch {
    // Use defaults
  }

  return { message, code };
}

function calculateBackoffDelay(
  attempt: number,
  config: Required<RetryConfig>,
  retryAfterHeader?: string | null
): number {
  if (retryAfterHeader) {
    const retryAfterSeconds = parseInt(retryAfterHeader, 10);
    if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      const jitter = Math.random() * 500;
      return Math.min(retryAfterSeconds * 1000 + jitter, config.maxDelayMs);
    }
  }

  const exponentialDelay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = exponentialDelay * (0.1 + Math.random() * 0.2);
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

function isRetryableStatus(
  status: number,
  retryableStatusCodes: number[]
): boolean {
  return retryableStatusCodes.includes(status);
}

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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryConfig: RetryConfig | false | undefined
): Promise<Response> {
  if (retryConfig === false) {
    return fetch(url, options);
  }

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

      if (isRetryableStatus(response.status, config.retryableStatusCodes)) {
        lastResponse = response;

        if (attempt < config.maxRetries) {
          const delay = calculateBackoffDelay(
            attempt,
            config,
            response.headers.get("Retry-After")
          );

          await sleep(delay, options.signal as AbortSignal | undefined);
          continue;
        }
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxRetries) {
        const delay = calculateBackoffDelay(attempt, config);
        await sleep(delay, options.signal as AbortSignal | undefined);
        continue;
      }
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error("Max retries exceeded");
}

// =============================================================================
// Main API Function
// =============================================================================

/**
 * Calls a Convex HTTP action with unified error handling and retry logic.
 *
 * @param endpoint - HTTP action path (e.g., "ai/lint")
 * @param payload - Request body to send as JSON
 * @param options - Optional abort signal, API key, and retry configuration
 */
export async function callEdgeFunction<TReq, TRes>(
  endpoint: string,
  payload: TReq,
  options?: EdgeFunctionOptions
): Promise<TRes> {
  const { signal, apiKey, retry, authToken } = options ?? {};

  if (!CONVEX_SITE_URL) {
    throw new ApiError(
      "VITE_CONVEX_SITE_URL not configured",
      "CONFIGURATION_ERROR",
      500
    );
  }

  const url = `${CONVEX_SITE_URL}/api/${endpoint}`;
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
    if (error instanceof ApiError) throw error;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request aborted", "ABORTED");
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ApiError(message, "UNKNOWN_ERROR");
  }
}

// =============================================================================
// Domain Error Factory
// =============================================================================

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
