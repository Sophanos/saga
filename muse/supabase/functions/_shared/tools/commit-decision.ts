/**
 * commit_decision tool definition
 *
 * Records a canon decision into project memory (MLP 2.x decision category).
 */

import { tool } from "https://esm.sh/ai@6.0.0";
import { z } from "https://esm.sh/zod@3.25.28";
import type { ToolExecuteResult } from "./types.ts";

// =============================================================================
// Parameters Schema
// =============================================================================

export const commitDecisionParameters = z.object({
  /** The canon decision to record */
  decision: z.string().min(1).describe("The finalized decision to store as canon"),
  /** Optional rationale or evidence */
  rationale: z.string().optional().describe("Why this decision is true (evidence, rationale, source)"),
  /** Related entity IDs (if any) */
  entityIds: z.array(z.string()).optional().describe("Related entity IDs"),
  /** Source document ID (if applicable) */
  documentId: z.string().optional().describe("Document ID that establishes the decision"),
  /** Confidence level (0-1) */
  confidence: z.number().min(0).max(1).optional().describe("Confidence in this decision (0-1)"),
  /** Pin decision as canon (default true) */
  pinned: z.boolean().optional().describe("Pin this decision as canon"),
});

export type CommitDecisionArgs = z.infer<typeof commitDecisionParameters>;

// =============================================================================
// Tool Definition
// =============================================================================

async function commitDecisionNeedsApproval(): Promise<boolean> {
  return true; // Writes canon memory
}

export const commitDecisionTool = tool({
  description: `Commit a canon decision to project memory.

Use this when the author confirms a definitive fact about the story world.
Examples:
- "Marcus's eyes are brown."
- "The capital city is called Ashvale."
- "Magic stops working outside the valley."

Provide a short, unambiguous decision statement. Optionally add rationale or
evidence, and link relevant entities if known.`,
  inputSchema: commitDecisionParameters,
  needsApproval: commitDecisionNeedsApproval,
  execute: async (args) => {
    const preview = args.decision.length > 140
      ? `${args.decision.slice(0, 140)}...`
      : args.decision;

    return {
      toolName: "commit_decision",
      proposal: args,
      message: `Commit canon decision: "${preview}"`,
    } as ToolExecuteResult;
  },
});
