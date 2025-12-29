/**
 * Standardized Error Responses for Supabase Edge Functions
 *
 * Provides consistent error handling and response formatting
 * across all AI gateway endpoints.
 */

import { getCorsHeaders } from "./cors.ts";

/**
 * Error codes for AI Gateway
 */
export enum ErrorCode {
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  AI_ERROR = "AI_ERROR",
  RATE_LIMITED = "RATE_LIMITED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * HTTP status codes for error types
 */
const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.AI_ERROR]: 502,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.VALIDATION_ERROR]: 422,
};

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  origin: string | null,
  details?: unknown
): Response {
  const body: ErrorResponse = {
    error: {
      code,
      message,
      ...(details && { details }),
    },
  };

  const status = ERROR_STATUS_MAP[code];
  const corsHeaders = getCorsHeaders(origin);

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...Object.fromEntries(corsHeaders),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Create a success response with CORS headers
 */
export function createSuccessResponse<T>(
  data: T,
  origin: string | null
): Response {
  const corsHeaders = getCorsHeaders(origin);

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      ...Object.fromEntries(corsHeaders),
      "Content-Type": "application/json",
    },
  });
}

/**
 * Options for handleAIError
 */
export interface HandleAIErrorOptions {
  /** Name of the AI provider for error messages (default: "AI provider") */
  providerName?: string;
}

/**
 * Parse error from AI provider and return appropriate response
 *
 * @param error - The error to handle
 * @param origin - Request origin for CORS headers
 * @param options - Optional configuration (e.g., provider name for error messages)
 */
export function handleAIError(
  error: unknown,
  origin: string | null,
  options?: HandleAIErrorOptions
): Response {
  console.error("[AI Error]", error);

  const providerName = options?.providerName ?? "AI provider";

  // Check for rate limiting
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("rate limit") || message.includes("429")) {
      return createErrorResponse(
        ErrorCode.RATE_LIMITED,
        `${providerName} rate limit exceeded. Please try again later.`,
        origin
      );
    }

    if (
      message.includes("unauthorized") ||
      message.includes("invalid api key") ||
      message.includes("401")
    ) {
      return createErrorResponse(
        ErrorCode.UNAUTHORIZED,
        `Invalid API key. Please check your ${providerName} API key.`,
        origin
      );
    }

    if (message.includes("forbidden") || message.includes("403")) {
      return createErrorResponse(
        ErrorCode.FORBIDDEN,
        `Access denied by ${providerName}. Your API key may not have access to this resource.`,
        origin
      );
    }

    // Generic AI error
    return createErrorResponse(
      ErrorCode.AI_ERROR,
      `${providerName} error: ${error.message}`,
      origin
    );
  }

  // Unknown error type
  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    "An unexpected error occurred",
    origin,
    String(error)
  );
}

/**
 * Validate required fields in request body
 */
export function validateRequestBody(
  body: unknown,
  requiredFields: string[]
): { valid: true; data: Record<string, unknown> } | { valid: false; missing: string[] } {
  if (!body || typeof body !== "object") {
    return { valid: false, missing: requiredFields };
  }

  const data = body as Record<string, unknown>;
  const missing = requiredFields.filter(
    (field) => data[field] === undefined || data[field] === null
  );

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true, data };
}
