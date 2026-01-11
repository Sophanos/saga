/**
 * check_consistency tool executor
 *
 * Checks narrative for contradictions and plot holes.
 */

import type { CheckConsistencyArgs } from "@mythos/agent-protocol";
import { executeCheckConsistency } from "../../services/ai/agentRuntimeClient";
import { resolveTextFromContext, type ToolDefinition, type ToolExecutionResult } from "../types";

export interface CheckConsistencyExecutionResult {
  issuesFound: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  summary?: string;
}

export const checkConsistencyExecutor: ToolDefinition<CheckConsistencyArgs, CheckConsistencyExecutionResult> = {
  toolName: "check_consistency",
  label: "Check Consistency",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const scope = args.scope || "document";
    const focus = args.focus?.length ? ` (${args.focus.join(", ")})` : "";
    return `Check ${scope}${focus}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<CheckConsistencyExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for consistency check" };
    }

    // Resolve text based on scope
    const textResult = resolveTextFromContext(args, ctx, "consistency check");
    if (!textResult.success) {
      return { success: false, error: textResult.error };
    }
    const { text } = textResult;

    try {
      ctx.onProgress?.({ stage: "Analyzing consistency...", pct: 20 });

      // Include known entities for better checking
      const entities = Array.from(ctx.entities.values()).map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        properties: e.properties,
      }));

      const result = await executeCheckConsistency(
        { ...args, text, entities },
        { apiKey: ctx.apiKey, signal: ctx.signal, projectId: ctx.projectId }
      );

      ctx.onProgress?.({ stage: "Processing results...", pct: 80 });

      // Count by severity
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;

      for (const issue of result.issues) {
        if (issue.severity === "error") errorCount++;
        else if (issue.severity === "warning") warningCount++;
        else infoCount++;
      }

      // Update linter issues in store and switch to linter tab
      if (result.issues.length > 0) {
        ctx.setLinterIssues?.(result.issues);
        ctx.setActiveTab?.("linter");
      }

      ctx.onProgress?.({ stage: "Complete!", pct: 100 });

      return {
        success: true,
        result: {
          issuesFound: result.issues.length,
          errorCount,
          warningCount,
          infoCount,
          summary: result.summary,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to check consistency",
      };
    }
  },
};
