/**
 * search_users tool executor
 *
 * Searches project members on the server for @mentions.
 */

import type { SearchUsersArgs, SearchUsersResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { api } from "../../../../../convex/_generated/api";

export const searchUsersExecutor: ToolDefinition<SearchUsersArgs, SearchUsersResult> = {
  toolName: "search_users",
  label: "Search Users",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => `Search users: ${args.query}`,

  execute: async (
    args,
    ctx
  ): Promise<ToolExecutionResult<SearchUsersResult>> => {
    if (!ctx.convex) {
      return { success: false, error: "Convex client is not available" };
    }

    try {
      const result = await ctx.convex.query(
        (api as any).users.searchProjectUsers,
        {
          projectId: ctx.projectId as any,
          query: args.query,
          limit: args.limit,
        }
      );
      return { success: true, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to search users";
      return { success: false, error: message };
    }
  },
};
