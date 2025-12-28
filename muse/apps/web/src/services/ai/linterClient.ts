/**
 * Linter API Client - Calls Supabase edge function /functions/v1/ai-lint
 */

import type { ConsistencyIssue } from "@mythos/ai";

/** Lint issue type returned by the API */
export interface LintIssue extends ConsistencyIssue {
  id?: string;
}

export interface LintRequestPayload {
  projectId: string;
  documentId: string;
  content: string;
  genre: string;
  rules?: string[];
}

export interface LintResponsePayload {
  issues: LintIssue[];
}

export interface LintRequestOptions {
  apiKey?: string;
  signal?: AbortSignal;
}

/** Error codes returned by the linter API */
export type LinterApiErrorCode =
  | "VALIDATION_ERROR"
  | "CONFIGURATION_ERROR"
  | "ABORTED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR";

export class LinterApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: LinterApiErrorCode
  ) {
    super(message);
    this.name = "LinterApiError";
  }
}

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

export async function lintDocumentViaEdge(
  payload: LintRequestPayload,
  opts?: LintRequestOptions
): Promise<LintResponsePayload> {
  const { apiKey, signal } = opts ?? {};

  if (!payload.content || payload.content.trim().length === 0) {
    throw new LinterApiError("content must be non-empty", 400, "VALIDATION_ERROR");
  }

  if (!payload.projectId) {
    throw new LinterApiError("projectId is required", 400, "VALIDATION_ERROR");
  }

  if (!payload.documentId) {
    throw new LinterApiError("documentId is required", 400, "VALIDATION_ERROR");
  }

  if (!SUPABASE_URL) {
    throw new LinterApiError("VITE_SUPABASE_URL not configured", 500, "CONFIGURATION_ERROR");
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-lint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
      },
      body: JSON.stringify({
        projectId: payload.projectId,
        documentId: payload.documentId,
        documentContent: payload.content,
        projectConfig: { genre: payload.genre },
        rules: payload.rules,
      }),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `Lint request failed: ${response.status}`;
      let errorCode: LinterApiErrorCode = "UNKNOWN_ERROR";

      // Map status codes to error codes
      if (response.status === 401) {
        errorCode = "UNAUTHORIZED";
        errorMessage = "Invalid or missing API key";
      } else if (response.status === 404) {
        errorCode = "NOT_FOUND";
      } else if (response.status === 429) {
        errorCode = "RATE_LIMITED";
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (response.status >= 500) {
        errorCode = "SERVER_ERROR";
      }

      try {
        const errorData = await response.json();
        // Handle edge function error format: { error: { code, message } }
        if (errorData.error) {
          if (errorData.error.message) errorMessage = errorData.error.message;
          if (errorData.error.code) errorCode = errorData.error.code as LinterApiErrorCode;
        } else {
          // Fallback to flat format
          if (errorData.message) errorMessage = errorData.message;
          if (errorData.code) errorCode = errorData.code as LinterApiErrorCode;
        }
      } catch {
        // Ignore JSON parse errors
      }

      throw new LinterApiError(errorMessage, response.status, errorCode);
    }

    const result = await response.json();
    return { issues: Array.isArray(result.issues) ? result.issues : [] };
  } catch (error) {
    if (error instanceof LinterApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new LinterApiError("Request aborted", undefined, "ABORTED");
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new LinterApiError(message, undefined, "UNKNOWN_ERROR");
  }
}
