/**
 * generate_template tool definition
 *
 * Proposes generating a custom project template from a story description.
 * Actual execution happens in ai-saga execute_tool path.
 */

import { tool } from "https://esm.sh/ai@4.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { templateComplexitySchema, type ToolExecuteResult } from "./types.ts";

export const generateTemplateParameters = z.object({
  storyDescription: z
    .string()
    .min(20)
    .describe("Description of the story/world to generate a template for (minimum 20 characters)"),
  genreHints: z
    .array(z.string())
    .optional()
    .describe("Genre hints to guide template generation (e.g., ['dark fantasy', 'political intrigue'])"),
  complexity: templateComplexitySchema
    .optional()
    .describe("Template complexity: simple (few entity types), standard, or complex (many custom fields)"),
  baseTemplateId: z
    .string()
    .optional()
    .describe("ID of a builtin template to inherit from and customize"),
});

export type GenerateTemplateArgs = z.infer<typeof generateTemplateParameters>;

export const generateTemplateTool = tool({
  description:
    "Propose generating a custom project template with entity types, relationship kinds, linter rules, and UI configuration tailored to the story",
  parameters: generateTemplateParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    const preview =
      args.storyDescription.length > 60
        ? args.storyDescription.slice(0, 60) + "..."
        : args.storyDescription;
    const genreDesc = args.genreHints?.length ? ` (${args.genreHints.join(", ")})` : "";
    return {
      toolName: "generate_template",
      proposal: args,
      message: `Proposed template generation for: "${preview}"${genreDesc}`,
    };
  },
});
