/**
 * AI Style Learning Action
 *
 * Analyzes document content to extract writing style preferences.
 * Derived preferences are stored as "style" memories.
 * Migrated from Supabase Edge Function.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateEmbedding } from "../lib/embeddings";
import { upsertPoints } from "../lib/qdrant";
import { getModelForTaskSync, checkTaskAccess, type TierId } from "../lib/providers";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MAX_FINDINGS = 8;
const MIN_CONTENT_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;
const STYLE_MEMORY_TTL_DAYS = 180;

const STYLE_EXTRACTION_PROMPT = `You are analyzing a piece of creative writing to extract the author's style preferences.

Identify specific, actionable writing style patterns. Focus on:
- Sentence structure preferences (length, complexity)
- Dialogue style (punctuation, attribution patterns)
- Description density and focus
- Pacing and rhythm
- Voice and tone characteristics
- POV handling
- Tense usage patterns
- Any distinctive stylistic choices

Output a JSON array of short, specific rules (1-2 sentences each). Each rule should be:
- Observable in this specific text
- Actionable for future writing
- Specific (avoid generic advice)

Format: ["rule 1", "rule 2", ...]

Example output:
["Prefers short, punchy sentences during action scenes", "Uses em-dashes for interruptions in dialogue", "Describes settings through character perception rather than omniscient narration"]

IMPORTANT: Output ONLY the JSON array, no other text.`;

interface StyleFinding {
  id: string;
  content: string;
}

interface LearnStyleResult {
  learned: StyleFinding[];
  processingTimeMs: number;
}

interface OpenRouterResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function generateStyleId(projectId: string, userId: string, rule: string): Promise<string> {
  const normalized = rule.toLowerCase().trim().replace(/\s+/g, " ");
  const input = `${projectId}:${userId}:style:${normalized}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex.slice(0, 32);
}

function parseStyleRules(response: string): string[] {
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn("[ai/style] No JSON array found in response");
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      console.warn("[ai/style] Parsed result is not an array");
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length < 500);
  } catch (error) {
    console.error("[ai/style] Failed to parse JSON:", error);
    return [];
  }
}

export const getExistingStyleMemory = internalQuery({
  args: {
    projectId: v.id("projects"),
    vectorId: v.string(),
  },
  handler: async (ctx, { projectId, vectorId }) => {
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_type", (q) =>
        q.eq("projectId", projectId).eq("type", "style")
      )
      .filter((q) => q.eq(q.field("vectorId"), vectorId))
      .first();
    return memories;
  },
});

export const upsertStyleMemory = internalMutation({
  args: {
    projectId: v.id("projects"),
    vectorId: v.string(),
    userId: v.string(),
    text: v.string(),
    documentId: v.optional(v.id("documents")),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query("memories")
      .withIndex("by_type", (q) =>
        q.eq("projectId", args.projectId).eq("type", "style")
      )
      .filter((q) => q.eq(q.field("vectorId"), args.vectorId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        text: args.text,
        updatedAt: now,
        expiresAt: args.expiresAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("memories", {
      projectId: args.projectId,
      userId: args.userId,
      text: args.text,
      type: "style",
      confidence: 0.8,
      source: "agent",
      documentId: args.documentId,
      pinned: false,
      vectorId: args.vectorId,
      createdAt: now,
      updatedAt: now,
      expiresAt: args.expiresAt,
    });
  },
});

export const learnStyle = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    documentId: v.string(),
    content: v.string(),
    maxFindings: v.optional(v.number()),
    tierId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<LearnStyleResult> => {
    const { projectId, userId, documentId, content } = args;
    const tierId = (args.tierId as TierId) ?? "free";
    const startTime = Date.now();

    // Check tier access
    const access = checkTaskAccess("style", tierId);
    if (!access.allowed) {
      return {
        learned: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    if (content.length < MIN_CONTENT_LENGTH) {
      return {
        learned: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    const truncatedContent = content.slice(0, MAX_CONTENT_LENGTH);

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const model = getModelForTaskSync("style", tierId);
    const maxFindings = Math.min(Math.max(1, args.maxFindings ?? DEFAULT_MAX_FINDINGS), 20);

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
          { role: "system", content: STYLE_EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Analyze this text and extract up to ${maxFindings} style rules:\n\n${truncatedContent.slice(0, 20000)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    const responseContent = data.choices[0]?.message?.content ?? "";
    const rules = parseStyleRules(responseContent);
    console.log(`[ai/style] Extracted ${rules.length} style rules`);

    if (rules.length === 0) {
      return {
        learned: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    const selectedRules = rules.slice(0, maxFindings);
    const learned: StyleFinding[] = [];
    const expiresAt = Date.now() + STYLE_MEMORY_TTL_DAYS * 24 * 60 * 60 * 1000;

    for (const rule of selectedRules) {
      const vectorId = await generateStyleId(projectId, userId, rule);

      try {
        const embedding = await generateEmbedding(rule);

        await ctx.runMutation((internal as any)["ai/style"].upsertStyleMemory, {
          projectId: projectId as Id<"projects">,
          vectorId,
          userId,
          text: rule,
          documentId: documentId as Id<"documents"> | undefined,
          expiresAt,
        });

        try {
          await upsertPoints([
            {
              id: vectorId,
              vector: embedding,
              payload: {
                type: "memory",
                project_id: projectId,
                memory_type: "style",
                user_id: userId,
                text: rule,
                source: "agent",
                confidence: 0.8,
                document_id: documentId,
                created_at: new Date().toISOString(),
              },
            },
          ]);
        } catch (qdrantError) {
          console.warn("[ai/style] Qdrant sync failed (non-fatal):", qdrantError);
        }

        learned.push({
          id: vectorId,
          content: rule,
        });
      } catch (error) {
        console.error(`[ai/style] Failed to process rule: ${rule}`, error);
      }
    }

    await ctx.runMutation(internal.aiUsage.trackUsage, {
      userId,
      projectId,
      endpoint: "style",
      model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      billingMode: "managed",
      latencyMs: Date.now() - startTime,
      success: true,
    });

    return {
      learned,
      processingTimeMs: Date.now() - startTime,
    };
  },
});
