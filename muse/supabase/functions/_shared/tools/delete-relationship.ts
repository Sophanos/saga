/**
 * delete_relationship tool definition
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
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
  inputSchema: deleteRelationshipParameters,
  // AI SDK 6 native tool approval - destructive actions always require approval
  needsApproval: true,
  execute: async (args) => {
    return {
      toolName: "delete_relationship",
      proposal: args,
      message: `Proposed deleting relationship: ${args.sourceName} → ${args.type} → ${args.targetName}${args.reason ? ` (${args.reason})` : ""}`,
    } as ToolExecuteResult;
  },
});
