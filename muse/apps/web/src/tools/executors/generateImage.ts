/**
 * generate_image tool executor
 *
 * Generates AI portraits and visual assets for entities.
 * Calls the ai-image edge function and updates entity portraits.
 */

import type { Entity } from "@mythos/core";
import type {
  ImageStyle,
  AspectRatio,
  AssetType,
  GenerateImageArgs,
  GenerateImageResult,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";
import { callEdgeFunction } from "../../services/api-client";

// =============================================================================
// Types
// =============================================================================

// Edge function API contract - matches ai-image/index.ts
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
  const visualDesc = props["visualDescription"] as Record<string, unknown> | undefined;

  if (visualDesc) {
    const parts: string[] = [];

    if (visualDesc["height"]) parts.push(`height: ${visualDesc["height"]}`);
    if (visualDesc["build"]) parts.push(`build: ${visualDesc["build"]}`);
    if (visualDesc["hairColor"]) parts.push(`${visualDesc["hairColor"]} hair`);
    if (visualDesc["hairStyle"]) parts.push(`${visualDesc["hairStyle"]} hairstyle`);
    if (visualDesc["eyeColor"]) parts.push(`${visualDesc["eyeColor"]} eyes`);
    if (visualDesc["skinTone"]) parts.push(`${visualDesc["skinTone"]} skin`);
    if (visualDesc["clothing"]) parts.push(`wearing ${visualDesc["clothing"]}`);
    if (Array.isArray(visualDesc["distinguishingFeatures"])) {
      parts.push(...visualDesc["distinguishingFeatures"].map(f => String(f)));
    }
    if (Array.isArray(visualDesc["accessories"])) {
      parts.push(`with ${visualDesc["accessories"].join(", ")}`);
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
        } else if (resolution.candidates && resolution.candidates.length > 1) {
          // Multiple matches - require user to specify
          return {
            success: false,
            error: `Multiple entities named "${args.entityName}" found: ${
              resolution.candidates.map(c => `${c.name} (${c.type})`).join(", ")
            }. Please specify entityId or entityType to disambiguate.`,
          };
        } else if (resolution.candidates && resolution.candidates.length === 1) {
          // Single candidate is fine
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

      // Call the edge function with timeout
      const IMAGE_GEN_TIMEOUT_MS = 90_000; // 90 seconds for client
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), IMAGE_GEN_TIMEOUT_MS);

      let response: AIImageResponse;
      try {
        response = await callEdgeFunction<AIImageRequest, AIImageResponse>(
          "ai-image",
          request,
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
            error: "Image generation timed out. Please try again.",
          };
        }
        throw error;
      }

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

      // Determine resolved entity name for artifact title
      const resolvedEntityName = args.entityName ?? entity?.name ?? args.subject.slice(0, 30);

      // Return result with artifacts
      return {
        success: true,
        result: {
          imageUrl: response.imageUrl,
          previewUrl: response.imageUrl,
          entityId: response.entityId,
          assetId: response.assetId,
          storagePath: response.storagePath,
        },
        artifacts: [
          {
            kind: "image" as const,
            url: response.imageUrl,
            previewUrl: response.imageUrl,
            title: `${request.style ?? "fantasy_art"} ${request.assetType ?? "portrait"} for ${resolvedEntityName}`,
            mimeType: "image/png", // TODO: get from response
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
