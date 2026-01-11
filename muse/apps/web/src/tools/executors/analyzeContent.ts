/**
 * analyze_content tool executor
 */

import type { AnalyzeContentArgs, AnalyzeContentMode } from "@mythos/agent-protocol";
import type { ReadabilityMetrics, StyleIssue } from "@mythos/core";
import { executeAnalyzeContent } from "../../services/ai/agentRuntimeClient";
import {
  resolveTextFromContext,
  type ToolDefinition,
  type ToolExecutionResult,
} from "../types";

export interface AnalyzeContentExecutionResult {
  mode: AnalyzeContentMode;
  summary?: string;
  issuesFound?: number;
  entitiesDetected?: number;
}

const MODE_LABELS: Record<AnalyzeContentMode, string> = {
  consistency: "Check consistency",
  entities: "Detect entities",
  logic: "Check logic",
  clarity: "Check clarity",
  policy: "Check policy",
};

export const analyzeContentExecutor: ToolDefinition<
  AnalyzeContentArgs,
  AnalyzeContentExecutionResult
> = {
  toolName: "analyze_content",
  label: "Analyze Content",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const scope = args.scope ?? "document";
    const focus = args.options?.focus?.length
      ? ` (${args.options.focus.join(", ")})`
      : "";
    const label = MODE_LABELS[args.mode] ?? "Analyze";
    return `${label} ${scope}${focus}`.trim();
  },

  validate: (_args) => ({ valid: true }),

  execute: async (args, ctx): Promise<ToolExecutionResult<AnalyzeContentExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for analysis" };
    }

    const textResult = resolveTextFromContext(
      { text: args.text, scope: args.scope },
      ctx,
      `${args.mode} analysis`
    );
    if (!textResult.success) {
      return { success: false, error: textResult.error };
    }

    const options = { ...args.options };

    if (args.mode === "consistency" && !options.entities) {
      options.entities = Array.from(ctx.entities.values()).map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        properties: e.properties,
      }));
    }

    if (args.mode === "logic" && (!options.magicSystems || !options.characters)) {
      if (!options.magicSystems) {
        options.magicSystems = Array.from(ctx.entities.values())
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
      }

      if (!options.characters) {
        options.characters = Array.from(ctx.entities.values())
          .filter((e) => e.type === "character")
          .map((e) => {
            const props = e.properties ?? {};
            return {
              id: e.id,
              name: e.name,
              powerLevel: (props["powerLevel"] as number) ?? undefined,
              knowledge: (props["knowledge"] as string[]) ?? undefined,
            };
          });
      }
    }

    try {
      ctx.onProgress?.({ stage: "Analyzing...", pct: 20 });

      const result = await executeAnalyzeContent(
        {
          mode: args.mode,
          text: textResult.text,
          scope: args.scope,
          options,
        },
        { apiKey: ctx.apiKey, signal: ctx.signal, projectId: ctx.projectId }
      );

      if (result.mode !== args.mode) {
        return { success: false, error: "Analysis returned an unexpected result" };
      }

      ctx.onProgress?.({ stage: "Processing results...", pct: 80 });

      if (result.mode === "entities") {
        if (result.entities.length > 0) {
          ctx.setDetectedEntities?.(result.entities);
          ctx.showEntitySuggestionModal?.(result.entities);
        }

        ctx.onProgress?.({ stage: "Complete!", pct: 100 });

        return {
          success: true,
          result: {
            mode: "entities",
            summary: result.summary,
            entitiesDetected: result.entities.length,
          },
        };
      }

      const issues = Array.isArray(result.issues) ? result.issues : [];

      if (result.mode === "consistency") {
        if (issues.length > 0) {
          ctx.setLinterIssues?.(issues as unknown[]);
          ctx.setActiveTab?.("linter");
        }

        ctx.onProgress?.({ stage: "Complete!", pct: 100 });

        return {
          success: true,
          result: {
            mode: "consistency",
            summary: result.summary,
            issuesFound: issues.length,
          },
          artifacts: [],
        };
      }

      if (result.mode === "logic") {
        const rawIssues = (result.stats as { rawIssues?: unknown[] } | undefined)?.rawIssues ?? [];
        if (rawIssues.length > 0) {
          const linterIssues = (rawIssues as Array<Record<string, unknown>>).map((issue) => ({
            id: issue["id"] as string,
            type: issue["type"] as "contradiction" | "timeline" | "character" | "world" | "plot_hole",
            severity: issue["severity"] as "error" | "warning" | "info",
            message: issue["violatedRule"]
              ? `${issue["message"]}\n\nViolated rule: "${(issue["violatedRule"] as { ruleText?: string }).ruleText}" (${(issue["violatedRule"] as { sourceEntityName?: string; source?: string }).sourceEntityName || (issue["violatedRule"] as { sourceEntityName?: string; source?: string }).source})`
              : (issue["message"] as string),
            suggestion: issue["suggestion"] as string | undefined,
            locations: issue["locations"] as unknown[] | undefined,
            entityIds: issue["entityIds"] as string[] | undefined,
          }));
          ctx.setLinterIssues?.(linterIssues);
          ctx.setActiveTab?.("linter");
        }

        ctx.onProgress?.({ stage: "Complete!", pct: 100 });

        return {
          success: true,
          result: {
            mode: "logic",
            summary: result.summary,
            issuesFound: rawIssues.length,
          },
        };
      }

      if (result.mode === "clarity") {
        const clarityIssues = (result.stats as { rawIssues?: unknown[] } | undefined)?.rawIssues ?? [];
        const metrics = (result.stats as { readability?: unknown } | undefined)?.readability;

        if (ctx.setClarityIssues) {
          const styleIssues = (clarityIssues as Array<Record<string, unknown>>).map((issue) => ({
            id: issue["id"] as string,
            type: issue["type"] as "ambiguous_pronoun" | "unclear_antecedent" | "cliche" | "filler_word" | "dangling_modifier",
            text: issue["text"] as string,
            line: issue["line"] as number | undefined,
            position: issue["position"] as { start: number; end: number } | undefined,
            suggestion: issue["suggestion"] as string,
            fix: issue["fix"] as { oldText: string; newText: string } | undefined,
          }));
          ctx.setClarityIssues(styleIssues as StyleIssue[]);
        }

        if (ctx.setReadabilityMetrics && metrics) {
          ctx.setReadabilityMetrics(metrics as ReadabilityMetrics);
        }

        ctx.setActiveTab?.("coach");

        ctx.onProgress?.({ stage: "Complete!", pct: 100 });

        return {
          success: true,
          result: {
            mode: "clarity",
            summary: result.summary,
            issuesFound: clarityIssues.length,
          },
        };
      }

      ctx.onProgress?.({ stage: "Complete!", pct: 100 });

      return {
        success: true,
        result: {
          mode: "policy",
          summary: result.summary,
          issuesFound: issues.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Analysis failed",
      };
    }
  },
};
