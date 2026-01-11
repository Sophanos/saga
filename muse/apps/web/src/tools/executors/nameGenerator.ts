/**
 * name_generator tool executor
 *
 * Generates culturally-aware, genre-appropriate names.
 */

import type { NameGeneratorArgs, NameGeneratorResult } from "@mythos/agent-protocol";
import { executeNameGenerator } from "../../services/ai/agentRuntimeClient";
import type { ToolDefinition, ToolExecutionResult } from "../types";

export interface NameGeneratorExecutionResult {
  names: NameGeneratorResult["names"];
  count: number;
  genre?: string;
  culture?: string;
}

export const nameGeneratorExecutor: ToolDefinition<NameGeneratorArgs, NameGeneratorExecutionResult> = {
  toolName: "name_generator",
  label: "Generate Names",
  requiresConfirmation: false,
  danger: "safe",

  renderSummary: (args) => {
    const count = args.count ?? 10;
    const culture = args.culture ?? "any";
    const entityType = args.entityType;
    return `Generate ${count} ${culture} ${entityType} names`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<NameGeneratorExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for name generation" };
    }

    try {
      ctx.onProgress?.({ stage: "Generating names...", pct: 30 });

      // Get existing entity names to avoid duplicates
      const existingNames = Array.from(ctx.entities.values()).map((e) => e.name);
      const avoidNames = [...(args.avoid ?? []), ...existingNames];

      // Apply preferences for missing args
      const genre = args.genre ?? ctx.preferences?.preferredGenre ?? ctx.genre;
      const culture = args.culture ?? ctx.preferences?.namingCulture;
      const style = args.style ?? ctx.preferences?.namingStyle;

      const result = await executeNameGenerator(
        {
          ...args,
          genre,
          culture,
          style,
          avoid: avoidNames,
        },
        { apiKey: ctx.apiKey, signal: ctx.signal, projectId: ctx.projectId }
      );

      ctx.onProgress?.({ stage: "Complete!", pct: 100 });

      return {
        success: true,
        result: {
          names: result.names,
          count: result.names.length,
          genre: result.genre,
          culture: result.culture,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate names",
      };
    }
  },
};
