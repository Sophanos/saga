/**
 * create_relationship tool definition
 */

import { tool } from "https://esm.sh/ai@3.4.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
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
  parameters: createRelationshipParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    return {
      toolName: "create_relationship",
      proposal: args,
      message: `Proposed relationship: ${args.sourceName} → ${args.type} → ${args.targetName}${args.bidirectional ? " (bidirectional)" : ""}`,
    };
  },
});
