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

/**
 * Determines if create_relationship needs approval based on relationship type.
 * Familial and power relationships are more impactful and need approval.
 */
async function createRelationshipNeedsApproval({ type }: CreateRelationshipArgs): Promise<boolean> {
  // High-impact relationship types that affect world structure
  const highImpactTypes = [
    "parent_of", "child_of", "sibling_of", "married_to",  // Familial
    "rules", "serves", "member_of",                        // Power dynamics
    "killed", "created",                                   // Story-critical
  ];
  return highImpactTypes.includes(type);
}

export const createRelationshipTool = tool({
  description: "Propose creating a relationship between two entities in the author's world",
  inputSchema: createRelationshipParameters,
  // AI SDK 6 native tool approval - dynamic based on relationship type
  needsApproval: createRelationshipNeedsApproval,
  execute: async (args) => {
    return {
      toolName: "create_relationship",
      proposal: args,
      message: `Proposed relationship: ${args.sourceName} → ${args.type} → ${args.targetName}${args.bidirectional ? " (bidirectional)" : ""}`,
    } as ToolExecuteResult;
  },
});
