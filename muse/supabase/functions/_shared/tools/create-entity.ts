/**
 * create_entity tool definition
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { entityTypeSchema, itemCategorySchema, type ToolExecuteResult } from "./types.ts";
import { isHighImpactEntityType } from "./approval-config.ts";

export const createEntityParameters = z.object({
  type: entityTypeSchema.describe("The type of entity to create"),
  name: z.string().describe("The name of the entity"),
  aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
  notes: z.string().optional().describe("General notes about the entity"),
  // Character-specific
  archetype: z.string().optional().describe("Character archetype (hero, mentor, shadow, trickster, etc.)"),
  backstory: z.string().optional().describe("Character's background story"),
  goals: z.array(z.string()).optional().describe("Character's goals and motivations"),
  fears: z.array(z.string()).optional().describe("Character's fears"),
  // Location-specific
  climate: z.string().optional().describe("Climate or weather of the location"),
  atmosphere: z.string().optional().describe("Mood and feeling of the place"),
  // Item-specific
  category: itemCategorySchema.optional().describe("Category of item"),
  abilities: z.array(z.string()).optional().describe("Special abilities or properties"),
  // Faction-specific
  leader: z.string().optional().describe("Name of the faction leader"),
  headquarters: z.string().optional().describe("Main base or location"),
  factionGoals: z.array(z.string()).optional().describe("Faction's goals"),
  // Magic System-specific
  rules: z.array(z.string()).optional().describe("Rules of the magic system"),
  limitations: z.array(z.string()).optional().describe("Limitations and costs"),
});

export type CreateEntityArgs = z.infer<typeof createEntityParameters>;

/**
 * Determines if create_entity needs approval based on entity type.
 * Characters and magic systems always need approval as they are core world elements.
 * Other types are auto-approved for faster workflow.
 */
async function createEntityNeedsApproval({ type }: CreateEntityArgs): Promise<boolean> {
  return isHighImpactEntityType(type);
}

export const createEntityTool = tool({
  description: "Propose creating a new entity (character, location, item, faction, magic system, event, or concept) in the author's world",
  inputSchema: createEntityParameters,
  // AI SDK 6 native tool approval - dynamic based on entity type
  needsApproval: createEntityNeedsApproval,
  execute: async (args) => {
    return {
      toolName: "create_entity",
      proposal: args,
      message: `Proposed creating ${args.type}: "${args.name}"`,
    } as ToolExecuteResult;
  },
});
