/**
 * analyze_image tool definition
 *
 * Analyzes an uploaded/reference image to extract visual details
 * for entity creation. Read-only analysis - does not create entities.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import { entityTypeSchema, type ToolExecuteResult } from "./types.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const extractionFocusSchema = z.enum(["full", "appearance", "environment", "object"]);

export const analyzeImageParameters = z.object({
  /** Base64 data URL or storage path of the image */
  imageSource: z.string().describe("Base64 data URL (data:image/...) or storage path of the image to analyze"),
  
  /** Optional entity type hint for better extraction */
  entityTypeHint: entityTypeSchema.optional().describe("Hint for what type of entity this image represents"),
  
  /** What aspect to focus extraction on */
  extractionFocus: extractionFocusSchema.optional().default("full").describe(
    "Focus area: 'full' (everything), 'appearance' (character details), 'environment' (location), 'object' (items)"
  ),
});

export type AnalyzeImageArgs = z.infer<typeof analyzeImageParameters>;

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Image analysis is read-only but costly - no approval needed per spec.
 */
async function analyzeImageNeedsApproval(): Promise<boolean> {
  return false; // Read-only analysis
}

export const analyzeImageTool = tool({
  description: `Analyze an uploaded or reference image to extract visual details.

Use this tool when:
- The author uploads a reference image
- You need to describe what's in an image
- Preparing to create an entity from visual reference

Returns:
- Suggested entity type (character, location, item, etc.)
- Structured visual description (physical traits, clothing, atmosphere)
- Natural language description
- Confidence score

This is a read-only operation - it doesn't create any entities.
Use create_entity_from_image for the full upload→analyze→create flow.`,
  inputSchema: analyzeImageParameters,
  needsApproval: analyzeImageNeedsApproval,
  execute: async (args) => {
    const focus = args.extractionFocus ?? "full";
    const typeHint = args.entityTypeHint ? ` (hint: ${args.entityTypeHint})` : "";
    
    return {
      toolName: "analyze_image",
      proposal: args,
      message: `Analyzing image with ${focus} extraction${typeHint}`,
    } as ToolExecuteResult;
  },
});
