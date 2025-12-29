/**
 * check_consistency tool definition
 *
 * Proposes checking narrative for contradictions and plot holes.
 * Actual execution happens in ai-saga execute_tool path.
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { analysisScopeSchema, consistencyFocusSchema, type ToolExecuteResult } from "./types.ts";

export const checkConsistencyParameters = z.object({
  scope: analysisScopeSchema
    .optional()
    .describe("Scope of consistency check: selection, document, or project"),
  text: z
    .string()
    .optional()
    .describe("Text to analyze (optional - client supplies at execution if scope-based)"),
  focus: z
    .array(consistencyFocusSchema)
    .optional()
    .describe("Focus areas: character, world, plot, timeline (default: all)"),
});

export type CheckConsistencyArgs = z.infer<typeof checkConsistencyParameters>;

export const checkConsistencyTool = tool({
  description:
    "Propose checking the narrative for consistency issues, contradictions, plot holes, and timeline errors",
  inputSchema: checkConsistencyParameters,
  execute: async (args) => {
    const scopeDesc = args.scope || "document";
    const focusDesc = args.focus?.length ? ` (focus: ${args.focus.join(", ")})` : "";
    return {
      toolName: "check_consistency",
      proposal: args,
      message: `Proposed consistency check on ${scopeDesc}${focusDesc}`,
    } as ToolExecuteResult;
  },
});
