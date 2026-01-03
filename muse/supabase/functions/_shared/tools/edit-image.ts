/**
 * edit_image tool definition
 *
 * Edits an existing project asset using AI image-to-image with a reference image.
 * This tool only proposes the edit; execution happens in the ai-image edge function.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import {
  editModeSchema,
  imageStyleSchema,
  aspectRatioSchema,
  assetTypeSchema,
  type EditMode,
  type ImageStyle,
  type AspectRatio,
  type ToolExecuteResult,
} from "./types.ts";
import { STYLE_PROMPTS } from "./generate-image.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const editImageParameters = z.object({
  /** Asset ID to edit */
  assetId: z.string().uuid().describe("ID of the existing project asset to edit"),

  /** Edit instruction */
  editInstruction: z
    .string()
    .describe("What to change (e.g., 'make the hair red', 'add a dramatic sunset background')"),

  /** Edit mode */
  editMode: editModeSchema.optional().default("remix").describe(
    "Edit mode: remix (default), inpaint, outpaint, style_transfer"
  ),

  /** Optional: target style (useful for style_transfer or consistent look) */
  style: imageStyleSchema.optional().describe("Optional target style preset"),

  /** Optional: aspect ratio override (used if preserveAspectRatio is false) */
  aspectRatio: aspectRatioSchema.optional().describe("Optional target aspect ratio"),

  /** Preserve the original aspect ratio if known (default true) */
  preserveAspectRatio: z.boolean().optional().default(true).describe(
    "If true, keep the original image's aspect ratio when possible"
  ),

  /** Optional: reclassify the asset type (defaults to original asset type server-side) */
  assetType: assetTypeSchema.optional().describe("Optional output asset type classification"),

  /** If the source asset is linked to an entity, optionally set edited image as portrait */
  setAsPortrait: z.boolean().optional().default(true).describe(
    "If the asset belongs to an entity, set the edited result as that entity's portrait"
  ),

  /** Negative prompt - what to avoid */
  negativePrompt: z.string().optional().describe("What to avoid (e.g., 'text, watermarks, blurry')"),
});

export type EditImageArgs = z.infer<typeof editImageParameters>;

// =============================================================================
// Prompt Building
// =============================================================================

const EDIT_MODE_PROMPTS: Record<EditMode, string> = {
  inpaint: "modify only what the instruction requests; keep everything else as close as possible to the original",
  outpaint: "extend the image beyond the original frame; preserve the main subject; add requested surroundings naturally",
  remix: "create a faithful variation of the reference image applying the instruction while keeping identity and key details",
  style_transfer: "re-render the reference image in the requested style while preserving the subject identity and composition",
};

export function buildEditPrompt(opts: {
  editInstruction: string;
  editMode?: EditMode;
  style?: ImageStyle;
  aspectRatio?: AspectRatio;
  originalPrompt?: string;
  negativePrompt?: string;
}): string {
  const parts: string[] = [];

  parts.push("Edit the provided reference image.");
  if (opts.originalPrompt) {
    parts.push(`Original context/prompt: ${opts.originalPrompt}`);
  }

  parts.push(`Instruction: ${opts.editInstruction}`);

  const mode = opts.editMode ?? "remix";
  parts.push(EDIT_MODE_PROMPTS[mode]);

  if (opts.style) {
    parts.push(`Target style: ${STYLE_PROMPTS[opts.style]}`);
  }

  if (opts.aspectRatio) {
    parts.push(`Target aspect ratio: ${opts.aspectRatio}`);
  }

  parts.push("preserve subject identity unless explicitly requested to change it");
  parts.push("high quality, detailed");
  parts.push("no text, no watermarks, no signatures");

  if (opts.negativePrompt) {
    parts.push(`avoid: ${opts.negativePrompt}`);
  }

  return parts.join(", ");
}

// =============================================================================
// Tool Definition
// =============================================================================

async function editImageNeedsApproval(): Promise<boolean> {
  return true; // Always requires approval - costly operation
}

export const editImageTool = tool({
  description: `Edit an existing project image asset using AI.

Provide:
- assetId: which image to modify
- editInstruction: what to change (e.g., "make the hair red", "add a dramatic sunset")
- editMode: remix | inpaint | outpaint | style_transfer

This produces a NEW asset (non-destructive). The ai-image edge function will:
- fetch & download the referenced asset
- run multimodal image editing with the reference image + instruction
- store the edited result as a new project_assets row
- optionally update the linked entity portrait`,
  inputSchema: editImageParameters,
  needsApproval: editImageNeedsApproval,
  execute: async (args) => {
    const mode = args.editMode ?? "remix";
    const preview = args.editInstruction.slice(0, 60);

    return {
      toolName: "edit_image",
      proposal: args,
      message: `Editing image (${mode}): "${preview}${args.editInstruction.length > 60 ? "..." : ""}"`,
    } as ToolExecuteResult;
  },
});
