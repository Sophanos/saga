/**
 * generate_image tool definition
 *
 * Generates AI portraits and visual assets for entities.
 * Uses OpenRouter SDK with multimodal image generation.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import {
  entityTypeSchema,
  imageStyleSchema,
  aspectRatioSchema,
  assetTypeSchema,
  type ToolExecuteResult,
} from "./types.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const generateImageParameters = z.object({
  /** Main subject/description of what to generate */
  subject: z.string().describe("Description of what to generate (e.g., 'Portrait of a stern warrior with silver hair')"),
  
  /** Entity name for linking the result */
  entityName: z.string().optional().describe("Name of the entity this image is for"),
  
  /** Entity type for context */
  entityType: entityTypeSchema.optional().describe("Type of entity (helps with prompt building)"),
  
  /** Entity ID if known (for direct linking) */
  entityId: z.string().uuid().optional().describe("UUID of the entity (if known)"),
  
  /** Visual description from entity data */
  visualDescription: z.string().optional().describe("Detailed visual description from entity (hair color, clothing, etc.)"),
  
  /** Art style preset */
  style: imageStyleSchema.optional().default("fantasy_art").describe("Art style for the image"),
  
  /** Image aspect ratio */
  aspectRatio: aspectRatioSchema.optional().default("3:4").describe("Aspect ratio (3:4 for portraits, 16:9 for landscapes)"),
  
  /** Asset type classification */
  assetType: assetTypeSchema.optional().default("portrait").describe("Type of asset being generated"),
  
  /** Whether to set as entity's portrait */
  setAsPortrait: z.boolean().optional().default(true).describe("Set this image as the entity's portrait"),
  
  /** Negative prompt - what to avoid */
  negativePrompt: z.string().optional().describe("What to avoid in the generation (e.g., 'text, watermarks, blurry')"),
});

export type GenerateImageArgs = z.infer<typeof generateImageParameters>;

// =============================================================================
// Style Prompt Templates
// =============================================================================

/**
 * Style-specific prompt additions for consistent generation.
 */
export const STYLE_PROMPTS: Record<z.infer<typeof imageStyleSchema>, string> = {
  // Fantasy
  fantasy_art: "epic fantasy art style, detailed, dramatic lighting, painterly",
  dark_fantasy: "dark fantasy, grimdark, gothic atmosphere, muted colors, ominous",
  high_fantasy: "high fantasy, magical, vibrant colors, ethereal lighting, Tolkien-inspired",

  // Manga/Anime
  manga: "manga style, black and white, high contrast, clean linework, screentone shading",
  anime: "anime style, vibrant colors, cel shading, expressive eyes, clean lines",
  light_novel: "light novel illustration, soft shading, pastel accents, detailed background",
  visual_novel: "visual novel character art, front-facing, clean lines, transparent background",

  // Realistic/Artistic
  realistic: "photorealistic, highly detailed, natural lighting, 8k quality",
  oil_painting: "classical oil painting, rich textures, Renaissance lighting, museum quality",
  watercolor: "watercolor painting, soft edges, flowing colors, artistic",
  concept_art: "professional concept art, game industry quality, detailed rendering",
  portrait_photo: "studio portrait photography, professional lighting, bokeh background",

  // Genre-specific
  sci_fi: "science fiction art, futuristic, cyberpunk elements, neon accents",
  horror: "horror art style, unsettling, dark shadows, eerie atmosphere",
  romance: "romantic illustration, soft lighting, warm colors, dreamy atmosphere",
  noir: "film noir style, high contrast, dramatic shadows, monochromatic",

  // Stylized
  comic_book: "comic book art, bold lines, dynamic shading, superhero style",
  pixel_art: "pixel art, retro game style, limited palette, crisp pixels",
  chibi: "chibi style, cute proportions, big head, small body, kawaii",
};

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Image generation is always a costly operation and requires approval.
 */
async function generateImageNeedsApproval(): Promise<boolean> {
  return true; // Always requires approval - costly operation
}

export const generateImageTool = tool({
  description: `Generate an AI portrait or scene for an entity.

Styles available:
- Fantasy: fantasy_art, dark_fantasy, high_fantasy
- Manga/Anime: manga (B&W), anime, light_novel, visual_novel
- Realistic: realistic, oil_painting, watercolor, concept_art, portrait_photo
- Genre: sci_fi, horror, romance, noir
- Stylized: comic_book, pixel_art, chibi

Aspect ratios: 1:1 (square), 3:4 (portrait card), 4:3 (landscape), 9:16 (tall), 16:9 (wide), 2:3 (book cover)

When generating for an entity, use their visualDescription if available to ensure consistency.
Always avoid text/watermarks in generated images.`,
  inputSchema: generateImageParameters,
  needsApproval: generateImageNeedsApproval,
  execute: async (args) => {
    const style = args.style ?? "fantasy_art";
    const aspectRatio = args.aspectRatio ?? "3:4";
    const entityDisplay = args.entityName ?? args.subject.slice(0, 30);
    
    return {
      toolName: "generate_image",
      proposal: args,
      message: `Generating ${style} image (${aspectRatio}) for ${entityDisplay}`,
    } as ToolExecuteResult;
  },
});

/**
 * Build a complete image generation prompt from args.
 * Used by the ai-image edge function.
 */
export function buildImagePrompt(args: GenerateImageArgs): string {
  const parts: string[] = [];
  
  // Start with the main subject
  parts.push(args.subject);
  
  // Add visual description if provided
  if (args.visualDescription) {
    parts.push(args.visualDescription);
  }
  
  // Add style-specific prompt
  const style = args.style ?? "fantasy_art";
  parts.push(STYLE_PROMPTS[style]);
  
  // Add aspect ratio guidance
  const aspectRatio = args.aspectRatio ?? "3:4";
  if (aspectRatio === "3:4" || aspectRatio === "2:3" || aspectRatio === "9:16") {
    parts.push("portrait orientation");
  } else if (aspectRatio === "16:9" || aspectRatio === "4:3" || aspectRatio === "3:2") {
    parts.push("landscape orientation");
  }
  
  // Always add quality and safety guidance
  parts.push("high quality, detailed");
  parts.push("no text, no watermarks, no signatures");
  
  // Add negative prompt guidance if provided
  if (args.negativePrompt) {
    parts.push(`avoid: ${args.negativePrompt}`);
  }
  
  return parts.join(", ");
}
