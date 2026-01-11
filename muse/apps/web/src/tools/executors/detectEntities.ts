/**
 * detect_entities tool executor
 *
 * Detects entities in text and presents them for user review.
 */

import type { DetectEntitiesArgs } from "@mythos/agent-protocol";
import { executeDetectEntities } from "../../services/ai/agentRuntimeClient";
import { resolveTextFromContext, type ToolDefinition, type ToolExecutionResult } from "../types";

export interface DetectEntitiesExecutionResult {
  entitiesDetected: number;
  warningCount: number;
}

export const detectEntitiesExecutor: ToolDefinition<DetectEntitiesArgs, DetectEntitiesExecutionResult> = {
  toolName: "detect_entities",
  label: "Detect Entities",
  requiresConfirmation: true,
  danger: "safe",

  renderSummary: (args) => {
    const scope = args.scope || "document";
    const types = args.entityTypes?.length
      ? ` (${args.entityTypes.join(", ")})`
      : "";
    return `Detect in ${scope}${types}`;
  },

  execute: async (args, ctx): Promise<ToolExecutionResult<DetectEntitiesExecutionResult>> => {
    if (!ctx.apiKey) {
      return { success: false, error: "API key required for entity detection" };
    }

    // Resolve text based on scope
    const textResult = resolveTextFromContext(args, ctx, "entity detection");
    if (!textResult.success) {
      return { success: false, error: textResult.error };
    }
    const { text } = textResult;

    try {
      ctx.onProgress?.({ stage: "Analyzing text...", pct: 20 });

      const result = await executeDetectEntities(
        { ...args, text },
        { apiKey: ctx.apiKey, signal: ctx.signal, projectId: ctx.projectId }
      );

      ctx.onProgress?.({ stage: "Processing results...", pct: 80 });

      // Store detected entities for review
      if (result.entities.length > 0) {
        ctx.setDetectedEntities?.(result.entities);
        ctx.showEntitySuggestionModal?.(result.entities);
      }

      ctx.onProgress?.({ stage: "Complete!", pct: 100 });

      return {
        success: true,
        result: {
          entitiesDetected: result.entities.length,
          warningCount: result.warnings?.length ?? 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to detect entities",
      };
    }
  },
};
