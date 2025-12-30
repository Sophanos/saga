/**
 * analyze_image tool executor
 *
 * Analyzes an uploaded/reference image to extract visual details.
 * Calls the ai-image-analyze edge function.
 */

import type {
  AnalyzeImageArgs,
  AnalyzeImageResult,
  EntityType,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { callEdgeFunction, ApiError } from "../../services/api-client";
import { API_TIMEOUTS } from "../../services/config";

// =============================================================================
// Constants
// =============================================================================

/** Maximum base64 image size in bytes (10MB - matches server limit) */
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

// =============================================================================
// Types
// =============================================================================

interface AIImageAnalyzeRequest {
  projectId: string;
  imageSource: string;
  entityTypeHint?: EntityType;
  extractionFocus?: "full" | "appearance" | "environment" | "object";
  entityId?: string;
  setAsPortrait?: boolean;
}

interface AIImageAnalyzeResponse {
  suggestedEntityType: EntityType;
  suggestedName?: string;
  visualDescription: {
    height?: string;
    build?: string;
    hairColor?: string;
    hairStyle?: string;
    eyeColor?: string;
    skinTone?: string;
    distinguishingFeatures?: string[];
    clothing?: string;
    accessories?: string[];
    climate?: string;
    atmosphere?: string;
    category?: string;
    material?: string;
    artStyle?: string;
    mood?: string;
  };
  description: string;
  confidence: number;
  assetId?: string;
  imageUrl?: string;
}

// =============================================================================
// Executor
// =============================================================================

export const analyzeImageExecutor: ToolDefinition<AnalyzeImageArgs, AnalyzeImageResult> = {
  toolName: "analyze_image",
  label: "Analyze Image",
  requiresConfirmation: false, // Read-only operation
  danger: "safe",

  renderSummary: (args) => {
    const focus = args.extractionFocus ?? "full";
    const hint = args.entityTypeHint ? ` (${args.entityTypeHint})` : "";
    return `Analyzing image with ${focus} extraction${hint}`;
  },

  validate: (args) => {
    if (!args.imageSource || args.imageSource.trim().length === 0) {
      return { valid: false, error: "Image source is required" };
    }

    // Client-side size validation for base64 data URLs
    if (args.imageSource.startsWith("data:image/")) {
      // Estimate actual bytes from base64 (roughly 3/4 of base64 length)
      const base64Part = args.imageSource.split(",")[1];
      if (base64Part) {
        const estimatedBytes = Math.ceil(base64Part.length * 0.75);
        if (estimatedBytes > MAX_IMAGE_SIZE_BYTES) {
          const sizeMB = (estimatedBytes / (1024 * 1024)).toFixed(1);
          return {
            valid: false,
            error: `Image is too large (${sizeMB}MB). Maximum size is 10MB.`,
          };
        }
      }
    }

    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<AnalyzeImageResult>> => {
    try {
      // Validate project context
      if (!ctx.projectId) {
        return {
          success: false,
          error: "Project ID is required for image analysis",
        };
      }

      // Validate API key
      if (!ctx.apiKey) {
        return {
          success: false,
          error: "API key is required for image analysis",
        };
      }

      ctx.onProgress?.({ pct: 5, stage: "Preparing image analysis..." });

      // Build request
      const request: AIImageAnalyzeRequest = {
        projectId: ctx.projectId,
        imageSource: args.imageSource,
        entityTypeHint: args.entityTypeHint,
        extractionFocus: args.extractionFocus ?? "full",
      };

      ctx.onProgress?.({ pct: 20, stage: "Analyzing image with AI..." });

      // Call the edge function with combined timeout
      // Use centralized timeout config
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(
        () => timeoutController.abort(),
        API_TIMEOUTS.IMAGE_ANALYSIS_MS
      );

      // Combine user signal with timeout signal
      const combinedSignal = ctx.signal
        ? AbortSignal.any([ctx.signal, timeoutController.signal])
        : timeoutController.signal;

      let response: AIImageAnalyzeResponse;
      try {
        response = await callEdgeFunction<AIImageAnalyzeRequest, AIImageAnalyzeResponse>(
          "ai-image-analyze",
          request,
          {
            apiKey: ctx.apiKey,
            signal: combinedSignal,
            // Analysis is read-only and not as costly as generation,
            // but still disable retry to avoid redundant AI calls
            retry: false,
          }
        );
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        // Handle abort/timeout - callEdgeFunction wraps AbortError as ApiError(code="ABORTED")
        if (error instanceof ApiError && error.code === "ABORTED") {
          // Check if it was a timeout vs user cancellation
          if (timeoutController.signal.aborted) {
            return {
              success: false,
              error: "Image analysis timed out. Please try again.",
            };
          }
          return {
            success: false,
            error: "Image analysis was cancelled.",
          };
        }
        throw error;
      }

      ctx.onProgress?.({ pct: 100, stage: "Analysis complete" });

      // Build result
      const result: AnalyzeImageResult = {
        suggestedEntityType: response.suggestedEntityType,
        suggestedName: response.suggestedName,
        visualDescription: response.visualDescription,
        description: response.description,
        confidence: response.confidence,
        assetId: response.assetId,
        imageUrl: response.imageUrl,
      };

      // Return with image artifact if available
      const artifacts = response.imageUrl
        ? [
            {
              kind: "image" as const,
              url: response.imageUrl,
              previewUrl: response.imageUrl,
              title: `Analyzed: ${response.suggestedEntityType}${response.suggestedName ? ` "${response.suggestedName}"` : ""}`,
              mimeType: "image/png",
            },
          ]
        : [];

      return {
        success: true,
        result,
        artifacts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image analysis failed";
      return {
        success: false,
        error: message,
      };
    }
  },
};
