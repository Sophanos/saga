/**
 * search_images tool executor
 *
 * Searches project images using CLIP text embeddings.
 * Calls the ai-saga edge function with kind: "execute_tool".
 */

import type {
  SearchImagesArgs,
  SearchImagesResult,
  ImageSearchHit,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";
import { callEdgeFunction, ApiError } from "../../services/api-client";
import { API_TIMEOUTS } from "../../services/config";

// =============================================================================
// Types
// =============================================================================

interface SagaExecuteToolRequest {
  kind: "execute_tool";
  toolName: string;
  input: unknown;
  projectId: string;
}

interface SagaExecuteToolResponse {
  toolName: string;
  result: SearchImagesResult;
}

// =============================================================================
// Executor
// =============================================================================

export const searchImagesExecutor: ToolDefinition<SearchImagesArgs, SearchImagesResult> = {
  toolName: "search_images",
  label: "Search Images",
  requiresConfirmation: false, // Read-only
  danger: "safe",

  renderSummary: (args) => {
    const filters: string[] = [];
    if (args.assetType) filters.push(args.assetType);
    if (args.style) filters.push(args.style);
    if (args.entityName) filters.push(`entity: ${args.entityName}`);
    
    const filterStr = filters.length > 0 ? ` (${filters.join(", ")})` : "";
    return `Search: "${args.query}"${filterStr}`;
  },

  validate: (args) => {
    if (!args.query || args.query.trim().length === 0) {
      return { valid: false, error: "Search query is required" };
    }
    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<SearchImagesResult>> => {
    try {
      // Validate project context
      if (!ctx.projectId) {
        return {
          success: false,
          error: "Project ID is required for image search",
        };
      }

      // Validate API key
      if (!ctx.apiKey) {
        return {
          success: false,
          error: "API key is required for image search",
        };
      }

      ctx.onProgress?.({ pct: 10, stage: "Searching images..." });

      // Resolve entity name to filter if provided
      let entityName = args.entityName;
      if (entityName) {
        const resolution = resolveEntityByName(
          entityName,
          ctx.entities,
          args.entityType
        );
        if (resolution.found && resolution.entity) {
          // Use the resolved entity name for better matching
          entityName = resolution.entity.name;
        }
      }

      // Build request
      const request: SagaExecuteToolRequest = {
        kind: "execute_tool",
        toolName: "search_images",
        projectId: ctx.projectId,
        input: {
          query: args.query,
          limit: args.limit ?? 5,
          assetType: args.assetType,
          entityName,
          entityType: args.entityType,
          style: args.style,
        },
      };

      ctx.onProgress?.({ pct: 30, stage: "Generating embeddings..." });

      // Set up timeout handling
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(
        () => timeoutController.abort(),
        API_TIMEOUTS.IMAGE_SEARCH_MS
      );

      // Combine user signal with timeout signal
      const combinedSignal = ctx.signal
        ? AbortSignal.any([ctx.signal, timeoutController.signal])
        : timeoutController.signal;

      // Call the saga endpoint
      let response: SagaExecuteToolResponse;
      try {
        response = await callEdgeFunction<SagaExecuteToolRequest, SagaExecuteToolResponse>(
          "ai/saga",
          request,
          {
            apiKey: ctx.apiKey,
            signal: combinedSignal,
          }
        );
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        // Handle abort/timeout
        if (error instanceof ApiError && error.code === "ABORTED") {
          if (timeoutController.signal.aborted) {
            return {
              success: false,
              error: "Image search timed out. Please try again.",
            };
          }
          return {
            success: false,
            error: "Image search was cancelled.",
          };
        }
        throw error;
      }

      ctx.onProgress?.({ pct: 100, stage: "Complete" });

      const result = response.result;

      // Build artifacts from results
      const artifacts = result.results.map((hit: ImageSearchHit) => ({
        kind: "image" as const,
        url: hit.imageUrl,
        previewUrl: hit.imageUrl,
        title: `${hit.assetType ?? "image"} (score: ${hit.score.toFixed(2)})`,
        mimeType: "image/png",
        data: {
          assetId: hit.assetId,
          entityId: hit.entityId,
          entityType: hit.entityType,
          score: hit.score,
        },
      }));

      return {
        success: true,
        result,
        artifacts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image search failed";
      return {
        success: false,
        error: message,
      };
    }
  },
};
