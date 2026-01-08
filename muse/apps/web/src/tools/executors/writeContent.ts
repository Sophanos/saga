/**
 * write_content tool executor
 *
 * This tool requires user approval in the editor before sending
 * a tool-result back to the agent. Execution is intentionally blocked.
 */

import type { WriteContentArgs, WriteContentResult, WriteContentOperation } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

function summarizeOperation(operation?: WriteContentOperation): string {
  switch (operation) {
    case "replace_selection":
      return "Replace selection";
    case "append_document":
      return "Append document";
    case "insert_at_cursor":
    default:
      return "Insert at cursor";
  }
}

function summarizeContent(content?: string): string {
  const trimmed = content?.trim() ?? "";
  if (!trimmed) return "content";
  const compact = trimmed.replace(/\s+/g, " ");
  if (compact.length <= 72) return compact;
  return `${compact.slice(0, 69)}...`;
}

export const writeContentExecutor: ToolDefinition<WriteContentArgs, WriteContentResult> = {
  toolName: "write_content",
  label: "Write Content",
  requiresConfirmation: true,
  danger: "destructive",

  renderSummary: (args) => `${summarizeOperation(args.operation)}: ${summarizeContent(args.content)}`,

  execute: async (): Promise<ToolExecutionResult<WriteContentResult>> => {
    return {
      success: false,
      error: "This tool must be applied or rejected in the editor UI.",
    };
  },
};
