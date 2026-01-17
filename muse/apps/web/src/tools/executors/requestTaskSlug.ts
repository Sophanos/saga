/**
 * request_task_slug tool executor
 *
 * This tool requires a human response in the UI.
 */

import type { RequestTaskSlugArgs, RequestTaskSlugResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

function summarizeRequest(args: RequestTaskSlugArgs): string {
  if (args.title && args.title.trim()) return args.title.trim();
  return "Select task slug";
}

export const requestTaskSlugExecutor: ToolDefinition<RequestTaskSlugArgs, RequestTaskSlugResult> = {
  toolName: "request_task_slug",
  label: "Select Task",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => summarizeRequest(args),

  execute: async (): Promise<ToolExecutionResult<RequestTaskSlugResult>> => {
    return {
      success: false,
      error: "This tool requires a user response in the console.",
    };
  },
};
