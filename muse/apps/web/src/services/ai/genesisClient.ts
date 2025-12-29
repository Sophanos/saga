/**
 * Genesis Client
 *
 * Client for calling the ai-genesis edge function to generate
 * story world scaffolding in Architect mode.
 */

import { ApiError, callEdgeFunction, type ApiErrorCode } from "../api-client";
import type { GeneratedEntity, GenesisResult } from "@mythos/core";

// Re-export GeneratedEntity for consumers
export type { GeneratedEntity };

// ============================================================================
// Types
// ============================================================================

/** Error codes returned by the genesis API (alias for ApiErrorCode) */
export type GenesisApiErrorCode = ApiErrorCode;

/**
 * Genesis-specific API error for backwards compatibility.
 * Extends the base ApiError with a domain-specific name.
 */
export class GenesisApiError extends ApiError {
  constructor(
    message: string,
    statusCode?: number,
    code?: GenesisApiErrorCode
  ) {
    super(message, code ?? "UNKNOWN_ERROR", statusCode);
    this.name = "GenesisApiError";
  }
}

export interface GenesisRequestPayload {
  prompt: string;
  genre?: string;
  preferences?: {
    entityCount?: number;
    includeOutline?: boolean;
    detailLevel?: "minimal" | "standard" | "detailed";
  };
}

// Use GenesisResult from core as the response payload
export type GenesisResponsePayload = GenesisResult;

export interface GenesisRequestOptions {
  apiKey?: string;
  signal?: AbortSignal;
}

// ============================================================================
// Client Function
// ============================================================================

/**
 * Generate story world scaffolding via the AI genesis edge function.
 * 
 * @param payload - The genesis request containing the concept prompt
 * @param options - Optional API key and abort signal
 * @returns The generated entities, world summary, and optional outline
 * @throws GenesisApiError on failure
 */
export async function runGenesisViaEdge(
  payload: GenesisRequestPayload,
  options?: GenesisRequestOptions
): Promise<GenesisResponsePayload> {
  // Validate required fields
  if (!payload.prompt || payload.prompt.trim().length === 0) {
    throw new GenesisApiError("Prompt is required", 400, "VALIDATION_ERROR");
  }

  if (payload.prompt.length < 10) {
    throw new GenesisApiError(
      "Prompt must be at least 10 characters",
      400,
      "VALIDATION_ERROR"
    );
  }

  try {
    const result = await callEdgeFunction<GenesisRequestPayload, GenesisResponsePayload>(
      "ai-genesis",
      payload,
      {
        apiKey: options?.apiKey,
        signal: options?.signal,
      }
    );

    return result;
  } catch (error) {
    // Convert ApiError to GenesisApiError for backwards compatibility
    if (error instanceof ApiError && !(error instanceof GenesisApiError)) {
      throw new GenesisApiError(error.message, error.statusCode, error.code);
    }
    throw error;
  }
}

/**
 * Check if an error is a GenesisApiError
 */
export function isGenesisApiError(error: unknown): error is GenesisApiError {
  return error instanceof GenesisApiError;
}
