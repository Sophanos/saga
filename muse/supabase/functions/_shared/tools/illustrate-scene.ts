/**
 * illustrate_scene tool definition
 *
 * Generates a scene illustration from narrative text,
 * optionally using existing character portraits for consistency.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import { imageStyleSchema, aspectRatioSchema, type ToolExecuteResult } from "./types.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const sceneFocusSchema = z.enum(["action", "dialogue", "establishing", "dramatic"]);

export const illustrateSceneParameters = z.object({
  /** The narrative text describing the scene */
  sceneText: z.string().describe("The narrative text or description of the scene to illustrate"),
  
  /** Names of characters to include (will use their portraits for consistency) */
  characterNames: z.array(z.string()).optional().describe(
    "Character names to include - their existing portraits will be used as reference for visual consistency"
  ),
  
  /** Art style for the illustration */
  style: imageStyleSchema.optional().default("fantasy_art").describe("Art style for the scene"),
  
  /** Aspect ratio (default 16:9 for scenes) */
  aspectRatio: aspectRatioSchema.optional().default("16:9").describe(
    "Aspect ratio - 16:9 for wide scenes, 3:4 for vertical compositions"
  ),
  
  /** Composition focus */
  sceneFocus: sceneFocusSchema.optional().default("dramatic").describe(
    "Composition focus: 'action' (dynamic movement), 'dialogue' (conversation), 'establishing' (setting), 'dramatic' (key moment)"
  ),
  
  /** Negative prompt - what to avoid */
  negativePrompt: z.string().optional().describe("What to avoid in the generation"),
});

export type IllustrateSceneArgs = z.infer<typeof illustrateSceneParameters>;

// =============================================================================
// Scene Focus Prompts
// =============================================================================

export const SCENE_FOCUS_PROMPTS: Record<z.infer<typeof sceneFocusSchema>, string> = {
  action: "dynamic composition, motion blur, intense movement, action pose, dramatic angle",
  dialogue: "conversational framing, eye contact, intimate composition, character interaction focus",
  establishing: "wide shot, environmental focus, setting the scene, atmospheric perspective",
  dramatic: "dramatic lighting, emotional intensity, key moment, cinematic composition",
};

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Scene illustration always requires approval - costly image generation.
 */
async function illustrateSceneNeedsApproval(): Promise<boolean> {
  return true;
}

export const illustrateSceneTool = tool({
  description: `Generate an illustration for a narrative scene.

Creates a composed scene image that:
- Visualizes the described narrative moment
- Uses existing character portraits for visual consistency
- Maintains the project's established art style

Use this tool when:
- The author selects text and wants to visualize it
- Illustrating key story moments
- Creating scene art for chapters or beats

Character consistency:
If characterNames are provided, the system will:
1. Look up each character's existing portrait
2. Use those portraits as visual references
3. Generate a scene with consistent character appearances

Tip: Works best with characters that already have portraits generated.`,
  inputSchema: illustrateSceneParameters,
  needsApproval: illustrateSceneNeedsApproval,
  execute: async (args) => {
    const style = args.style ?? "fantasy_art";
    const focus = args.sceneFocus ?? "dramatic";
    const charCount = args.characterNames?.length ?? 0;
    const charInfo = charCount > 0 ? ` with ${charCount} character(s)` : "";
    const scenePreview = args.sceneText.slice(0, 50);
    
    return {
      toolName: "illustrate_scene",
      proposal: args,
      message: `Illustrating ${focus} scene${charInfo}: "${scenePreview}..." (${style})`,
    } as ToolExecuteResult;
  },
});
