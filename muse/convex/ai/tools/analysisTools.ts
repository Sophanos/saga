/**
 * Analysis Tools - Content analysis for entities, consistency, logic, clarity, and policy.
 */

import { tool } from "ai";
import { z } from "zod";

const analyzeContentModeSchema = z.enum([
  "consistency",
  "entities",
  "logic",
  "clarity",
  "policy",
]);

const strictnessSchema = z.enum(["strict", "balanced", "lenient"]);

export const analyzeContentParameters = z.object({
  mode: analyzeContentModeSchema.describe("Which analysis mode to run"),
  text: z.string().describe("Text to analyze"),
  options: z
    .object({
      focus: z.array(z.string()).optional().describe("Optional focus labels"),
      strictness: strictnessSchema.optional().describe("Strictness level for logic checks"),
      maxIssues: z.number().min(1).max(200).optional().describe("Maximum issues to return"),
      entityTypes: z.array(z.string()).optional().describe("Entity type filters for detection"),
      minConfidence: z.number().min(0).max(1).optional().describe("Minimum confidence for detection"),
    })
    .optional(),
});

export type AnalyzeContentArgs = z.infer<typeof analyzeContentParameters>;

export const analyzeContentTool = tool({
  description:
    "Analyze content for entities, consistency, logic, clarity, or policy issues. Returns structured issues or detected entities.",
  inputSchema: analyzeContentParameters,
});
