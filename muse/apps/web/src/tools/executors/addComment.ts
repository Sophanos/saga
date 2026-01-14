/**
 * add_comment tool executor
 *
 * This tool executes on the server (comment store).
 */

import type { AddCommentArgs, AddCommentResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export const addCommentExecutor: ToolDefinition<AddCommentArgs, AddCommentResult> = {
  toolName: "add_comment",
  label: "Add Comment",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => `Add comment on ${args.documentId}`,

  execute: async (): Promise<ToolExecutionResult<AddCommentResult>> => {
    return {
      success: false,
      error: "This tool executes on the server.",
    };
  },
};
