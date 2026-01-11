/**
 * Template Builder Tools
 *
 * Agent-invocable tools for generating project templates.
 */

import { tool } from "ai";
import { z } from "zod";

const templateComplexitySchema = z.enum(["simple", "standard", "complex"]);

export const generateTemplateTool = tool({
  description:
    "Generate a domain-aware project template blueprint (entity kinds, relationships, documents, UI modules, linter rules) from a user description.",
  inputSchema: z.object({
    storyDescription: z
      .string()
      .describe("Description of the project or story idea to generate the template from"),
    baseTemplateId: z
      .string()
      .optional()
      .describe("Base template id (story, product, engineering, design, comms, cinema)"),
    complexity: templateComplexitySchema
      .optional()
      .describe("Template complexity level (simple, standard, complex)"),
    genreHints: z
      .array(z.string())
      .optional()
      .describe("Optional genre or tone hints to guide generation"),
  }),
});
