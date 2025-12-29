/**
 * AI Delete Vector Edge Function
 *
 * POST /ai-delete-vector
 *
 * Deletes vectors from Qdrant by point IDs.
 * Used when documents or entities are deleted.
 *
 * Request Body:
 * {
 *   pointIds: string[]  // Array of point IDs to delete
 * }
 *
 * Response:
 * {
 *   deleted: number,
 *   processingTimeMs: number
 * }
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  ErrorCode,
} from "../_shared/errors.ts";
import {
  deletePoints,
  isQdrantConfigured,
  QdrantError,
} from "../_shared/qdrant.ts";

/**
 * Request body interface
 */
interface DeleteRequest {
  pointIds: string[];
}

/**
 * Response interface
 */
interface DeleteResponse {
  deleted: number;
  processingTimeMs: number;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.BAD_REQUEST,
      "Method not allowed. Use POST.",
      origin
    );
  }

  try {
    // Check Qdrant configuration
    if (!isQdrantConfigured()) {
      // Silently succeed if Qdrant isn't configured (graceful degradation)
      return createSuccessResponse({ deleted: 0, processingTimeMs: 0 }, origin);
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        "Invalid JSON in request body",
        origin
      );
    }

    const request = body as DeleteRequest;

    // Validate pointIds
    if (!Array.isArray(request.pointIds) || request.pointIds.length === 0) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "pointIds must be a non-empty array of strings",
        origin
      );
    }

    // Validate each ID is a string
    for (const id of request.pointIds) {
      if (typeof id !== "string" || id.trim().length === 0) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          "Each pointId must be a non-empty string",
          origin
        );
      }
    }

    // Delete from Qdrant
    await deletePoints(request.pointIds);

    const processingTimeMs = Date.now() - startTime;

    const response: DeleteResponse = {
      deleted: request.pointIds.length,
      processingTimeMs,
    };

    return createSuccessResponse(response, origin);
  } catch (error) {
    // Handle Qdrant errors
    if (error instanceof QdrantError) {
      return createErrorResponse(
        ErrorCode.AI_ERROR,
        `Vector deletion error: ${error.message}`,
        origin
      );
    }

    // Handle generic errors
    console.error("[ai-delete-vector] Error:", error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to delete vectors",
      origin
    );
  }
});
