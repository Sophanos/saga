/**
 * Server Tool Registry
 *
 * Exports all tools for use with the AI SDK's streamText().
 * Import this module and spread `agentTools` into your tools config.
 */

// Export individual tools - Entity/Relationship CRUD
export { createEntityTool, createEntityParameters, type CreateEntityArgs } from "./create-entity.ts";
export { updateEntityTool, updateEntityParameters, type UpdateEntityArgs } from "./update-entity.ts";
export { deleteEntityTool, deleteEntityParameters, type DeleteEntityArgs } from "./delete-entity.ts";
export { createRelationshipTool, createRelationshipParameters, type CreateRelationshipArgs } from "./create-relationship.ts";
export { updateRelationshipTool, updateRelationshipParameters, type UpdateRelationshipArgs } from "./update-relationship.ts";
export { deleteRelationshipTool, deleteRelationshipParameters, type DeleteRelationshipArgs } from "./delete-relationship.ts";
export { generateContentTool, generateContentParameters, type GenerateContentArgs } from "./generate-content.ts";

// Export individual tools - Saga unified agent
export { genesisWorldTool, genesisWorldParameters, type GenesisWorldArgs } from "./genesis-world.ts";
export { detectEntitiesTool, detectEntitiesParameters, type DetectEntitiesArgs } from "./detect-entities.ts";
export { checkConsistencyTool, checkConsistencyParameters, type CheckConsistencyArgs } from "./check-consistency.ts";
export { generateTemplateTool, generateTemplateParameters, type GenerateTemplateArgs } from "./generate-template.ts";
export { clarityCheckTool, clarityCheckParameters, type ClarityCheckArgs } from "./clarity-check.ts";

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

// Import Saga tools for registry
import { genesisWorldTool } from "./genesis-world.ts";
import { detectEntitiesTool } from "./detect-entities.ts";
import { checkConsistencyTool } from "./check-consistency.ts";
import { generateTemplateTool } from "./generate-template.ts";
import { clarityCheckTool } from "./clarity-check.ts";

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
/**
 * Core entity/relationship tools for in-chat modifications.
 */
export const coreTools = {
  create_entity: createEntityTool,
  update_entity: updateEntityTool,
  delete_entity: deleteEntityTool,
  create_relationship: createRelationshipTool,
  update_relationship: updateRelationshipTool,
  delete_relationship: deleteRelationshipTool,
  generate_content: generateContentTool,
} as const;

/**
 * Saga unified agent tools for world building and analysis.
 */
export const sagaTools = {
  genesis_world: genesisWorldTool,
  detect_entities: detectEntitiesTool,
  check_consistency: checkConsistencyTool,
  generate_template: generateTemplateTool,
  clarity_check: clarityCheckTool,
} as const;

/**
 * All agent tools bundled for streamText() usage.
 * Includes both core CRUD tools and Saga analysis tools.
 */
export const agentTools = {
  ...coreTools,
  ...sagaTools,
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
