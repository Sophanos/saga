/**
 * find_similar_images tool definition
 *
 * Finds visually similar images using CLIP embeddings.
 * Enables image→image similarity search for style consistency.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import {
  entityTypeSchema,
  assetTypeSchema,
  type ToolExecuteResult,
} from "./types.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const findSimilarImagesParameters = z.object({
  /** Asset ID of the reference image */
  assetId: z.string().uuid().optional().describe("UUID of the reference image to find similar images to"),
  
  /** Entity name to use their portrait as reference */
  entityName: z.string().optional().describe("Find images similar to this entity's portrait"),
  
  /** Entity type for disambiguation when using entityName */
  entityType: entityTypeSchema.optional().describe("Entity type to help disambiguate when finding by name"),
  
  /** Maximum number of results */
  limit: z.number().int().min(1).max(20).optional().default(5).describe("Maximum number of similar images to return (1-20)"),
  
  /** Filter by asset type */
  assetType: assetTypeSchema.optional().describe("Filter results to specific asset type (portrait, scene, etc.)"),
}).refine(
  (data) => data.assetId || data.entityName,
  { message: "Either assetId or entityName must be provided" }
);

export type FindSimilarImagesArgs = z.infer<typeof findSimilarImagesParameters>;

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Find similar images is a read-only operation - no approval needed.
 */
async function findSimilarImagesNeedsApproval(): Promise<boolean> {
  return false; // Read-only, no approval needed
}

export const findSimilarImagesTool = tool({
  description: `Find images visually similar to a reference image (CLIP embeddings).

Use this tool when the user wants to:
- Find characters that look similar to another character
- Check for art style consistency across project images
- Find visually related assets for reference
- Identify duplicates or near-duplicates

The search uses CLIP embeddings to compare visual similarity, including:
- Art style (colors, lighting, technique)
- Subject matter (poses, composition)
- Visual features (faces, objects, environments)

Provide either:
- assetId: UUID of a specific image to use as reference
- entityName: Find images similar to this entity's portrait

Examples:
- "Find characters similar to Marcus" → uses Marcus's portrait as reference
- "Find images that look like this" + assetId → uses specified image as reference
- "Show me portraits with a similar art style" → uses reference and filters to portraits`,
  inputSchema: findSimilarImagesParameters,
  needsApproval: findSimilarImagesNeedsApproval,
  execute: async (args) => {
    const limit = args.limit ?? 5;
    const reference = args.assetId 
      ? `asset ${args.assetId.slice(0, 8)}...`
      : `${args.entityName}'s portrait`;
    
    const filters: string[] = [];
    if (args.assetType) {
      filters.push(`type: ${args.assetType}`);
    }
    
    const filterDesc = filters.length > 0 ? ` (${filters.join(", ")})` : "";
    
    return {
      toolName: "find_similar_images",
      proposal: args,
      message: `Finding images similar to ${reference}${filterDesc}, limit ${limit}`,
    } as ToolExecuteResult;
  },
});
