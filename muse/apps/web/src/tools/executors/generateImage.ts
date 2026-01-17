/**
 * generate_image tool executor
 *
 * Generates AI images via the ai/image edge function.
 * Simplified: agent builds full prompt, we pass through.
 */

import type {
  AspectRatio,
  GenerateImageArgs,
  GenerateImageResult,
  ImageTier,
  AssetType,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { callEdgeFunction, ApiError } from "../../services/api-client";
import { API_TIMEOUTS } from "../../services/config";

// =============================================================================
// Types
// =============================================================================

// Edge function API contract
interface AIImageRequest {
  projectId: string;
  prompt: string;
  aspectRatio?: AspectRatio;
  negativePrompt?: string;
  tier?: ImageTier;
  entityId?: string;
  assetType?: AssetType;
}

interface AIImageResponse {
  assetId: string;
  storagePath: string;
  imageUrl: string;
  entityId?: string;
  cached?: boolean;
}

// =============================================================================
// Executor
// =============================================================================

export const generateImageExecutor: ToolDefinition<GenerateImageArgs, GenerateImageResult> = {
  toolName: "generate_image",
  label: "Generate Image",
  requiresConfirmation: true,
  danger: "costly",

  renderSummary: (args) => {
    const tier = args.tier ?? "standard";
    const preview = args.prompt.slice(0, 40);
    return `${tier} image: "${preview}..."`;
  },

  validate: (args) => {
    if (!args.prompt || args.prompt.trim().length === 0) {
      return { valid: false, error: "Prompt is required" };
    }
    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<GenerateImageResult>> => {
    try {
      // Validate project context
      if (!ctx.projectId) {
        return {
          success: false,
          error: "Project ID is required for image generation",
        };
      }

      // Validate API key
      if (!ctx.apiKey) {
        return {
          success: false,
          error: "API key is required for image generation",
        };
      }

      ctx.onProgress?.({ pct: 10, stage: "Generating image..." });

      // Build request - pass through simplified args
      const request: AIImageRequest = {
        projectId: ctx.projectId,
        prompt: args.prompt,
        aspectRatio: args.aspectRatio ?? "1:1",
        negativePrompt: args.negativePrompt,
        tier: args.tier ?? "standard",
        entityId: args.entityId,
        assetType: args.assetType ?? "other",
      };

      // Call the edge function with timeout
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(
        () => timeoutController.abort(),
        API_TIMEOUTS.IMAGE_GENERATION_MS
      );

      const combinedSignal = ctx.signal
        ? AbortSignal.any([ctx.signal, timeoutController.signal])
        : timeoutController.signal;

      let response: AIImageResponse;
      try {
        response = await callEdgeFunction<AIImageRequest, AIImageResponse>(
          "ai/image",
          request,
          {
            apiKey: ctx.apiKey,
            signal: combinedSignal,
            retry: false, // Don't retry costly image generation
          }
        );
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof ApiError && error.code === "ABORTED") {
          if (timeoutController.signal.aborted) {
            return {
              success: false,
              error: "Image generation timed out. Please try again.",
            };
          }
          return {
            success: false,
            error: "Image generation was cancelled.",
          };
        }
        throw error;
      }

      ctx.onProgress?.({ pct: 100, stage: "Complete" });

      // Build artifact title
      const tierLabel = args.tier ?? "standard";
      const promptPreview = args.prompt.slice(0, 30);
      const artifactTitle = response.cached
        ? `[Cached] ${tierLabel} image: ${promptPreview}...`
        : `${tierLabel} image: ${promptPreview}...`;

      return {
        success: true,
        result: {
          imageUrl: response.imageUrl,
          previewUrl: response.imageUrl,
          entityId: response.entityId,
          assetId: response.assetId,
          storagePath: response.storagePath,
          cached: response.cached,
        },
        artifacts: [
          {
            kind: "image" as const,
            url: response.imageUrl,
            previewUrl: response.imageUrl,
            title: artifactTitle,
            mimeType: "image/png",
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image generation failed";
      return {
        success: false,
        error: message,
      };
    }
  },
};
