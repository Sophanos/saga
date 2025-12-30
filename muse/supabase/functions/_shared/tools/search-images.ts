/**
 * search_images tool definition
 *
 * Searches project images using CLIP text embeddings.
 * Enables text→image search for finding visually similar assets.
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import {
  entityTypeSchema,
  imageStyleSchema,
  assetTypeSchema,
  type ToolExecuteResult,
} from "./types.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const searchImagesParameters = z.object({
  /** Text query describing the visual content to find */
  query: z.string().min(1).describe("Text description of what to find (e.g., 'dark mysterious warrior', 'medieval castle at sunset')"),
  
  /** Maximum number of results */
  limit: z.number().int().min(1).max(20).optional().default(5).describe("Maximum number of images to return (1-20)"),
  
  /** Filter by asset type */
  assetType: assetTypeSchema.optional().describe("Filter to specific asset type (portrait, scene, location, etc.)"),
  
  /** Filter by entity name (resolve to entity_id) */
  entityName: z.string().optional().describe("Filter to images of a specific entity by name"),
  
  /** Filter by entity type */
  entityType: entityTypeSchema.optional().describe("Filter to images of entities of a specific type"),
  
  /** Filter by art style */
  style: imageStyleSchema.optional().describe("Filter to images of a specific art style"),
});

export type SearchImagesArgs = z.infer<typeof searchImagesParameters>;

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Search images is a read-only operation - no approval needed.
 */
async function searchImagesNeedsApproval(): Promise<boolean> {
  return false; // Read-only, no approval needed
}

export const searchImagesTool = tool({
  description: `Search project images using text descriptions (CLIP embeddings).

Use this tool when the user wants to:
- Find images matching a visual description ("dark mysterious character", "fantasy landscape")
- Search for existing art assets before generating new ones
- Find images in a specific style
- Locate portraits or scenes for reference

The search uses CLIP embeddings to match text descriptions to image content, so it understands
visual concepts beyond just keywords.

Examples:
- "Find images of armored characters" → finds all images with armor regardless of exact tags
- "Show me dark fantasy portraits" → finds stylistically dark, moody character images
- "Any castle or fortress images?" → finds location images with castle-like structures`,
  inputSchema: searchImagesParameters,
  needsApproval: searchImagesNeedsApproval,
  execute: async (args) => {
    const limit = args.limit ?? 5;
    const filters: string[] = [];
    
    if (args.assetType) {
      filters.push(`type: ${args.assetType}`);
    }
    if (args.entityName) {
      filters.push(`entity: ${args.entityName}`);
    }
    if (args.style) {
      filters.push(`style: ${args.style}`);
    }
    
    const filterDesc = filters.length > 0 ? ` (${filters.join(", ")})` : "";
    
    return {
      toolName: "search_images",
      proposal: args,
      message: `Searching for images matching "${args.query}"${filterDesc}, limit ${limit}`,
    } as ToolExecuteResult;
  },
});
