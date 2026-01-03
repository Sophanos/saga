/**
 * create_entity_from_image tool definition
 *
 * Composite operation: upload → analyze → create entity + set portrait.
 * This is a world-modifying operation that requires approval.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import { entityTypeSchema, type ToolExecuteResult } from "./types.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const createEntityFromImageParameters = z.object({
  /** Base64 encoded image data (data URL format) */
  imageData: z.string().describe("Base64 encoded image as data URL (data:image/png;base64,...)"),
  
  /** Optional name for the entity */
  name: z.string().optional().describe("Name for the new entity (will suggest one if not provided)"),
  
  /** Optional entity type (defaults to character) */
  entityType: entityTypeSchema.optional().describe("Type of entity to create (default: character)"),
  
  /** Whether to set the image as entity portrait (default true) */
  setAsPortrait: z.boolean().optional().default(true).describe("Set this image as the entity's portrait"),
});

export type CreateEntityFromImageArgs = z.infer<typeof createEntityFromImageParameters>;

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Creating entities from images always requires approval - world-modifying + costly.
 */
async function createEntityFromImageNeedsApproval(): Promise<boolean> {
  return true;
}

export const createEntityFromImageTool = tool({
  description: `Create a new entity from an uploaded reference image.

This is a composite operation that:
1. Uploads and stores the image
2. Analyzes the image to extract visual details
3. Creates a new entity with the extracted information
4. Sets the image as the entity's portrait (if requested)

Use this tool when:
- The author uploads an image and says "create a character from this"
- Converting reference images into world entities
- Quick character creation from visual references

The author will see a preview of the detected details and can modify before accepting.`,
  inputSchema: createEntityFromImageParameters,
  needsApproval: createEntityFromImageNeedsApproval,
  execute: async (args) => {
    const entityType = args.entityType ?? "character";
    const nameDisplay = args.name ?? "(will suggest from analysis)";
    
    return {
      toolName: "create_entity_from_image",
      proposal: args,
      message: `Creating ${entityType} "${nameDisplay}" from uploaded image`,
    } as ToolExecuteResult;
  },
});
