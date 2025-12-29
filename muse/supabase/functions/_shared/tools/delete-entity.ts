/**
 * delete_entity tool definition
 */

import { tool } from "https://esm.sh/ai@4.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { entityTypeSchema, type ToolExecuteResult } from "./types.ts";

export const deleteEntityParameters = z.object({
  entityName: z.string().describe("The name of the entity to delete"),
  entityType: entityTypeSchema.optional().describe("The type of entity (for disambiguation)"),
  reason: z.string().optional().describe("Reason for deletion (for confirmation display)"),
});

export type DeleteEntityArgs = z.infer<typeof deleteEntityParameters>;

export const deleteEntityTool = tool({
  description: "Propose deleting an entity from the author's world. This is a destructive action that will remove the entity and its relationships.",
  parameters: deleteEntityParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    return {
      toolName: "delete_entity",
      proposal: args,
      message: `Proposed deleting ${args.entityType || "entity"}: "${args.entityName}"${args.reason ? ` (${args.reason})` : ""}`,
    };
  },
});
