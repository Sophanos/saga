/**
 * Dynamics API Client - Calls Convex HTTP action /api/ai/dynamics
 */

import type { Interaction } from "@mythos/core";
import { ApiError, callEdgeFunction, type ApiErrorCode } from "../api-client";

export interface DynamicsRequestPayload {
  projectId: string;
  content: string;
  sceneMarker?: string;
  documentId?: string;
  knownEntities?: Array<{ id: string; name: string; type: string }>;
}

export interface DynamicsResponsePayload {
  interactions: Interaction[];
  summary: string;
  processingTimeMs: number;
}

export interface DynamicsRequestOptions {
  apiKey?: string;
  signal?: AbortSignal;
}

/** Error codes returned by the dynamics API (alias for ApiErrorCode) */
export type DynamicsApiErrorCode = ApiErrorCode;

/**
 * Dynamics-specific API error for backwards compatibility.
 * Extends the base ApiError with a domain-specific name.
 */
export class DynamicsApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    code?: DynamicsApiErrorCode
  ) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "DynamicsApiError";
  }
}

/** Internal request payload shape for the edge function */
interface DynamicsEdgeRequest {
  projectId: string;
  content: string;
  sceneMarker?: string;
  documentId?: string;
  knownEntities?: Array<{ id: string; name: string; type: string }>;
}

/** Internal response payload shape from the edge function */
interface DynamicsEdgeResponse {
  interactions?: Interaction[];
  summary?: string;
  processingTimeMs?: number;
}

export async function extractDynamicsViaEdge(
  payload: DynamicsRequestPayload,
  opts?: DynamicsRequestOptions
): Promise<DynamicsResponsePayload> {
  // Validate required fields
  if (!payload.projectId || payload.projectId.trim().length === 0) {
    throw new DynamicsApiError("projectId is required", 400, "VALIDATION_ERROR");
  }

  if (!payload.content || payload.content.trim().length === 0) {
    throw new DynamicsApiError("content must be non-empty", 400, "VALIDATION_ERROR");
  }

  if (payload.content.length < 50) {
    throw new DynamicsApiError(
      "Content is too short. Provide at least 50 characters for meaningful analysis.",
      400,
      "VALIDATION_ERROR"
    );
  }

  try {
    const result = await callEdgeFunction<DynamicsEdgeRequest, DynamicsEdgeResponse>(
      "ai/dynamics",
      {
        projectId: payload.projectId,
        content: payload.content,
        sceneMarker: payload.sceneMarker,
        documentId: payload.documentId,
        knownEntities: payload.knownEntities,
      },
      {
        signal: opts?.signal,
        apiKey: opts?.apiKey,
      }
    );

    return {
      interactions: Array.isArray(result.interactions) ? result.interactions : [],
      summary: typeof result.summary === "string" ? result.summary : "",
      processingTimeMs: typeof result.processingTimeMs === "number" ? result.processingTimeMs : 0,
    };
  } catch (error) {
    // Convert ApiError to DynamicsApiError for backwards compatibility
    if (error instanceof ApiError && !(error instanceof DynamicsApiError)) {
      throw new DynamicsApiError(error.message, error.statusCode, error.code);
    }
    throw error;
  }
}
