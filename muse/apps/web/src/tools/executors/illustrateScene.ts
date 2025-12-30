/**
 * illustrate_scene tool executor
 *
 * Generates a scene illustration from narrative text.
 * Uses existing character portraits for visual consistency.
 */

// Entity type used for resolving character references
import type {
  IllustrateSceneArgs,
  IllustrateSceneResult,
  SceneCharacter,
  ImageStyle,
  AspectRatio,
  SceneFocus,
} from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { resolveEntityByName } from "../types";
import { callEdgeFunction, ApiError } from "../../services/api-client";
import { API_TIMEOUTS } from "../../services/config";

// =============================================================================
// Types
// =============================================================================

interface CharacterReference {
  name: string;
  entityId: string;
  portraitUrl?: string;
}

interface AIImageSceneRequest {
  kind: "scene";
  projectId: string;
  sceneText: string;
  characterReferences?: CharacterReference[];
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
  assetType?: "scene";
  sceneFocus?: SceneFocus;
  negativePrompt?: string;
}

interface AIImageSceneResponse {
  assetId: string;
  storagePath: string;
  imageUrl: string;
  sceneDescription: string;
  charactersIncluded: SceneCharacter[];
}

// =============================================================================
// Executor
// =============================================================================

export const illustrateSceneExecutor: ToolDefinition<IllustrateSceneArgs, IllustrateSceneResult> = {
  toolName: "illustrate_scene",
  label: "Illustrate Scene",
  requiresConfirmation: true,
  danger: "costly",

  renderSummary: (args) => {
    const focus = args.sceneFocus ?? "dramatic";
    const charCount = args.characterNames?.length ?? 0;
    const charInfo = charCount > 0 ? ` with ${charCount} character(s)` : "";
    const preview = args.sceneText.slice(0, 40);
    return `${focus} scene${charInfo}: "${preview}..."`;
  },

  validate: (args) => {
    if (!args.sceneText || args.sceneText.trim().length === 0) {
      return { valid: false, error: "Scene text is required" };
    }
    if (args.sceneText.length > 3000) {
      return { valid: false, error: "Scene text must be under 3000 characters" };
    }
    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<IllustrateSceneResult>> => {
    try {
      // Validate project context
      if (!ctx.projectId) {
        return {
          success: false,
          error: "Project ID is required for scene illustration",
        };
      }

      // Validate API key
      if (!ctx.apiKey) {
        return {
          success: false,
          error: "API key is required for scene illustration",
        };
      }

      ctx.onProgress?.({ pct: 5, stage: "Resolving character references..." });

      // Resolve character names to entities with portraits
      const characterReferences: CharacterReference[] = [];

      if (args.characterNames && args.characterNames.length > 0) {
        for (const name of args.characterNames) {
          const resolution = resolveEntityByName(name, ctx.entities, "character");
          
          if (resolution.found && resolution.entity) {
            const entity = resolution.entity;
            characterReferences.push({
              name: entity.name,
              entityId: entity.id,
              portraitUrl: entity.portraitUrl,
            });
          } else if (resolution.candidates && resolution.candidates.length > 0) {
            // Use best match
            const entity = resolution.candidates[0];
            characterReferences.push({
              name: entity.name,
              entityId: entity.id,
              portraitUrl: entity.portraitUrl,
            });
          }
          // Skip if not found - will still include in prompt by name
        }
      }

      ctx.onProgress?.({ 
        pct: 15, 
        stage: `Found ${characterReferences.length} character(s) with portraits...` 
      });

      // Build request
      const request: AIImageSceneRequest = {
        kind: "scene",
        projectId: ctx.projectId,
        sceneText: args.sceneText,
        characterReferences: characterReferences.length > 0 ? characterReferences : undefined,
        style: args.style ?? "fantasy_art",
        aspectRatio: args.aspectRatio ?? "16:9",
        assetType: "scene",
        sceneFocus: args.sceneFocus ?? "dramatic",
        negativePrompt: args.negativePrompt,
      };

      ctx.onProgress?.({ pct: 25, stage: "Generating scene illustration..." });

      // Call the edge function with extended timeout for scene generation
      // Use centralized timeout config
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(
        () => timeoutController.abort(),
        API_TIMEOUTS.SCENE_ILLUSTRATION_MS
      );

      // Combine user signal with timeout signal
      const combinedSignal = ctx.signal
        ? AbortSignal.any([ctx.signal, timeoutController.signal])
        : timeoutController.signal;

      let response: AIImageSceneResponse;
      try {
        response = await callEdgeFunction<AIImageSceneRequest, AIImageSceneResponse>(
          "ai-image",
          request,
          {
            apiKey: ctx.apiKey,
            signal: combinedSignal,
            // Disable auto-retry for costly scene generation to prevent duplicate assets
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
              error: "Scene generation timed out. Please try again with a shorter scene description.",
            };
          }
          return {
            success: false,
            error: "Scene illustration was cancelled.",
          };
        }
        throw error;
      }

      ctx.onProgress?.({ pct: 100, stage: "Scene illustration complete" });

      // Build result
      const result: IllustrateSceneResult = {
        imageUrl: response.imageUrl,
        assetId: response.assetId,
        sceneDescription: response.sceneDescription,
        charactersIncluded: response.charactersIncluded,
      };

      // Build artifacts
      const charNames = response.charactersIncluded.map(c => c.name).join(", ");
      const title = charNames 
        ? `Scene with ${charNames}`
        : `Scene: ${response.sceneDescription.slice(0, 50)}...`;

      return {
        success: true,
        result,
        artifacts: [
          {
            kind: "image" as const,
            url: response.imageUrl,
            previewUrl: response.imageUrl,
            title,
            mimeType: "image/png",
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scene illustration failed";
      return {
        success: false,
        error: message,
      };
    }
  },
};
