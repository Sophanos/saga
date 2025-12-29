/**
 * detect_entities tool definition
 *
 * Proposes detecting and extracting entities from narrative text.
 * Actual execution happens in ai-saga execute_tool path.
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { entityTypeSchema, analysisScopeSchema, type ToolExecuteResult } from "./types.ts";

export const detectEntitiesParameters = z.object({
  scope: analysisScopeSchema
    .optional()
    .describe("Scope of detection: selection, document, or project"),
  text: z
    .string()
    .optional()
    .describe("Text to analyze (optional - client supplies at execution if scope-based)"),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Minimum confidence threshold (0-1, default 0.7)"),
  maxEntities: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of entities to return (default 50)"),
  entityTypes: z
    .array(entityTypeSchema)
    .optional()
    .describe("Filter to specific entity types (e.g., ['character', 'location'])"),
});

export type DetectEntitiesArgs = z.infer<typeof detectEntitiesParameters>;

export const detectEntitiesTool = tool({
  description:
    "Propose detecting and extracting entities (characters, locations, items, etc.) from narrative text",
  inputSchema: detectEntitiesParameters,
  execute: async (args) => {
    const scopeDesc = args.scope || "document";
    const typeFilter = args.entityTypes?.length
      ? ` (filtering: ${args.entityTypes.join(", ")})`
      : "";
    return {
      toolName: "detect_entities",
      proposal: args,
      message: `Proposed entity detection on ${scopeDesc}${typeFilter}`,
    } as ToolExecuteResult;
  },
});
