/**
 * update_relationship tool definition
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
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

/**
 * Determines if update_relationship needs approval.
 * Strength changes below 0.3 (weakening) are considered significant.
 */
async function updateRelationshipNeedsApproval({ updates, type }: UpdateRelationshipArgs): Promise<boolean> {
  // Significant relationship changes need approval
  if (updates.bidirectional !== undefined) return true;
  if (updates.strength !== undefined && updates.strength < 0.3) return true;

  // High-impact relationship types need approval for any update
  const highImpactTypes = ["parent_of", "child_of", "sibling_of", "married_to", "killed", "created"];
  return highImpactTypes.includes(type);
}

export const updateRelationshipTool = tool({
  description: "Propose updating an existing relationship between two entities",
  inputSchema: updateRelationshipParameters,
  // AI SDK 6 native tool approval - dynamic based on update impact
  needsApproval: updateRelationshipNeedsApproval,
  execute: async (args) => {
    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );
    return {
      toolName: "update_relationship",
      proposal: args,
      message: `Proposed updating relationship: ${args.sourceName} → ${args.type} → ${args.targetName} (${updatedFields.join(", ")})`,
    } as ToolExecuteResult;
  },
});
