/**
 * genesis_world tool definition
 *
 * Proposes generating a complete world scaffold from a story description.
 * Actual execution happens in ai-saga execute_tool path.
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import { genesisDetailLevelSchema, type ToolExecuteResult } from "./types.ts";

export const genesisWorldParameters = z.object({
  prompt: z
    .string()
    .min(10)
    .describe("Story or world description from the user (minimum 10 characters)"),
  genre: z
    .string()
    .optional()
    .describe("Optional genre hint (e.g., 'dark fantasy', 'sci-fi', 'romance')"),
  entityCount: z
    .number()
    .int()
    .min(3)
    .max(50)
    .optional()
    .describe("Target number of entities to generate (3-50, default 10)"),
  detailLevel: genesisDetailLevelSchema
    .optional()
    .describe("How detailed the generation should be (minimal, standard, detailed)"),
  includeOutline: z
    .boolean()
    .optional()
    .describe("Whether to include a story outline with chapters/acts"),
});

export type GenesisWorldArgs = z.infer<typeof genesisWorldParameters>;

export const genesisWorldTool = tool({
  description:
    "Propose generating a complete world scaffold with entities, relationships, and optional story outline from a story description",
  inputSchema: genesisWorldParameters,
  // AI SDK 6 native tool approval - major world generation always requires approval
  needsApproval: true,
  execute: async (args) => {
    const preview = args.prompt.length > 80 ? args.prompt.slice(0, 80) + "..." : args.prompt;
    return {
      toolName: "genesis_world",
      proposal: args,
      message: `Proposed world generation for: "${preview}"`,
    } as ToolExecuteResult;
  },
});
