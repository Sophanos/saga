/**
 * delete_entity tool definition
 */

import { tool } from "../deps/ai.ts";
import { z } from "../deps/zod.ts";
import { entityTypeSchema, type ToolExecuteResult } from "./types.ts";

export const deleteEntityParameters = z.object({
  entityName: z.string().describe("The name of the entity to delete"),
  entityType: entityTypeSchema.optional().describe("The type of entity (for disambiguation)"),
  reason: z.string().optional().describe("Reason for deletion (for confirmation display)"),
});

export type DeleteEntityArgs = z.infer<typeof deleteEntityParameters>;

export const deleteEntityTool = tool({
  description: "Propose deleting an entity from the author's world. This is a destructive action that will remove the entity and its relationships.",
  inputSchema: deleteEntityParameters,
  // AI SDK 6 native tool approval - destructive actions always require approval
  needsApproval: true,
  execute: async (args) => {
    return {
      toolName: "delete_entity",
      proposal: args,
      message: `Proposed deleting ${args.entityType || "entity"}: "${args.entityName}"${args.reason ? ` (${args.reason})` : ""}`,
    } as ToolExecuteResult;
  },
});
