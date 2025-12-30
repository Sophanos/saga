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
import { callEdgeFunction } from "../../services/api-client";

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
      const ANALYSIS_TIMEOUT_MS = 60_000; // 60 seconds
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), ANALYSIS_TIMEOUT_MS);

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
          }
        );
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return {
            success: false,
            error: "Image analysis timed out. Please try again.",
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
