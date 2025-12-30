/**
 * generate_image tool executor
 *
 * Generates AI portraits and visual assets for entities.
 * Calls the ai-image edge function and updates entity portraits.
 */

import type { EntityType, Entity } from "@mythos/core";
import type {
  ImageStyle,
  AspectRatio,
  AssetType,
  GenerateImageArgs as ProtocolGenerateImageArgs,
  GenerateImageResult,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult, ToolExecutionContext } from "../types";
import { resolveEntityByName } from "../types";
import { callEdgeFunction } from "../../services/api-client";

// =============================================================================
// Types
// =============================================================================

export interface GenerateImageArgs {
  /** Main subject description */
  subject: string;
  /** Entity name for linking the result */
  entityName?: string;
  /** Entity type for context */
  entityType?: EntityType;
  /** Entity ID if known (for direct linking) */
  entityId?: string;
  /** Visual description from entity data */
  visualDescription?: string;
  /** Art style preset */
  style?: ImageStyle;
  /** Image aspect ratio */
  aspectRatio?: AspectRatio;
  /** Asset type classification */
  assetType?: AssetType;
  /** Whether to set as entity portrait */
  setAsPortrait?: boolean;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
}

interface AIImageRequest {
  projectId: string;
  entityId?: string;
  assetType?: AssetType;
  subject: string;
  entityName?: string;
  visualDescription?: string;
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
  setAsPortrait?: boolean;
  negativePrompt?: string;
}

interface AIImageResponse {
  assetId: string;
  storagePath: string;
  imageUrl: string;
  entityId?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get visual description from an entity if available.
 */
function getEntityVisualDescription(entity: Entity): string | undefined {
  // Check for character visual description
  const props = entity.properties as Record<string, unknown>;
  const visualDesc = props.visualDescription as Record<string, unknown> | undefined;
  
  if (visualDesc) {
    const parts: string[] = [];
    
    if (visualDesc.height) parts.push(`height: ${visualDesc.height}`);
    if (visualDesc.build) parts.push(`build: ${visualDesc.build}`);
    if (visualDesc.hairColor) parts.push(`${visualDesc.hairColor} hair`);
    if (visualDesc.hairStyle) parts.push(`${visualDesc.hairStyle} hairstyle`);
    if (visualDesc.eyeColor) parts.push(`${visualDesc.eyeColor} eyes`);
    if (visualDesc.skinTone) parts.push(`${visualDesc.skinTone} skin`);
    if (visualDesc.clothing) parts.push(`wearing ${visualDesc.clothing}`);
    if (Array.isArray(visualDesc.distinguishingFeatures)) {
      parts.push(...visualDesc.distinguishingFeatures.map(f => String(f)));
    }
    if (Array.isArray(visualDesc.accessories)) {
      parts.push(`with ${visualDesc.accessories.join(", ")}`);
    }
    
    if (parts.length > 0) {
      return parts.join(", ");
    }
  }
  
  // Fallback to notes or general description
  if (entity.notes) {
    return entity.notes;
  }
  
  return undefined;
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
    const style = args.style ?? "fantasy_art";
    const target = args.entityName ?? args.subject.slice(0, 30);
    return `${style} image for "${target}"`;
  },

  validate: (args) => {
    if (!args.subject || args.subject.trim().length === 0) {
      return { valid: false, error: "Subject description is required" };
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

      // Report initial progress
      ctx.onProgress?.({ pct: 5, stage: "Preparing image generation..." });

      // Resolve entity if name provided but no ID
      let entityId = args.entityId;
      let entity: Entity | undefined;
      let visualDescription = args.visualDescription;

      if (!entityId && args.entityName) {
        const resolution = resolveEntityByName(
          args.entityName,
          ctx.entities,
          args.entityType
        );

        if (resolution.found && resolution.entity) {
          entityId = resolution.entity.id;
          entity = resolution.entity;
        } else if (resolution.candidates && resolution.candidates.length > 0) {
          // Ambiguous - pick the first match of the specified type or just the first
          entity = resolution.candidates[0];
          entityId = entity.id;
        }
        // If not found, continue without entity linking
      } else if (entityId) {
        entity = ctx.entities.get(entityId);
      }

      // Get visual description from entity if not provided
      if (!visualDescription && entity) {
        visualDescription = getEntityVisualDescription(entity);
      }

      ctx.onProgress?.({ pct: 15, stage: "Generating image with AI..." });

      // Build request
      const request: AIImageRequest = {
        projectId: ctx.projectId,
        entityId,
        assetType: args.assetType ?? (entityId ? "portrait" : "other"),
        subject: args.subject,
        entityName: args.entityName ?? entity?.name,
        visualDescription,
        style: args.style ?? "fantasy_art",
        aspectRatio: args.aspectRatio ?? "3:4",
        setAsPortrait: args.setAsPortrait !== false,
        negativePrompt: args.negativePrompt,
      };

      // Call the edge function
      const response = await callEdgeFunction<AIImageRequest, AIImageResponse>(
        "ai-image",
        request,
        {
          apiKey: ctx.apiKey,
          signal: ctx.signal,
        }
      );

      ctx.onProgress?.({ pct: 90, stage: "Updating entity..." });

      // Update entity in store if portrait was set
      if (response.entityId && entity && request.setAsPortrait) {
        const updatedEntity: Entity = {
          ...entity,
          portraitUrl: response.imageUrl,
          portraitAssetId: response.assetId,
        };
        ctx.addEntity(updatedEntity);
      }

      ctx.onProgress?.({ pct: 100, stage: "Complete" });

      // Return result with artifacts
      return {
        success: true,
        result: {
          imageUrl: response.imageUrl,
          previewUrl: response.imageUrl,
          entityId: response.entityId,
        },
        artifacts: [
          {
            kind: "image",
            title: args.entityName ?? args.subject.slice(0, 50),
            url: response.imageUrl,
            previewUrl: response.imageUrl,
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
