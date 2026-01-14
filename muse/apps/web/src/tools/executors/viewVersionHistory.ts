/**
 * view_version_history tool executor
 *
 * This tool executes on the server (document revisions are stored in Convex).
 */

import type { ViewVersionHistoryArgs, ViewVersionHistoryResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const viewVersionHistoryExecutor: ToolDefinition<
  ViewVersionHistoryArgs,
  ViewVersionHistoryResult
> = {
  toolName: "view_version_history",
  label: "View Version History",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => `Version history for ${args.documentId}`,

  execute: async (): Promise<ToolExecutionResult<ViewVersionHistoryResult>> => {
    return {
      success: false,
      error: "This tool executes on the server.",
    };
  },
};
