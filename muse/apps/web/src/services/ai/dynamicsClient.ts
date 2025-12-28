/**
 * Dynamics API Client - Calls Supabase edge function /functions/v1/ai-dynamics
 */

import type { Interaction } from "@mythos/core";

export interface DynamicsRequestPayload {
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

/** Error codes returned by the dynamics API */
export type DynamicsApiErrorCode =
  | "VALIDATION_ERROR"
  | "CONFIGURATION_ERROR"
  | "ABORTED"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SERVER_ERROR"
  | "UNKNOWN_ERROR";

export class DynamicsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: DynamicsApiErrorCode
  ) {
    super(message);
    this.name = "DynamicsApiError";
  }
}

const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

export async function extractDynamicsViaEdge(
  payload: DynamicsRequestPayload,
  opts?: DynamicsRequestOptions
): Promise<DynamicsResponsePayload> {
  const { apiKey, signal } = opts ?? {};

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

  if (!SUPABASE_URL) {
    throw new DynamicsApiError("VITE_SUPABASE_URL not configured", 500, "CONFIGURATION_ERROR");
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-dynamics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { "x-openrouter-key": apiKey }),
      },
      body: JSON.stringify({
        content: payload.content,
        sceneMarker: payload.sceneMarker,
        documentId: payload.documentId,
        knownEntities: payload.knownEntities,
      }),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `Dynamics extraction failed: ${response.status}`;
      let errorCode: DynamicsApiErrorCode = "UNKNOWN_ERROR";

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
          if (errorData.error.code) errorCode = errorData.error.code as DynamicsApiErrorCode;
        } else {
          // Fallback to flat format
          if (errorData.message) errorMessage = errorData.message;
          if (errorData.code) errorCode = errorData.code as DynamicsApiErrorCode;
        }
      } catch {
        // Ignore JSON parse errors
      }

      throw new DynamicsApiError(errorMessage, response.status, errorCode);
    }

    const result = await response.json();
    return {
      interactions: Array.isArray(result.interactions) ? result.interactions : [],
      summary: typeof result.summary === "string" ? result.summary : "",
      processingTimeMs: typeof result.processingTimeMs === "number" ? result.processingTimeMs : 0,
    };
  } catch (error) {
    if (error instanceof DynamicsApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new DynamicsApiError("Request aborted", undefined, "ABORTED");
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new DynamicsApiError(message, undefined, "UNKNOWN_ERROR");
  }
}
