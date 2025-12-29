/**
 * Server Tool Registry
 *
 * Exports all tools for use with the AI SDK's streamText().
 * Import this module and spread `agentTools` into your tools config.
 */

// Export individual tools
export { createEntityTool, createEntityParameters, type CreateEntityArgs } from "./create-entity.ts";
export { updateEntityTool, updateEntityParameters, type UpdateEntityArgs } from "./update-entity.ts";
export { deleteEntityTool, deleteEntityParameters, type DeleteEntityArgs } from "./delete-entity.ts";
export { createRelationshipTool, createRelationshipParameters, type CreateRelationshipArgs } from "./create-relationship.ts";
export { updateRelationshipTool, updateRelationshipParameters, type UpdateRelationshipArgs } from "./update-relationship.ts";
export { deleteRelationshipTool, deleteRelationshipParameters, type DeleteRelationshipArgs } from "./delete-relationship.ts";
export { generateContentTool, generateContentParameters, type GenerateContentArgs } from "./generate-content.ts";

// Export types
export * from "./types.ts";

// Import tools for registry
import { createEntityTool } from "./create-entity.ts";
import { updateEntityTool } from "./update-entity.ts";
import { deleteEntityTool } from "./delete-entity.ts";
import { createRelationshipTool } from "./create-relationship.ts";
import { updateRelationshipTool } from "./update-relationship.ts";
import { deleteRelationshipTool } from "./delete-relationship.ts";
import { generateContentTool } from "./generate-content.ts";

/**
 * All agent tools bundled for streamText() usage.
 *
 * Usage:
 * ```ts
 * import { agentTools } from "../_shared/tools/index.ts";
 *
 * const result = streamText({
 *   model,
 *   messages,
 *   tools: agentTools,
 * });
 * ```
 */
export const agentTools = {
  create_entity: createEntityTool,
  update_entity: updateEntityTool,
  delete_entity: deleteEntityTool,
  create_relationship: createRelationshipTool,
  update_relationship: updateRelationshipTool,
  delete_relationship: deleteRelationshipTool,
  generate_content: generateContentTool,
} as const;

/**
 * Tool names array for validation
 */
export const TOOL_NAMES = Object.keys(agentTools) as Array<keyof typeof agentTools>;

/**
 * Check if a string is a valid tool name
 */
export function isValidToolName(name: string): name is keyof typeof agentTools {
  return TOOL_NAMES.includes(name as keyof typeof agentTools);
}
