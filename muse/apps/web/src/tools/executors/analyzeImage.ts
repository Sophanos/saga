/**
 * analyze_image tool executor
 *
 * Unified image tool supporting three modes:
 * - vision: Extract visual details from an image via LLM
 * - search: Text → image search via Qdrant
 * - similar: Image → image similarity search via Qdrant
 */

import type {
  AnalyzeImageArgs,
  AnalyzeImageResult,
  AnalyzeImageMode,
  EntityType,
  ImageSearchHit,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { callEdgeFunction, ApiError } from "../../services/api-client";
import { API_TIMEOUTS } from "../../services/config";
import {
  validateBase64ImageSize,
  validateImageToolContext,
} from "./_shared/image-utils";

// =============================================================================
// Types
// =============================================================================

interface AIImageAnalyzeRequest {
  projectId: string;
  mode: AnalyzeImageMode;
  // Vision mode
  imageSource?: string;
  entityTypeHint?: EntityType;
  extractionFocus?: "full" | "appearance" | "environment" | "object";
  analysisPrompt?: string;
  // Search mode
  query?: string;
  // Similar mode
  assetId?: string;
  entityName?: string;
  // Shared options
  options?: {
    limit?: number;
    assetType?: string;
    entityType?: string;
    style?: string;
  };
}

interface AIImageAnalyzeVisionResponse {
  mode: "vision";
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

interface AIImageAnalyzeSearchResponse {
  mode: "search";
  query: string;
  results: ImageSearchHit[];
}

interface AIImageAnalyzeSimilarResponse {
  mode: "similar";
  referenceAssetId: string;
  results: ImageSearchHit[];
}

type AIImageAnalyzeResponse =
  | AIImageAnalyzeVisionResponse
  | AIImageAnalyzeSearchResponse
  | AIImageAnalyzeSimilarResponse;

// =============================================================================
// Executor
// =============================================================================

export const analyzeImageExecutor: ToolDefinition<AnalyzeImageArgs, AnalyzeImageResult> = {
  toolName: "analyze_image",
  label: "Analyze Image",
  requiresConfirmation: false, // Read-only operation
  danger: "safe",

  renderSummary: (args) => {
    const mode = args.mode ?? "vision";
    switch (mode) {
      case "vision": {
        const focus = args.extractionFocus ?? "full";
        const hint = args.entityTypeHint ? ` (${args.entityTypeHint})` : "";
        return `Analyzing image with ${focus} extraction${hint}`;
      }
      case "search":
        return `Searching images: "${args.query?.slice(0, 30)}${(args.query?.length ?? 0) > 30 ? "..." : ""}"`;
      case "similar":
        return `Finding similar images${args.entityName ? ` to ${args.entityName}` : ""}`;
      default:
        return "Analyzing image";
    }
  },

  validate: (args) => {
    const mode = args.mode ?? "vision";

    switch (mode) {
      case "vision":
        if (!args.imageSource || args.imageSource.trim().length === 0) {
          return { valid: false, error: "Image source is required for vision mode" };
        }
        // Client-side size validation for base64 data URLs
        return validateBase64ImageSize(args.imageSource);

      case "search":
        if (!args.query || args.query.trim().length === 0) {
          return { valid: false, error: "Query is required for search mode" };
        }
        return { valid: true };

      case "similar":
        if (!args.assetId && !args.entityName) {
          return { valid: false, error: "Asset ID or entity name is required for similar mode" };
        }
        return { valid: true };

      default:
        return { valid: false, error: `Unknown mode: ${mode}` };
    }
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<AnalyzeImageResult>> => {
    try {
      // Validate project context and API key
      const ctxValidation = validateImageToolContext(ctx, "image analysis");
      if (!ctxValidation.valid) {
        return { success: false, error: ctxValidation.error };
      }

      const mode = args.mode ?? "vision";
      ctx.onProgress?.({ pct: 5, stage: `Starting ${mode} analysis...` });

      // Build unified request
      const request: AIImageAnalyzeRequest = {
        projectId: ctx.projectId,
        mode,
        // Vision mode fields
        imageSource: args.imageSource,
        entityTypeHint: args.entityTypeHint,
        extractionFocus: args.extractionFocus ?? "full",
        analysisPrompt: args.analysisPrompt,
        // Search mode fields
        query: args.query,
        // Similar mode fields
        assetId: args.assetId,
        entityName: args.entityName,
        // Shared options
        options: args.options,
      };

      ctx.onProgress?.({ pct: 20, stage: getProgressMessage(mode) });

      // Call the unified edge function with timeout
      const timeoutMs = mode === "vision" ? API_TIMEOUTS.IMAGE_ANALYSIS_MS : API_TIMEOUTS.DEFAULT_MS;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

      const combinedSignal = ctx.signal
        ? AbortSignal.any([ctx.signal, timeoutController.signal])
        : timeoutController.signal;

      let response: AIImageAnalyzeResponse;
      try {
        response = await callEdgeFunction<AIImageAnalyzeRequest, AIImageAnalyzeResponse>(
          "ai/image-analyze",
          request,
          {
            apiKey: ctx.apiKey,
            signal: combinedSignal,
            retry: false,
          }
        );
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof ApiError && error.code === "ABORTED") {
          if (timeoutController.signal.aborted) {
            return { success: false, error: "Image analysis timed out. Please try again." };
          }
          return { success: false, error: "Image analysis was cancelled." };
        }
        throw error;
      }

      ctx.onProgress?.({ pct: 100, stage: "Complete" });

      // Build result and artifacts based on mode
      return buildResultForMode(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image analysis failed";
      return { success: false, error: message };
    }
  },
};

// =============================================================================
// Helpers
// =============================================================================

function getProgressMessage(mode: AnalyzeImageMode): string {
  switch (mode) {
    case "vision":
      return "Analyzing image with AI...";
    case "search":
      return "Searching image library...";
    case "similar":
      return "Finding similar images...";
  }
}

function buildResultForMode(
  response: AIImageAnalyzeResponse
): ToolExecutionResult<AnalyzeImageResult> {
  switch (response.mode) {
    case "vision": {
      const result: AnalyzeImageResult = {
        mode: "vision",
        suggestedEntityType: response.suggestedEntityType,
        suggestedName: response.suggestedName,
        visualDescription: response.visualDescription,
        description: response.description,
        confidence: response.confidence,
        assetId: response.assetId,
        imageUrl: response.imageUrl,
      };

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

      return { success: true, result, artifacts };
    }

    case "search": {
      const result: AnalyzeImageResult = {
        mode: "search",
        query: response.query,
        results: response.results,
      };

      // Create image artifacts for search results
      const artifacts = response.results.slice(0, 4).map((hit) => ({
        kind: "image" as const,
        url: hit.imageUrl,
        previewUrl: hit.imageUrl,
        title: `Match (${Math.round(hit.score * 100)}%)`,
        mimeType: "image/png",
      }));

      return { success: true, result, artifacts };
    }

    case "similar": {
      const result: AnalyzeImageResult = {
        mode: "similar",
        referenceAssetId: response.referenceAssetId,
        results: response.results,
      };

      // Create image artifacts for similar results
      const artifacts = response.results.slice(0, 4).map((hit) => ({
        kind: "image" as const,
        url: hit.imageUrl,
        previewUrl: hit.imageUrl,
        title: `Similar (${Math.round(hit.score * 100)}%)`,
        mimeType: "image/png",
      }));

      return { success: true, result, artifacts };
    }
  }
}
