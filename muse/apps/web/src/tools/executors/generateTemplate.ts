/**
 * generate_template tool executor
 *
 * Generates a custom project template from story description.
 */

import type { GenerateTemplateArgs } from "@mythos/agent-protocol";
import { executeGenerateTemplate } from "../../services/ai/sagaClient";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export interface GenerateTemplateExecutionResult {
  templateName: string;
  entityKindCount: number;
  relationshipKindCount: number;
  linterRuleCount: number;
  hasStarterEntities: boolean;
}

export const generateTemplateExecutor: ToolDefinition<GenerateTemplateArgs, GenerateTemplateExecutionResult> = {
  toolName: "generate_template",
  label: "Generate Template",
  requiresConfirmation: true,
  danger: "costly",

  renderSummary: (args) => {
    const preview =
      args.storyDescription.length > 50
        ? args.storyDescription.slice(0, 50) + "..."
        : args.storyDescription;
    const genres = args.genreHints?.length ? ` (${args.genreHints.join(", ")})` : "";
    return `Template: "${preview}"${genres}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<GenerateTemplateExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for template generation" };
    }

    try {
      ctx.onProgress?.({ stage: "Analyzing story structure...", pct: 20 });

      const result = await executeGenerateTemplate(args, {
        apiKey: ctx.apiKey,
        signal: ctx.signal,
        projectId: ctx.projectId,
      });

      ctx.onProgress?.({ stage: "Building template...", pct: 70 });

      // Store template draft for user review
      ctx.setTemplateDraft?.(result);

      ctx.onProgress?.({ stage: "Complete!", pct: 100 });

      return {
        success: true,
        result: {
          templateName: result.template.name,
          entityKindCount: result.template.entityKinds.length,
          relationshipKindCount: result.template.relationshipKinds.length,
          linterRuleCount: result.template.linterRules.length,
          hasStarterEntities: (result.suggestedStarterEntities?.length ?? 0) > 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate template",
      };
    }
  },
};
