/**
 * delete_relationship tool definition
 */

import { tool } from "https://esm.sh/ai@3.4.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { relationTypeSchema, type ToolExecuteResult } from "./types.ts";

export const deleteRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: relationTypeSchema.describe("The type of relationship to delete"),
  reason: z.string().optional().describe("Reason for deletion"),
});

export type DeleteRelationshipArgs = z.infer<typeof deleteRelationshipParameters>;

export const deleteRelationshipTool = tool({
  description: "Propose deleting a relationship between two entities",
  parameters: deleteRelationshipParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    return {
      toolName: "delete_relationship",
      proposal: args,
      message: `Proposed deleting relationship: ${args.sourceName} → ${args.type} → ${args.targetName}${args.reason ? ` (${args.reason})` : ""}`,
    };
  },
});
