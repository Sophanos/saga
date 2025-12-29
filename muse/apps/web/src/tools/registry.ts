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
// Saga tools
import { genesisWorldExecutor } from "./executors/genesisWorld";
import { detectEntitiesExecutor } from "./executors/detectEntities";
import { checkConsistencyExecutor } from "./executors/checkConsistency";
import { generateTemplateExecutor } from "./executors/generateTemplate";
import { clarityCheckExecutor } from "./executors/clarityCheck";

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
  // Saga unified agent tools
  genesis_world: genesisWorldExecutor as ToolDefinition<unknown, unknown>,
  detect_entities: detectEntitiesExecutor as ToolDefinition<unknown, unknown>,
  check_consistency: checkConsistencyExecutor as ToolDefinition<unknown, unknown>,
  generate_template: generateTemplateExecutor as ToolDefinition<unknown, unknown>,
  clarity_check: clarityCheckExecutor as ToolDefinition<unknown, unknown>,
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
