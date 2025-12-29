/**
 * Client Tool System
 *
 * Provides a modular registry and runtime for AI agent tools.
 */

// Types
export type {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolDangerLevel,
  EntityResolution,
} from "./types";
export { resolveEntityByName, resolveRelationship } from "./types";

// Registry
export {
  toolRegistry,
  getTool,
  isRegisteredTool,
  getToolLabel,
  getToolDanger,
  toolRequiresConfirmation,
  renderToolSummary,
  REGISTERED_TOOLS,
} from "./registry";

// Executors (for direct use if needed)
export * from "./executors";
