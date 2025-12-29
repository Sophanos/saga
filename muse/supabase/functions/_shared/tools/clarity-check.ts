/**
 * clarity_check tool definition
 *
 * Proposes checking prose for word/phrase-level clarity issues.
 * Actual execution happens in ai-saga execute_tool path.
 */

import { tool } from "https://esm.sh/ai@4.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import { analysisScopeSchema, type ToolExecuteResult } from "./types.ts";

export const clarityCheckParameters = z.object({
  scope: analysisScopeSchema
    .optional()
    .describe("Scope of clarity check: selection, document, or project"),
  text: z
    .string()
    .optional()
    .describe("Text to analyze (optional - client supplies at execution if scope-based)"),
  maxIssues: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of issues to return (default 25)"),
});

export type ClarityCheckArgs = z.infer<typeof clarityCheckParameters>;

export const clarityCheckTool = tool({
  description:
    "Check prose for clarity issues including ambiguous pronouns, unclear antecedents, clichés, filler/weasel words, and dangling modifiers. Also computes readability metrics.",
  parameters: clarityCheckParameters,
  execute: async (args): Promise<ToolExecuteResult> => {
    const scopeDesc = args.scope || "document";
    return {
      toolName: "clarity_check",
      proposal: args,
      message: `Proposed clarity check on ${scopeDesc}`,
    };
  },
});
