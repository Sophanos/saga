/**
 * write_todos Tool Executor
 *
 * Auto-executed on backend. This is UI metadata only.
 */

import type { WriteTodosArgs, WriteTodosResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const writeTodosExecutor: ToolDefinition<WriteTodosArgs, WriteTodosResult> = {
  toolName: "write_todos",
  label: "Todo List",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => {
    const count = args.todos?.length ?? 0;
    const title = args.title ?? "Tasks";
    return `${title} (${count} items)`;
  },

  execute: async (): Promise<ToolExecutionResult<WriteTodosResult>> => {
    // Auto-executed on backend - no client-side execution
    return {
      success: false,
      error: "This tool is auto-executed on the backend.",
    };
  },
};
