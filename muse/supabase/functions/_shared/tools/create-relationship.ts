/**
 * create_relationship tool definition
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { relationTypeSchema, type ToolExecuteResult } from "./types.ts";

export const createRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: relationTypeSchema.describe("The type of relationship"),
  bidirectional: z.boolean().optional().describe("Whether the relationship goes both ways"),
  notes: z.string().optional().describe("Additional context about the relationship"),
  strength: z.number().min(0).max(1).optional().describe("Strength of the relationship (0-1)"),
});

export type CreateRelationshipArgs = z.infer<typeof createRelationshipParameters>;

export const createRelationshipTool = tool({
  description: "Propose creating a relationship between two entities in the author's world",
  inputSchema: createRelationshipParameters,
  execute: async (args) => {
    return {
      toolName: "create_relationship",
      proposal: args,
      message: `Proposed relationship: ${args.sourceName} → ${args.type} → ${args.targetName}${args.bidirectional ? " (bidirectional)" : ""}`,
    } as ToolExecuteResult;
  },
});
