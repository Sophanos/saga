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
export { generateImageTool, generateImageParameters, buildImagePrompt, STYLE_PROMPTS, type GenerateImageArgs } from "./generate-image.ts";
export { editImageTool, editImageParameters, buildEditPrompt, type EditImageArgs } from "./edit-image.ts";

// Export individual tools - Saga unified agent
export { genesisWorldTool, genesisWorldParameters, type GenesisWorldArgs } from "./genesis-world.ts";
export { detectEntitiesTool, detectEntitiesParameters, type DetectEntitiesArgs } from "./detect-entities.ts";
export { checkConsistencyTool, checkConsistencyParameters, type CheckConsistencyArgs } from "./check-consistency.ts";
export { generateTemplateTool, generateTemplateParameters, type GenerateTemplateArgs } from "./generate-template.ts";
export { clarityCheckTool, clarityCheckParameters, type ClarityCheckArgs } from "./clarity-check.ts";
export { checkLogicTool, checkLogicParameters, type CheckLogicArgs } from "./check-logic.ts";
export { nameGeneratorTool, nameGeneratorParameters, type NameGeneratorArgs } from "./name-generator.ts";
export { commitDecisionTool, commitDecisionParameters, type CommitDecisionArgs } from "./commit-decision.ts";

// Export image search tools
export { searchImagesTool, searchImagesParameters, type SearchImagesArgs } from "./search-images.ts";
export { findSimilarImagesTool, findSimilarImagesParameters, type FindSimilarImagesArgs } from "./find-similar-images.ts";

// Export Phase 3+4 tools
export { analyzeImageTool, analyzeImageParameters, extractionFocusSchema, type AnalyzeImageArgs } from "./analyze-image.ts";
export { createEntityFromImageTool, createEntityFromImageParameters, type CreateEntityFromImageArgs } from "./create-entity-from-image.ts";
export { illustrateSceneTool, illustrateSceneParameters, sceneFocusSchema, SCENE_FOCUS_PROMPTS, type IllustrateSceneArgs } from "./illustrate-scene.ts";

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
import { generateImageTool } from "./generate-image.ts";
import { editImageTool } from "./edit-image.ts";

// Import Saga tools for registry
import { genesisWorldTool } from "./genesis-world.ts";
import { detectEntitiesTool } from "./detect-entities.ts";
import { checkConsistencyTool } from "./check-consistency.ts";
import { generateTemplateTool } from "./generate-template.ts";
import { clarityCheckTool } from "./clarity-check.ts";
import { checkLogicTool } from "./check-logic.ts";
import { nameGeneratorTool } from "./name-generator.ts";
import { commitDecisionTool } from "./commit-decision.ts";

// Import image search tools for registry
import { searchImagesTool } from "./search-images.ts";
import { findSimilarImagesTool } from "./find-similar-images.ts";

// Import Phase 3+4 tools for registry
import { analyzeImageTool } from "./analyze-image.ts";
import { createEntityFromImageTool } from "./create-entity-from-image.ts";
import { illustrateSceneTool } from "./illustrate-scene.ts";

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
  generate_image: generateImageTool,
  edit_image: editImageTool,
  // Phase 3+4: World-modifying image tools
  create_entity_from_image: createEntityFromImageTool,
  illustrate_scene: illustrateSceneTool,
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
  check_logic: checkLogicTool,
  name_generator: nameGeneratorTool,
  commit_decision: commitDecisionTool,
  // Image search tools
  search_images: searchImagesTool,
  find_similar_images: findSimilarImagesTool,
  // Phase 3: Image analysis (read-only)
  analyze_image: analyzeImageTool,
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
