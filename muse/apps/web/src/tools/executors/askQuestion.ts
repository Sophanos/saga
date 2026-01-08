/**
 * ask_question tool executor
 *
 * This tool requires a human response. The UI sends a tool-result
 * message to resume generation, so execution is intentionally blocked.
 */

import type { AskQuestionArgs, AskQuestionResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

function summarizeQuestion(question?: string): string {
  const trimmed = question?.trim() ?? "";
  if (!trimmed) return "Ask a question";
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}...`;
}

export const askQuestionExecutor: ToolDefinition<AskQuestionArgs, AskQuestionResult> = {
  toolName: "ask_question",
  label: "Ask Question",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => summarizeQuestion(args.question),

  execute: async (): Promise<ToolExecutionResult<AskQuestionResult>> => {
    return {
      success: false,
      error: "This tool requires a user response in the console.",
    };
  },
};
