/**
 * update_entity tool definition
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { entityTypeSchema, itemCategorySchema, type ToolExecuteResult } from "./types.ts";

export const updateEntityParameters = z.object({
  entityName: z.string().describe("The current name of the entity to update"),
  entityType: entityTypeSchema.optional().describe("The type of entity (for disambiguation if multiple entities share the same name)"),
  updates: z.object({
    name: z.string().optional().describe("New name for the entity"),
    aliases: z.array(z.string()).optional().describe("Updated alternative names"),
    notes: z.string().optional().describe("Updated notes"),
    // Character-specific
    archetype: z.string().optional().describe("Updated archetype"),
    backstory: z.string().optional().describe("Updated backstory"),
    goals: z.array(z.string()).optional().describe("Updated goals"),
    fears: z.array(z.string()).optional().describe("Updated fears"),
    // Location-specific
    climate: z.string().optional().describe("Updated climate"),
    atmosphere: z.string().optional().describe("Updated atmosphere"),
    // Item-specific
    category: itemCategorySchema.optional().describe("Updated category"),
    abilities: z.array(z.string()).optional().describe("Updated abilities"),
    // Faction-specific
    leader: z.string().optional().describe("Updated leader"),
    headquarters: z.string().optional().describe("Updated headquarters"),
    factionGoals: z.array(z.string()).optional().describe("Updated faction goals"),
    // Magic System-specific
    rules: z.array(z.string()).optional().describe("Updated rules"),
    limitations: z.array(z.string()).optional().describe("Updated limitations"),
  }).describe("Fields to update on the entity"),
});

export type UpdateEntityArgs = z.infer<typeof updateEntityParameters>;

/**
 * Determines if update_entity needs approval based on what's being updated.
 * Name changes and archetype changes always need approval as they affect identity.
 */
async function updateEntityNeedsApproval({ updates, entityType }: UpdateEntityArgs): Promise<boolean> {
  // Identity-changing updates always require approval
  const sensitiveFields = ["name", "archetype", "backstory", "goals"];
  const hasIdentityChange = sensitiveFields.some(
    (field) => updates[field as keyof typeof updates] !== undefined
  );

  // Character and faction updates are more sensitive
  const sensitiveTypes = ["character", "faction", "magic_system"];
  const isSensitiveType = entityType && sensitiveTypes.includes(entityType);

  return hasIdentityChange || isSensitiveType;
}

export const updateEntityTool = tool({
  description: "Propose updating an existing entity's properties. Use entityName to identify the entity (LLM doesn't have access to IDs).",
  inputSchema: updateEntityParameters,
  // AI SDK 6 native tool approval - dynamic based on update content
  needsApproval: updateEntityNeedsApproval,
  execute: async (args) => {
    const updatedFields = Object.keys(args.updates).filter(
      (k) => args.updates[k as keyof typeof args.updates] !== undefined
    );
    return {
      toolName: "update_entity",
      proposal: args,
      message: `Proposed updating ${args.entityType || "entity"} "${args.entityName}": ${updatedFields.join(", ")}`,
    } as ToolExecuteResult;
  },
});
