/**
 * create_entity_from_image tool executor
 *
 * Composite operation: upload → analyze → create entity + set portrait.
 * Calls ai-image-analyze with entityId after creating the entity locally.
 */

import { buildEntity, type EntityBuildData } from "@mythos/core";
import type {
  CreateEntityFromImageArgs,
  CreateEntityFromImageResult,
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
// Helpers
// =============================================================================

/**
 * Build entity data from visual description based on type.
 */
function buildEntityDataFromAnalysis(
  entityType: EntityType,
  entityName: string,
  visualDescription: AIImageAnalyzeResponse["visualDescription"],
  description: string
): EntityBuildData {
  const baseData: EntityBuildData = {
    name: entityName,
    type: entityType,
    notes: description,
  };

  if (entityType === "character") {
    return {
      ...baseData,
      // Store visual description in properties via the visualDescription field pattern
    };
  } else if (entityType === "location") {
    return {
      ...baseData,
      climate: visualDescription.climate,
      atmosphere: visualDescription.atmosphere,
    };
  } else if (entityType === "item") {
    return {
      ...baseData,
      category: visualDescription.category as EntityBuildData["category"],
    };
  }

  return baseData;
}

// =============================================================================
// Executor
// =============================================================================

export const createEntityFromImageExecutor: ToolDefinition<CreateEntityFromImageArgs, CreateEntityFromImageResult> = {
  toolName: "create_entity_from_image",
  label: "Create Entity from Image",
  requiresConfirmation: true, // World-modifying + costly
  danger: "costly",

  renderSummary: (args) => {
    const type = args.entityType ?? "character";
    const name = args.name ?? "(auto-detect)";
    return `Create ${type} "${name}" from uploaded image`;
  },

  validate: (args) => {
    if (!args.imageData || args.imageData.trim().length === 0) {
      return { valid: false, error: "Image data is required" };
    }
    if (!args.imageData.startsWith("data:image/")) {
      return { valid: false, error: "Image must be a base64 data URL" };
    }
    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<CreateEntityFromImageResult>> => {
    try {
      // Validate project context
      if (!ctx.projectId) {
        return {
          success: false,
          error: "Project ID is required",
        };
      }

      // Validate API key
      if (!ctx.apiKey) {
        return {
          success: false,
          error: "API key is required for image analysis",
        };
      }

      // Validate entity creation capability
      if (!ctx.createEntity) {
        return {
          success: false,
          error: "Entity creation is not available in this context",
        };
      }

      ctx.onProgress?.({ pct: 5, stage: "Analyzing image..." });

      // First, analyze the image to get details (without linking to entity yet)
      const analysisRequest: AIImageAnalyzeRequest = {
        projectId: ctx.projectId,
        imageSource: args.imageData,
        entityTypeHint: args.entityType,
        extractionFocus: args.entityType === "character" ? "appearance" : "full",
      };

      const ANALYSIS_TIMEOUT_MS = 60_000;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), ANALYSIS_TIMEOUT_MS);

      let analysisResponse: AIImageAnalyzeResponse;
      try {
        analysisResponse = await callEdgeFunction<AIImageAnalyzeRequest, AIImageAnalyzeResponse>(
          "ai-image-analyze",
          analysisRequest,
          {
            apiKey: ctx.apiKey,
            signal: ctx.signal,
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

      ctx.onProgress?.({ pct: 50, stage: "Creating entity..." });

      // Determine entity details
      const entityType = args.entityType ?? analysisResponse.suggestedEntityType;
      const entityName = args.name ?? analysisResponse.suggestedName ?? `New ${entityType}`;

      // Build entity data from analysis
      const entityData = buildEntityDataFromAnalysis(
        entityType,
        entityName,
        analysisResponse.visualDescription,
        analysisResponse.description
      );

      // Build entity using the factory
      const entity = buildEntity(entityData);

      // Persist to database
      const createResult = await ctx.createEntity(entity, ctx.projectId);

      if (!createResult.data) {
        return {
          success: false,
          error: createResult.error ?? "Failed to create entity",
        };
      }

      const newEntity = createResult.data;

      ctx.onProgress?.({ pct: 70, stage: "Linking portrait..." });

      // Update entity with portrait URL from analysis if available
      if (args.setAsPortrait !== false && analysisResponse.assetId && analysisResponse.imageUrl) {
        // Update the entity with portrait info
        const updateResult = await ctx.updateEntity(newEntity.id, {
          portraitUrl: analysisResponse.imageUrl,
          portraitAssetId: analysisResponse.assetId,
        });

        if (updateResult.data) {
          ctx.addEntity(updateResult.data);
        } else {
          // Portrait linking failed but entity was created - log warning
          console.warn("Failed to link portrait to entity:", updateResult.error);
          ctx.addEntity(newEntity);
        }
      } else {
        ctx.addEntity(newEntity);
      }

      ctx.onProgress?.({ pct: 100, stage: "Complete" });

      // Build analysis result for reference
      const analysis: AnalyzeImageResult = {
        suggestedEntityType: analysisResponse.suggestedEntityType,
        suggestedName: analysisResponse.suggestedName,
        visualDescription: analysisResponse.visualDescription,
        description: analysisResponse.description,
        confidence: analysisResponse.confidence,
        assetId: analysisResponse.assetId,
        imageUrl: analysisResponse.imageUrl,
      };

      // Return result
      const result: CreateEntityFromImageResult = {
        entityId: newEntity.id,
        entityType: newEntity.type as EntityType,
        name: newEntity.name,
        assetId: analysisResponse.assetId,
        imageUrl: analysisResponse.imageUrl,
        analysis,
      };

      // Build artifacts
      const artifacts = analysisResponse.imageUrl
        ? [
            {
              kind: "image" as const,
              url: analysisResponse.imageUrl,
              previewUrl: analysisResponse.imageUrl,
              title: `Portrait for ${entityName}`,
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
      const message = error instanceof Error ? error.message : "Failed to create entity from image";
      return {
        success: false,
        error: message,
      };
    }
  },
};
