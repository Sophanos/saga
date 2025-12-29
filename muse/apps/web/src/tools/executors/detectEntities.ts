/**
 * detect_entities tool executor
 *
 * Detects entities in text and presents them for user review.
 */

import type { DetectEntitiesArgs } from "@mythos/agent-protocol";
import { executeDetectEntities } from "../../services/ai/sagaClient";
import type { ToolDefinition, ToolExecutionResult } from "../types";

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
    let text = args.text;
    if (!text) {
      if (args.scope === "selection") {
        text = ctx.getSelectionText?.();
      } else {
        text = ctx.getDocumentText?.();
      }
    }

    if (!text) {
      return { success: false, error: "No text available for entity detection" };
    }

    try {
      ctx.onProgress?.({ stage: "Analyzing text...", pct: 20 });

      const result = await executeDetectEntities(
        { ...args, text },
        { apiKey: ctx.apiKey, signal: ctx.signal }
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
