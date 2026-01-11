/**
 * Linter API Client - Calls Convex HTTP action /api/ai/lint
 */

import type { ConsistencyIssue } from "@mythos/ai";
import { ApiError, callEdgeFunction, type ApiErrorCode } from "../api-client";

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

/** Error codes returned by the linter API (alias for ApiErrorCode) */
export type LinterApiErrorCode = ApiErrorCode;

/**
 * Linter-specific API error for backwards compatibility.
 * Extends the base ApiError with a domain-specific name.
 */
export class LinterApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    code?: LinterApiErrorCode
  ) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "LinterApiError";
  }
}

/** Internal request payload shape for the edge function */
interface LintEdgeRequest {
  projectId: string;
  documentId: string;
  documentContent: string;
  projectConfig: { genre: string };
  rules?: string[];
}

/** Internal response payload shape from the edge function */
interface LintEdgeResponse {
  issues?: LintIssue[];
}

export async function lintDocumentViaEdge(
  payload: LintRequestPayload,
  opts?: LintRequestOptions
): Promise<LintResponsePayload> {
  // Validate required fields
  if (!payload.content || payload.content.trim().length === 0) {
    throw new LinterApiError("content must be non-empty", 400, "VALIDATION_ERROR");
  }

  if (!payload.projectId) {
    throw new LinterApiError("projectId is required", 400, "VALIDATION_ERROR");
  }

  if (!payload.documentId) {
    throw new LinterApiError("documentId is required", 400, "VALIDATION_ERROR");
  }

  try {
    const result = await callEdgeFunction<LintEdgeRequest, LintEdgeResponse>(
      "ai/lint",
      {
        projectId: payload.projectId,
        documentId: payload.documentId,
        documentContent: payload.content,
        projectConfig: { genre: payload.genre },
        rules: payload.rules,
      },
      {
        signal: opts?.signal,
        apiKey: opts?.apiKey,
      }
    );

    return { issues: Array.isArray(result.issues) ? result.issues : [] };
  } catch (error) {
    // Convert ApiError to LinterApiError for backwards compatibility
    if (error instanceof ApiError && !(error instanceof LinterApiError)) {
      throw new LinterApiError(error.message, error.statusCode, error.code);
    }
    throw error;
  }
}
