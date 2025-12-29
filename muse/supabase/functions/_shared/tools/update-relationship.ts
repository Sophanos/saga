/**
 * update_relationship tool definition
 */

import { tool } from "https://esm.sh/ai@3.4.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { relationTypeSchema, type ToolExecuteResult } from "./types.ts";

export const updateRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: relationTypeSchema.describe("The current type of relationship (used to identify the relationship)"),
  updates: z.object({
    notes: z.string().optional().describe("Updated notes about the relationship"),
    strength: z.number().min(0).max(1).optional().describe("Updated strength (0-1)"),
    bidirectional: z.boolean().optional().describe("Whether the relationship is bidirectional"),
  }).describe("Fields to update on the relationship"),
});

export type UpdateRelationshipArgs = z.infer<typeof updateRelationshipParameters>;

export const updateRelationshipTool = tool({
  description: "Propose updating an existing relationship between two entities",
  parameters: updateRelationshipParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );
    return {
      toolName: "update_relationship",
      proposal: args,
      message: `Proposed updating relationship: ${args.sourceName} → ${args.type} → ${args.targetName} (${updatedFields.join(", ")})`,
    };
  },
});
