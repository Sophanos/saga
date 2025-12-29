/**
 * Client Tool Registry
 *
 * Central registry of all tool definitions for the client.
 * Maps tool names to their executors, UI metadata, and handlers.
 */

import type { ToolName } from "../stores";
import type { ToolDefinition, ToolDangerLevel } from "./types";
import { createEntityExecutor } from "./executors/createEntity";
import { updateEntityExecutor } from "./executors/updateEntity";
import { deleteEntityExecutor } from "./executors/deleteEntity";
import { createRelationshipExecutor } from "./executors/createRelationship";
import { deleteRelationshipExecutor } from "./executors/deleteRelationship";
import { generateContentExecutor } from "./executors/generateContent";

// =============================================================================
// Tool Registry
// =============================================================================

/**
 * Registry of all tool definitions by name.
 */
export const toolRegistry: Record<string, ToolDefinition<unknown, unknown>> = {
  create_entity: createEntityExecutor as ToolDefinition<unknown, unknown>,
  update_entity: updateEntityExecutor as ToolDefinition<unknown, unknown>,
  delete_entity: deleteEntityExecutor as ToolDefinition<unknown, unknown>,
  create_relationship: createRelationshipExecutor as ToolDefinition<unknown, unknown>,
  delete_relationship: deleteRelationshipExecutor as ToolDefinition<unknown, unknown>,
  generate_content: generateContentExecutor as ToolDefinition<unknown, unknown>,
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
