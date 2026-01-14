/**
 * search_users tool executor
 *
 * This tool executes on the server (user directory lookup).
 */

import type { SearchUsersArgs, SearchUsersResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const searchUsersExecutor: ToolDefinition<SearchUsersArgs, SearchUsersResult> = {
  toolName: "search_users",
  label: "Search Users",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => `Search users: ${args.query}`,

  execute: async (): Promise<ToolExecutionResult<SearchUsersResult>> => {
    return {
      success: false,
      error: "This tool executes on the server.",
    };
  },
};
