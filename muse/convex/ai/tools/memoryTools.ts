/**
 * Memory tools for the Saga agent.
 *
 * These tools intentionally omit handlers so the client can collect
 * human approval and submit tool results before continuing generation.
 */

import { tool } from "ai";
import { z } from "zod";

export const commitDecisionTool = tool({
  description: "Propose a canon decision to store in project memory (requires approval).",
  inputSchema: z.object({
    decision: z.string().describe("Canonical decision statement"),
    category: z.enum(["decision", "policy"]).optional().describe("Decision category"),
    rationale: z.string().optional().describe("Optional rationale/evidence"),
    entityIds: z.array(z.string()).optional().describe("Related entity IDs"),
    documentId: z.string().optional().describe("Source document ID"),
    confidence: z.number().min(0).max(1).optional().describe("Confidence score (0-1)"),
    pinned: z.boolean().optional().describe("Pin decision as canon (default true on server)"),
  }),
});

