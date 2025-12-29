/**
 * generate_content tool executor
 *
 * Note: This is a placeholder that marks the tool as executed.
 * The actual content generation happens in the LLM response text.
 */

import type { ToolDefinition, ToolExecutionResult } from "../types";

export interface GenerateContentArgs {
  contentType: "description" | "backstory" | "dialogue" | "scene";
  subject: string;
  tone?: string;
  length?: "short" | "medium" | "long";
}

export interface GenerateContentResult {
  contentType: string;
  subject: string;
}

export const generateContentExecutor: ToolDefinition<GenerateContentArgs, GenerateContentResult> = {
  toolName: "generate_content",
  label: "Generate Content",
  requiresConfirmation: false, // Content is shown inline
  danger: "safe",

  renderSummary: (args) => `${args.contentType}: ${args.subject}`,

  execute: async (args): Promise<ToolExecutionResult<GenerateContentResult>> => {
    // Content generation is handled by the LLM response text.
    // This executor just marks the tool call as processed.
    return {
      success: true,
      result: {
        contentType: args.contentType,
        subject: args.subject,
      },
    };
  },
};
