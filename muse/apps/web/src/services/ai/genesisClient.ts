/**
 * Genesis Client
 * 
 * Client for calling the ai-genesis edge function to generate
 * story world scaffolding in Architect mode.
 */

import { callEdgeFunction, type ApiErrorCode } from "../api-client";

// ============================================================================
// Types
// ============================================================================

export type GenesisApiErrorCode = ApiErrorCode | "GENESIS_FAILED";

export class GenesisApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code: GenesisApiErrorCode = "UNKNOWN_ERROR"
  ) {
    super(message);
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

export interface GeneratedEntity {
  name: string;
  type: "character" | "location" | "item" | "faction" | "magic_system";
  description: string;
  properties?: Record<string, string | number | boolean>;
  relationships?: Array<{
    targetName: string;
    type: string;
    description?: string;
  }>;
}

export interface GenesisResponsePayload {
  entities: GeneratedEntity[];
  worldSummary: string;
  suggestedTitle?: string;
  outline?: Array<{
    title: string;
    summary: string;
  }>;
}

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
    if (error instanceof Error) {
      throw new GenesisApiError(
        error.message,
        undefined,
        "GENESIS_FAILED"
      );
    }
    throw new GenesisApiError(
      "Failed to generate world",
      undefined,
      "GENESIS_FAILED"
    );
  }
}

/**
 * Check if an error is a GenesisApiError
 */
export function isGenesisApiError(error: unknown): error is GenesisApiError {
  return error instanceof GenesisApiError;
}
