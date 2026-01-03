/**
 * name_generator tool definition
 *
 * Generates culturally-aware, genre-appropriate names for entities.
 * Supports various cultures and naming styles.
 *
 * Actual execution happens in ai-saga execute_tool path.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import {
  entityTypeSchema,
  nameCultureSchema,
  nameStyleSchema,
  type ToolExecuteResult,
} from "./types.ts";

export const nameGeneratorParameters = z.object({
  entityType: entityTypeSchema.describe("Type of entity to name"),
  genre: z
    .string()
    .optional()
    .describe("Genre context for name style (e.g., fantasy, sci-fi, historical)"),
  culture: nameCultureSchema
    .optional()
    .describe("Cultural inspiration for names"),
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Number of names to generate (default: 10)"),
  seed: z
    .string()
    .optional()
    .describe("Seed text for context (entity notes, description)"),
  avoid: z
    .array(z.string())
    .optional()
    .describe("Names to avoid (existing entities)"),
  tone: z
    .string()
    .optional()
    .describe("Optional tone for the names (e.g., heroic, mysterious, whimsical)"),
  style: nameStyleSchema
    .optional()
    .describe("Style preference for name length: short, standard, or long"),
});

export type NameGeneratorArgs = z.infer<typeof nameGeneratorParameters>;

export const nameGeneratorTool = tool({
  description:
    "Generate culturally-aware, genre-appropriate names for characters, locations, items, and other story entities. Provides meaning and pronunciation when applicable.",
  inputSchema: nameGeneratorParameters,
  execute: async (args) => {
    const count = args.count || 10;
    const culture = args.culture || "any";
    const entityType = args.entityType;
    return {
      toolName: "name_generator",
      proposal: args,
      message: `Generating ${count} ${culture} ${entityType} names`,
    } as ToolExecuteResult;
  },
});
