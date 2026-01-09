/**
 * AI Coach Action
 *
 * Analyzes prose for writing quality using the WritingCoach agent.
 * Migrated from Supabase Edge Function.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { WRITING_COACH_SYSTEM, GENRE_COACH_CONTEXTS } from "./prompts/coach";
import { getModelForTaskSync, checkTaskAccess, type TierId } from "../lib/providers";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface StyleIssueFix {
  oldText: string;
  newText: string;
}

interface StyleIssue {
  type: "telling" | "passive" | "adverb" | "repetition";
  text: string;
  line?: number;
  position?: { start: number; end: number };
  suggestion: string;
  fix?: StyleIssueFix;
}

interface SceneMetrics {
  tension: number[];
  sensory: {
    sight: number;
    sound: number;
    touch: number;
    smell: number;
    taste: number;
  };
  pacing: "accelerating" | "steady" | "decelerating";
  mood: string;
  showDontTellScore: number;
  showDontTellGrade: string;
}

interface CoachResult {
  metrics: SceneMetrics;
  issues: StyleIssue[];
  insights: string[];
  stats?: {
    processingTimeMs: number;
    issueCount: number;
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
  genre?: string
): string {
  let prompt = "";

  if (genre && GENRE_COACH_CONTEXTS[genre]) {
    prompt += `${GENRE_COACH_CONTEXTS[genre]}\n\n`;
  }

  prompt += `## Document Content:\n${documentContent}`;

  if (entities && entities.length > 0) {
    prompt += `\n\n## Known Entities:\n${JSON.stringify(entities, null, 2)}`;
  }

  if (relationships && relationships.length > 0) {
    prompt += `\n\n## Relationships:\n${JSON.stringify(relationships, null, 2)}`;
  }

  return prompt;
}

function clampNumber(value: unknown, min: number, max: number, defaultValue: number): number {
  if (typeof value !== "number" || isNaN(value)) return defaultValue;
  return Math.max(min, Math.min(max, value));
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function getDefaultAnalysis(): CoachResult {
  return {
    metrics: {
      tension: [],
      sensory: { sight: 0, sound: 0, touch: 0, smell: 0, taste: 0 },
      pacing: "steady",
      mood: "neutral",
      showDontTellScore: 50,
      showDontTellGrade: "C",
    },
    issues: [],
    insights: ["Unable to analyze text. Please try again."],
  };
}

function validateMetrics(raw: unknown): SceneMetrics {
  const data = (raw as Record<string, unknown>) || {};

  let tension: number[] = [];
  const tensionData = data["tension"];
  if (Array.isArray(tensionData)) {
    tension = tensionData
      .filter((t): t is number => typeof t === "number")
      .map((t) => Math.max(0, Math.min(100, t)));
  }

  const rawSensory = (data["sensory"] as Record<string, unknown>) || {};
  const sensory = {
    sight: clampNumber(rawSensory["sight"], 0, 100, 0),
    sound: clampNumber(rawSensory["sound"], 0, 100, 0),
    touch: clampNumber(rawSensory["touch"], 0, 100, 0),
    smell: clampNumber(rawSensory["smell"], 0, 100, 0),
    taste: clampNumber(rawSensory["taste"], 0, 100, 0),
  };

  const validPacing = ["accelerating", "steady", "decelerating"] as const;
  const pacingData = data["pacing"];
  const pacing = validPacing.includes(pacingData as (typeof validPacing)[number])
    ? (pacingData as (typeof validPacing)[number])
    : "steady";

  const moodData = data["mood"];
  const mood = typeof moodData === "string" ? moodData : "neutral";

  const showDontTellScore = clampNumber(data["showDontTellScore"], 0, 100, 50);
  const validGrades = ["A", "B", "C", "D", "F"];
  const gradeData = data["showDontTellGrade"];
  const showDontTellGrade = validGrades.includes(gradeData as string)
    ? (gradeData as string)
    : scoreToGrade(showDontTellScore);

  return {
    tension,
    sensory,
    pacing,
    mood,
    showDontTellScore,
    showDontTellGrade,
  };
}

function validateIssues(raw: unknown): StyleIssue[] {
  if (!Array.isArray(raw)) return [];

  const validTypes = ["telling", "passive", "adverb", "repetition"] as const;

  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const typeData = item["type"];
      const textData = item["text"];
      const lineData = item["line"];
      const suggestionData = item["suggestion"];
      const positionData = item["position"] as Record<string, unknown> | undefined;
      const fixData = item["fix"] as Record<string, unknown> | undefined;

      let position: { start: number; end: number } | undefined;
      if (positionData && typeof positionData === "object") {
        const start = positionData["start"];
        const end = positionData["end"];
        if (typeof start === "number" && typeof end === "number") {
          position = { start, end };
        }
      }

      let fix: StyleIssueFix | undefined;
      if (fixData && typeof fixData === "object") {
        const oldText = fixData["oldText"];
        const newText = fixData["newText"];
        if (typeof oldText === "string" && typeof newText === "string") {
          fix = { oldText, newText };
        }
      }

      const text = typeof textData === "string" ? textData : "";
      const suggestion = typeof suggestionData === "string" ? suggestionData : "";

      if (!fix && text.length > 0 && suggestion.length > 0) {
        const quotedMatch = suggestion.match(/["']([^"']+)["']/);
        if (quotedMatch) {
          fix = { oldText: text, newText: quotedMatch[1] };
        }
      }

      return {
        type: validTypes.includes(typeData as (typeof validTypes)[number])
          ? (typeData as StyleIssue["type"])
          : "telling",
        text,
        line: typeof lineData === "number" ? lineData : undefined,
        position,
        suggestion,
        fix,
      };
    })
    .filter((issue) => issue.text.length > 0);
}

function validateInsights(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function parseResponse(response: string): CoachResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      return {
        metrics: validateMetrics(parsed["metrics"]),
        issues: validateIssues(parsed["issues"]),
        insights: validateInsights(parsed["insights"]),
      };
    }
  } catch (error) {
    console.error("[ai/coach] Failed to parse response:", error);
  }

  return getDefaultAnalysis();
}

export const runCoach = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    documentContent: v.string(),
    entities: v.optional(v.array(v.any())),
    relationships: v.optional(v.array(v.any())),
    genre: v.optional(v.string()),
    tierId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CoachResult> => {
    const { projectId, userId, documentContent, entities, relationships, genre } = args;
    const tierId = (args.tierId as TierId) ?? "free";
    const startTime = Date.now();

    // Check tier access
    const access = checkTaskAccess("coach", tierId);
    if (!access.allowed) {
      return getDefaultAnalysis();
    }

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const resolved = getModelForTaskSync("coach", tierId);
    const userPrompt = buildAnalysisPrompt(documentContent, entities, relationships, genre);

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
        "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
      },
      body: JSON.stringify({
        model: resolved.model,
        messages: [
          { role: "system", content: WRITING_COACH_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
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
    const analysis = parseResponse(content);

    await ctx.runMutation(internal.aiUsage.trackUsage, {
      userId,
      projectId: projectId as Id<"projects">,
      endpoint: "coach",
      model: resolved.model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      billingMode: "managed",
      latencyMs: processingTimeMs,
      success: true,
    });

    return {
      ...analysis,
      stats: {
        processingTimeMs,
        issueCount: analysis.issues.length,
      },
    };
  },
});

export const runCoachToStream = internalAction({
  args: {
    streamId: v.string(),
    projectId: v.string(),
    userId: v.string(),
    documentContent: v.string(),
    entities: v.optional(v.array(v.any())),
    relationships: v.optional(v.array(v.any())),
    genre: v.optional(v.string()),
    tierId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { streamId, projectId, userId, documentContent, entities, relationships, genre } = args;
    const tierId = (args.tierId as TierId) ?? "free";
    const startTime = Date.now();

    try {
      // Check tier access
      const access = checkTaskAccess("coach", tierId);
      if (!access.allowed) {
        await ctx.runMutation((internal as unknown as { "ai/streams": { fail: unknown } })["ai/streams"]["fail"] as typeof internal.aiUsage.trackUsage, {
          streamId,
          error: "Coach not available on current tier",
        } as never);
        return;
      }

      const apiKey = process.env["OPENROUTER_API_KEY"];
      if (!apiKey) {
        await ctx.runMutation((internal as unknown as { "ai/streams": { fail: unknown } })["ai/streams"]["fail"] as typeof internal.aiUsage.trackUsage, {
          streamId,
          error: "OPENROUTER_API_KEY not configured",
        } as never);
        return;
      }

      const resolved = getModelForTaskSync("coach", tierId);
      const userPrompt = buildAnalysisPrompt(documentContent, entities, relationships, genre);

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
          "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
        },
        body: JSON.stringify({
          model: resolved.model,
          messages: [
            { role: "system", content: WRITING_COACH_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
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
      const analysis = parseResponse(content);

      // Store result in stream
      await ctx.runMutation((internal as unknown as { "ai/streams": { appendChunk: unknown } })["ai/streams"]["appendChunk"] as typeof internal.aiUsage.trackUsage, {
        streamId,
        chunk: {
          type: "coach-result",
          content: "",
          data: {
            ...analysis,
            stats: {
              processingTimeMs,
              issueCount: analysis.issues.length,
            },
          },
        },
      } as never);

      await ctx.runMutation(internal.aiUsage.trackUsage, {
        userId,
        projectId: projectId as Id<"projects">,
        endpoint: "coach",
        model: resolved.model,
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
        billingMode: "managed",
        latencyMs: processingTimeMs,
        success: true,
      });

      await ctx.runMutation((internal as unknown as { "ai/streams": { complete: unknown } })["ai/streams"]["complete"] as typeof internal.aiUsage.trackUsage, {
        streamId,
      } as never);
    } catch (error) {
      console.error("[ai/coach] Error:", error);
      await ctx.runMutation((internal as unknown as { "ai/streams": { fail: unknown } })["ai/streams"]["fail"] as typeof internal.aiUsage.trackUsage, {
        streamId,
        error: error instanceof Error ? error.message : "Unknown error",
      } as never);
    }
  },
});
