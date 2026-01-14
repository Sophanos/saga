/**
 * view_comments tool executor
 *
 * This tool executes on the server (comment store).
 */

import type { ViewCommentsArgs, ViewCommentsResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const viewCommentsExecutor: ToolDefinition<ViewCommentsArgs, ViewCommentsResult> = {
  toolName: "view_comments",
  label: "View Comments",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => `View comments for ${args.documentId}`,

  execute: async (): Promise<ToolExecutionResult<ViewCommentsResult>> => {
    return {
      success: false,
      error: "This tool executes on the server.",
    };
  },
};
