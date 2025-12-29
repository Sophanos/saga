/**
 * check_logic tool executor
 *
 * Validates story logic against explicit rules and world state.
 */

import type { CheckLogicArgs } from "@mythos/agent-protocol";
import { executeCheckLogic } from "../../services/ai/sagaClient";
import { resolveTextFromContext, type ToolDefinition, type ToolExecutionResult } from "../types";

export interface CheckLogicExecutionResult {
  issuesFound: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  summary?: string;
}

export const checkLogicExecutor: ToolDefinition<CheckLogicArgs, CheckLogicExecutionResult> = {
  toolName: "check_logic",
  label: "Check Logic",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const scope = args.scope || "document";
    const focus = args.focus?.length ? ` (${args.focus.join(", ")})` : "";
    const strictness = args.strictness ? ` [${args.strictness}]` : "";
    return `Check ${scope}${focus}${strictness}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<CheckLogicExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for logic check" };
    }

    // Resolve text based on scope
    const textResult = resolveTextFromContext(args, ctx, "logic check");
    if (!textResult.success) {
      return { success: false, error: textResult.error };
    }
    const { text } = textResult;

    try {
      ctx.onProgress?.({ stage: "Analyzing logic...", pct: 20 });

      // Extract magic systems and their rules
      const magicSystems = Array.from(ctx.entities.values())
        .filter((e) => e.type === "magic_system")
        .map((e) => {
          const props = e.properties ?? {};
          return {
            id: e.id,
            name: e.name,
            rules: (props["rules"] as string[]) ?? [],
            limitations: (props["limitations"] as string[]) ?? [],
            costs: (props["costs"] as string[]) ?? [],
          };
        });

      // Extract characters with power levels and knowledge
      // Note: Character entities have extended status fields, access via properties for generic Entity
      const characters = Array.from(ctx.entities.values())
        .filter((e) => e.type === "character")
        .map((e) => {
          const props = e.properties ?? {};
          // Power level may be stored in properties or as a Character-specific status field
          // Access via bracket notation for index signature compatibility
          return {
            id: e.id,
            name: e.name,
            powerLevel: (props["powerLevel"] as number) ?? undefined,
            knowledge: (props["knowledge"] as string[]) ?? undefined,
          };
        });

      ctx.onProgress?.({ stage: "Validating against rules...", pct: 50 });

      const result = await executeCheckLogic(
        {
          ...args,
          text,
          magicSystems,
          characters,
          strictness: args.strictness ?? ctx.preferences?.logicStrictness ?? "balanced",
        },
        { apiKey: ctx.apiKey, signal: ctx.signal }
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
        // Map LogicIssue to ConsistencyIssue format for linter display
        const linterIssues = result.issues.map((issue) => ({
          id: issue.id,
          type: issue.type as "contradiction" | "timeline" | "character" | "world" | "plot_hole",
          severity: issue.severity,
          message: issue.violatedRule
            ? `${issue.message}\n\nViolated rule: "${issue.violatedRule.ruleText}" (${issue.violatedRule.sourceEntityName || issue.violatedRule.source})`
            : issue.message,
          suggestion: issue.suggestion,
          locations: issue.locations,
          entityIds: issue.entityIds,
        }));
        ctx.setLinterIssues?.(linterIssues);
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
        error: error instanceof Error ? error.message : "Failed to check logic",
      };
    }
  },
};
