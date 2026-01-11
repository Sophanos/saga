/**
 * ask_question tool executor
 *
 * This tool requires a human response. The UI sends a tool-result
 * message to resume generation, so execution is intentionally blocked.
 */

import type { AskQuestionArgs, AskQuestionResult } from "@mythos/agent-protocol";
import type { ToolDefinition, ToolExecutionResult } from "../types";

function summarizeQuestion(args: AskQuestionArgs): string {
  const firstQuestion = args.questions?.[0]?.question ?? "";
  const trimmed = firstQuestion.trim();
  if (!trimmed) return "Ask a question";
  const count = args.questions?.length ?? 1;
  const prefix = count > 1 ? `(${count} questions) ` : "";
  const text = prefix + trimmed;
  if (text.length <= 80) return text;
  return `${text.slice(0, 77)}...`;
}

export const askQuestionExecutor: ToolDefinition<AskQuestionArgs, AskQuestionResult> = {
  toolName: "ask_question",
  label: "Ask Question",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => summarizeQuestion(args),

  execute: async (): Promise<ToolExecutionResult<AskQuestionResult>> => {
    return {
      success: false,
      error: "This tool requires a user response in the console.",
    };
  },
};
