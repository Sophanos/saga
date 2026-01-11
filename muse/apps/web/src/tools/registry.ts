/**
 * Client Tool Registry
 *
 * Central registry of all tool definitions for the client.
 * Maps tool names to their executors, UI metadata, and handlers.
 */

import type { ToolName } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolDangerLevel } from "./types";
// Core tools
import { createEntityExecutor } from "./executors/createEntity";
import { updateEntityExecutor } from "./executors/updateEntity";
import { deleteEntityExecutor } from "./executors/deleteEntity";
import { createRelationshipExecutor } from "./executors/createRelationship";
import { updateRelationshipExecutor } from "./executors/updateRelationship";
import { deleteRelationshipExecutor } from "./executors/deleteRelationship";
import { generateContentExecutor } from "./executors/generateContent";
import { generateImageExecutor } from "./executors/generateImage";
// Saga tools
import { genesisWorldExecutor } from "./executors/genesisWorld";
import { detectEntitiesExecutor } from "./executors/detectEntities";
import { checkConsistencyExecutor } from "./executors/checkConsistency";
import { generateTemplateExecutor } from "./executors/generateTemplate";
import { clarityCheckExecutor } from "./executors/clarityCheck";
import { checkLogicExecutor } from "./executors/checkLogic";
import { nameGeneratorExecutor } from "./executors/nameGenerator";
import { commitDecisionExecutor } from "./executors/commitDecision";
import { askQuestionExecutor } from "./executors/askQuestion";
import { writeContentExecutor } from "./executors/writeContent";
// Web research tools
import { webSearchExecutor } from "./executors/webSearch";
import { webExtractExecutor } from "./executors/webExtract";
// Image search tools
import { searchImagesExecutor } from "./executors/searchImages";
import { findSimilarImagesExecutor } from "./executors/findSimilarImages";
// Phase 3+4: Reference image & scene tools
import { analyzeImageExecutor } from "./executors/analyzeImage";
import { createEntityFromImageExecutor } from "./executors/createEntityFromImage";
import { illustrateSceneExecutor } from "./executors/illustrateScene";

// =============================================================================
// Tool Registry
// =============================================================================

/**
 * Registry of all tool definitions by name.
 */
export const toolRegistry: Record<string, ToolDefinition<unknown, unknown>> = {
  // Core entity/relationship tools
  create_entity: createEntityExecutor as ToolDefinition<unknown, unknown>,
  update_entity: updateEntityExecutor as ToolDefinition<unknown, unknown>,
  delete_entity: deleteEntityExecutor as ToolDefinition<unknown, unknown>,
  create_relationship: createRelationshipExecutor as ToolDefinition<unknown, unknown>,
  update_relationship: updateRelationshipExecutor as ToolDefinition<unknown, unknown>,
  delete_relationship: deleteRelationshipExecutor as ToolDefinition<unknown, unknown>,
  generate_content: generateContentExecutor as ToolDefinition<unknown, unknown>,
  generate_image: generateImageExecutor as ToolDefinition<unknown, unknown>,
  // Saga unified agent tools
  genesis_world: genesisWorldExecutor as ToolDefinition<unknown, unknown>,
  detect_entities: detectEntitiesExecutor as ToolDefinition<unknown, unknown>,
  check_consistency: checkConsistencyExecutor as ToolDefinition<unknown, unknown>,
  generate_template: generateTemplateExecutor as ToolDefinition<unknown, unknown>,
  clarity_check: clarityCheckExecutor as ToolDefinition<unknown, unknown>,
  check_logic: checkLogicExecutor as ToolDefinition<unknown, unknown>,
  name_generator: nameGeneratorExecutor as ToolDefinition<unknown, unknown>,
  commit_decision: commitDecisionExecutor as ToolDefinition<unknown, unknown>,
  ask_question: askQuestionExecutor as ToolDefinition<unknown, unknown>,
  write_content: writeContentExecutor as ToolDefinition<unknown, unknown>,
  // Web research tools
  web_search: webSearchExecutor as ToolDefinition<unknown, unknown>,
  web_extract: webExtractExecutor as ToolDefinition<unknown, unknown>,
  // Image search tools
  search_images: searchImagesExecutor as ToolDefinition<unknown, unknown>,
  find_similar_images: findSimilarImagesExecutor as ToolDefinition<unknown, unknown>,
  // Phase 3+4: Reference image & scene tools
  analyze_image: analyzeImageExecutor as ToolDefinition<unknown, unknown>,
  create_entity_from_image: createEntityFromImageExecutor as ToolDefinition<unknown, unknown>,
  illustrate_scene: illustrateSceneExecutor as ToolDefinition<unknown, unknown>,
};

/**
 * Get a tool definition by name.
 */
export function getTool(toolName: ToolName): ToolDefinition<unknown, unknown> | undefined {
  return toolRegistry[toolName];
}

/**
 * Check if a tool name is registered.
 */
export function isRegisteredTool(toolName: string): toolName is ToolName {
  return toolName in toolRegistry;
}

/**
 * Get the label for a tool.
 */
export function getToolLabel(toolName: ToolName): string {
  return toolRegistry[toolName]?.label ?? toolName;
}

/**
 * Get the danger level for a tool.
 */
export function getToolDanger(toolName: ToolName): ToolDangerLevel {
  return toolRegistry[toolName]?.danger ?? "safe";
}

/**
 * Check if a tool requires user confirmation.
 */
export function toolRequiresConfirmation(toolName: ToolName): boolean {
  return toolRegistry[toolName]?.requiresConfirmation ?? true;
}

/**
 * Render a summary for a tool call.
 */
export function renderToolSummary(toolName: ToolName, args: unknown): string {
  const tool = toolRegistry[toolName];
  if (!tool) return toolName;
  try {
    return tool.renderSummary(args);
  } catch {
    return toolName;
  }
}

/**
 * All registered tool names.
 */
export const REGISTERED_TOOLS = Object.keys(toolRegistry) as ToolName[];
