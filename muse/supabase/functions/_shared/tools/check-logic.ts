/**
 * check_logic tool definition
 *
 * Proposes checking narrative for logic violations:
 * - Magic rule violations
 * - Causality breaks
 * - Knowledge state violations
 * - Power scaling violations
 *
 * Actual execution happens in ai-saga execute_tool path.
 */

import { tool } from "https://esm.sh/ai@3.4.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  analysisScopeSchema,
  logicFocusSchema,
  logicStrictnessSchema,
  type ToolExecuteResult,
} from "./types.ts";

export const checkLogicParameters = z.object({
  scope: analysisScopeSchema
    .optional()
    .describe("Scope of logic check: selection, document, or project"),
  text: z
    .string()
    .optional()
    .describe("Text to analyze (optional - client supplies at execution if scope-based)"),
  focus: z
    .array(logicFocusSchema)
    .optional()
    .describe("Focus areas: magic_rules, causality, knowledge_state, power_scaling"),
  strictness: logicStrictnessSchema
    .optional()
    .describe("How strict the validation should be: strict, balanced, or lenient"),
});

export type CheckLogicArgs = z.infer<typeof checkLogicParameters>;

export const checkLogicTool = tool({
  description:
    "Validate story logic against explicit rules and world state. Checks for magic rule violations, causality breaks, knowledge state violations, and power scaling issues. Only flags issues based on explicitly defined rules, not inferred constraints.",
  parameters: checkLogicParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    const scopeDesc = args.scope || "document";
    const focusDesc = args.focus?.join(", ") || "all areas";
    return {
      toolName: "check_logic",
      proposal: args,
      message: `Proposed logic check on ${scopeDesc} focusing on ${focusDesc}`,
    };
  },
});
