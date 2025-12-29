/**
 * create_entity tool definition
 */

import { tool } from "https://esm.sh/ai@3.4.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { entityTypeSchema, itemCategorySchema, type ToolExecuteResult } from "./types.ts";

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

export const createEntityTool = tool({
  description: "Propose creating a new entity (character, location, item, faction, magic system, event, or concept) in the author's world",
  parameters: createEntityParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    return {
      toolName: "create_entity",
      proposal: args,
      message: `Proposed creating ${args.type}: "${args.name}"`,
    };
  },
});
