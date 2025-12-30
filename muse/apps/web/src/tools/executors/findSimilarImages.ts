/**
 * find_similar_images tool executor
 *
 * Finds visually similar images using CLIP embeddings.
 * Calls the ai-saga edge function with kind: "execute_tool".
 */

import type {
  FindSimilarImagesArgs,
  FindSimilarImagesResult,
  ImageSearchHit,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";
import { callEdgeFunction } from "../../services/api-client";

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
  result: FindSimilarImagesResult;
}

// =============================================================================
// Executor
// =============================================================================

export const findSimilarImagesExecutor: ToolDefinition<FindSimilarImagesArgs, FindSimilarImagesResult> = {
  toolName: "find_similar_images",
  label: "Find Similar Images",
  requiresConfirmation: false, // Read-only
  danger: "safe",

  renderSummary: (args) => {
    if (args.entityName) {
      return `Find images similar to ${args.entityName}'s portrait`;
    }
    if (args.assetId) {
      return `Find images similar to asset ${args.assetId.slice(0, 8)}...`;
    }
    return "Find similar images";
  },

  validate: (args) => {
    if (!args.assetId && !args.entityName) {
      return { valid: false, error: "Either assetId or entityName is required" };
    }
    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<FindSimilarImagesResult>> => {
    try {
      // Validate project context
      if (!ctx.projectId) {
        return {
          success: false,
          error: "Project ID is required for similar image search",
        };
      }

      // Validate API key
      if (!ctx.apiKey) {
        return {
          success: false,
          error: "API key is required for similar image search",
        };
      }

      ctx.onProgress?.({ pct: 10, stage: "Finding similar images..." });

      // Resolve entity name if provided
      let entityName = args.entityName;
      let resolvedAssetId = args.assetId;

      if (entityName && !resolvedAssetId) {
        const resolution = resolveEntityByName(
          entityName,
          ctx.entities,
          args.entityType
        );
        
        if (resolution.found && resolution.entity) {
          // Check if entity has a portrait
          const entity = resolution.entity;
          if (entity.portraitAssetId) {
            resolvedAssetId = entity.portraitAssetId;
          } else {
            return {
              success: false,
              error: `Entity "${entityName}" does not have a portrait. Generate one first with generate_image.`,
            };
          }
        } else if (resolution.candidates && resolution.candidates.length > 1) {
          return {
            success: false,
            error: `Multiple entities named "${entityName}" found. Please specify entityType to disambiguate.`,
          };
        } else {
          // Let the server try to resolve it
          entityName = args.entityName;
        }
      }

      // Build request
      const request: SagaExecuteToolRequest = {
        kind: "execute_tool",
        toolName: "find_similar_images",
        projectId: ctx.projectId,
        input: {
          assetId: resolvedAssetId,
          entityName: resolvedAssetId ? undefined : entityName,
          entityType: args.entityType,
          limit: args.limit ?? 5,
          assetType: args.assetType,
        },
      };

      ctx.onProgress?.({ pct: 30, stage: "Computing similarity..." });

      // Call the saga endpoint
      const response = await callEdgeFunction<SagaExecuteToolRequest, SagaExecuteToolResponse>(
        "ai-saga",
        request,
        {
          apiKey: ctx.apiKey,
          signal: ctx.signal,
        }
      );

      ctx.onProgress?.({ pct: 100, stage: "Complete" });

      const result = response.result;

      // Build artifacts from results
      const artifacts = result.results.map((hit: ImageSearchHit) => ({
        kind: "image" as const,
        url: hit.imageUrl,
        previewUrl: hit.imageUrl,
        title: `${hit.assetType ?? "image"} (similarity: ${hit.score.toFixed(2)})`,
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
      const message = error instanceof Error ? error.message : "Similar image search failed";
      return {
        success: false,
        error: message,
      };
    }
  },
};
