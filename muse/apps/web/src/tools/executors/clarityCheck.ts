/**
 * Client-side executor for clarity_check tool.
 *
 * Checks prose for word/phrase-level clarity issues:
 * - Ambiguous pronouns
 * - Unclear antecedents
 * - Clichés
 * - Filler/weasel words
 * - Dangling modifiers
 *
 * Also computes readability metrics.
 */

import type { ClarityCheckArgs } from "@mythos/agent-protocol";
import { executeClarityCheck } from "../../services/ai/sagaClient";
import {
  resolveTextFromContext,
  type ToolDefinition,
  type ToolExecutionResult,
} from "../types";

/**
 * Result shape for the executor (what's shown in tool result UI)
 */
interface ClarityCheckExecutionResult {
  issuesFound: number;
  grade?: number;
  readingEase?: number;
}

export const clarityCheckExecutor: ToolDefinition<
  ClarityCheckArgs,
  ClarityCheckExecutionResult
> = {
  toolName: "clarity_check",
  label: "Clarity Check",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const scope = args.scope || "document";
    return `Check ${scope} for clarity issues`;
  },

  validate: (_args) => {
    // Text can be provided at execution time from context
    return { valid: true };
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<ClarityCheckExecutionResult>> => {
    // Require API key
    if (!ctx.apiKey) {
      return {
        success: false,
        error: "API key is required for clarity check",
      };
    }

    // Resolve text from context
    const textResult = resolveTextFromContext(args, ctx, "clarity check");
    if (!textResult.success) {
      return {
        success: false,
        error: textResult.error,
      };
    }

    try {
      // Execute the clarity check via saga API
      const result = await executeClarityCheck(
        {
          ...args,
          text: textResult.text,
        },
        {
          apiKey: ctx.apiKey,
          signal: ctx.signal,
        }
      );

      // Store clarity issues in the analysis store via context hooks
      if (ctx.setClarityIssues) {
        // Convert ClarityCheckIssue to StyleIssue format
        const styleIssues = result.issues.map((issue) => ({
          id: issue.id,
          type: issue.type as "ambiguous_pronoun" | "unclear_antecedent" | "cliche" | "filler_word" | "dangling_modifier",
          text: issue.text,
          line: issue.line,
          position: issue.position,
          suggestion: issue.suggestion,
          fix: issue.fix,
        }));
        ctx.setClarityIssues(styleIssues);
      }

      // Store readability metrics if hook is available
      if (ctx.setReadabilityMetrics) {
        ctx.setReadabilityMetrics(result.metrics);
      }

      // Switch to coach tab to show results
      ctx.setActiveTab?.("coach");

      return {
        success: true,
        result: {
          issuesFound: result.issues.length,
          grade: result.metrics.fleschKincaidGrade,
          readingEase: result.metrics.fleschReadingEase,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Clarity check failed",
      };
    }
  },
};
