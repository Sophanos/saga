/**
 * Entity Detection API Client - Calls Supabase edge function /functions/v1/ai-detect
 */

import type {
  DetectedEntity,
  DetectionWarning,
  DetectionStats,
  DetectionOptions,
  EntityType,
} from "@mythos/core";
import { ApiError, callEdgeFunction, type ApiErrorCode } from "../api-client";

export interface DetectRequestPayload {
  text: string;
  existingEntities?: Array<{
    id: string;
    name: string;
    aliases: string[];
    type: EntityType;
  }>;
  options?: DetectionOptions;
}

export interface DetectResponsePayload {
  entities: DetectedEntity[];
  warnings: DetectionWarning[];
  stats: DetectionStats | null;
}

export interface DetectRequestOptions {
  apiKey?: string;
  signal?: AbortSignal;
}

/** Error codes returned by the detect API (alias for ApiErrorCode) */
export type DetectApiErrorCode = ApiErrorCode;

/**
 * Detect-specific API error for backwards compatibility.
 * Extends the base ApiError with a domain-specific name.
 */
export class DetectApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    code?: DetectApiErrorCode
  ) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "DetectApiError";
  }
}

/** Internal request payload shape for the edge function */
interface DetectEdgeRequest {
  text: string;
  existingEntities?: Array<{
    id: string;
    name: string;
    aliases: string[];
    type: EntityType;
  }>;
  options?: DetectionOptions;
}

/** Internal response payload shape from the edge function */
interface DetectEdgeResponse {
  entities?: DetectedEntity[];
  warnings?: DetectionWarning[];
  stats?: DetectionStats | null;
}

export async function detectEntitiesViaEdge(
  payload: DetectRequestPayload,
  opts?: DetectRequestOptions
): Promise<DetectResponsePayload> {
  // Validate required fields
  if (!payload.text || payload.text.trim().length === 0) {
    throw new DetectApiError("text must be non-empty", 400, "VALIDATION_ERROR");
  }

  try {
    const result = await callEdgeFunction<DetectEdgeRequest, DetectEdgeResponse>(
      "ai-detect",
      {
        text: payload.text,
        existingEntities: payload.existingEntities,
        options: payload.options,
      },
      {
        signal: opts?.signal,
        apiKey: opts?.apiKey,
      }
    );

    return {
      entities: Array.isArray(result.entities) ? result.entities : [],
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      stats: result.stats || null,
    };
  } catch (error) {
    // Convert ApiError to DetectApiError for backwards compatibility
    if (error instanceof ApiError && !(error instanceof DetectApiError)) {
      throw new DetectApiError(error.message, error.statusCode, error.code);
    }
    throw error;
  }
}
