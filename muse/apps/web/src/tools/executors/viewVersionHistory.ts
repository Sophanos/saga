/**
 * view_version_history tool executor
 *
 * Reads document revision history from Convex.
 */

import type { ViewVersionHistoryArgs, ViewVersionHistoryResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";
import { api } from "../../../../../convex/_generated/api";

export const viewVersionHistoryExecutor: ToolDefinition<
  ViewVersionHistoryArgs,
  ViewVersionHistoryResult
> = {
  toolName: "view_version_history",
  label: "View Version History",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => `Version history for ${args.documentId}`,

  execute: async (
    args,
    ctx
  ): Promise<ToolExecutionResult<ViewVersionHistoryResult>> => {
    if (!ctx.convex) {
      return { success: false, error: "Convex client is not available" };
    }

    try {
      const result = await ctx.convex.query(
        (api as any).revisions.viewVersionHistory,
        {
          documentId: args.documentId as any,
          limit: args.limit,
          cursor: args.cursor,
        }
      );
      return { success: true, result };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load version history";
      return { success: false, error: message };
    }
  },
};
