/**
 * AI Lint Action
 *
 * Analyzes narrative content for consistency issues.
 * Migrated from Supabase Edge Function.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { CONSISTENCY_LINTER_SYSTEM } from "./prompts/linter";
import { getModelForTaskSync, checkTaskAccess, type TierId } from "../lib/providers";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface ConsistencyIssue {
  type: "character" | "world" | "plot" | "timeline";
  severity: "info" | "warning" | "error";
  location: { line: number; text: string };
  message: string;
  suggestion: string;
  relatedLocations?: { line: number; text: string }[];
  canonCitations?: { memoryId: string; excerpt?: string; reason?: string }[];
  isContradiction?: boolean;
  canonQuestion?: string;
  canonChoices?: {
    id: string;
    label: string;
    explanation: string;
    entityName?: string;
    propertyKey?: string;
    value?: string;
  }[];
  evidence?: { line: number; text: string }[];
}

interface LintResult {
  issues: ConsistencyIssue[];
  stats?: {
    processingTimeMs: number;
    issueCount: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

interface OpenRouterResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function buildAnalysisPrompt(
  documentContent: string,
  entities?: unknown[],
  relationships?: unknown[],
  canonDecisions?: string
): string {
  let prompt = `## Document Content:\n${documentContent}`;

  if (canonDecisions) {
    prompt += `\n\n## Canon Decisions (cite [M:...] tags when flagging contradictions):\n${canonDecisions}`;
  }

  if (entities && entities.length > 0) {
    prompt += `\n\n## Known Entities:\n${JSON.stringify(entities, null, 2)}`;
  }

  if (relationships && relationships.length > 0) {
    prompt += `\n\n## Relationships:\n${JSON.stringify(relationships, null, 2)}`;
  }

  return prompt;
}

function parseResponse(response: string): ConsistencyIssue[] {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { issues?: unknown[] };
      if (parsed.issues && Array.isArray(parsed.issues)) {
        return parsed.issues as ConsistencyIssue[];
      }
    }
  } catch (error) {
    console.error("[ai/lint] Failed to parse response:", error);
  }
  return [];
}

function computeStats(issues: ConsistencyIssue[], processingTimeMs: number): LintResult["stats"] {
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] ?? 0) + 1;
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
  }

  return {
    processingTimeMs,
    issueCount: issues.length,
    byType,
    bySeverity,
  };
}

export const runLint = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    documentContent: v.string(),
    entities: v.optional(v.array(v.any())),
    relationships: v.optional(v.array(v.any())),
    focus: v.optional(v.array(v.string())),
    tierId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<LintResult> => {
    const { projectId, userId, documentContent, entities, relationships } = args;
    const tierId = (args.tierId as TierId) ?? "free";
    const startTime = Date.now();

    // Check tier access
    const access = checkTaskAccess("lint", tierId);
    if (!access.allowed) {
      return {
        issues: [],
        stats: {
          processingTimeMs: 0,
          issueCount: 0,
          byType: {},
          bySeverity: {},
        },
      };
    }

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const model = getModelForTaskSync("lint", tierId);
    const userPrompt = buildAnalysisPrompt(documentContent, entities, relationships);

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
        "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: CONSISTENCY_LINTER_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const processingTimeMs = Date.now() - startTime;
    const content = data.choices[0]?.message?.content ?? "";
    const issues = parseResponse(content);

    await ctx.runMutation(internal.aiUsage.trackUsage, {
      userId,
      projectId: projectId as Id<"projects">,
      endpoint: "lint",
      model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      billingMode: "managed",
      latencyMs: processingTimeMs,
      success: true,
    });

    return {
      issues,
      stats: computeStats(issues, processingTimeMs),
    };
  },
});
