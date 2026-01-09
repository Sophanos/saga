/**
 * AI Dynamics Action
 *
 * Extracts character interactions and events from prose using AI.
 * Migrated from Supabase Edge Function.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DYNAMICS_EXTRACTOR_SYSTEM } from "./prompts/dynamics";
import { getModelForTaskSync, checkTaskAccess, type TierId } from "../lib/providers";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

type InteractionType = "neutral" | "hostile" | "hidden" | "passive";

interface ExtractedInteraction {
  source: string;
  action: string;
  target: string;
  type: InteractionType;
  isHidden: boolean;
  isHostile: boolean;
  effect?: string;
  note?: string;
  sceneMarker?: string;
}

interface Interaction {
  id: string;
  source: string;
  action: string;
  target: string;
  type: InteractionType;
  time: string;
  effect?: string;
  note?: string;
  documentId?: string;
  createdAt: string;
}

interface DynamicsResult {
  interactions: Interaction[];
  summary: string;
  processingTimeMs: number;
}

interface OpenRouterResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function buildExtractionPrompt(
  content: string,
  sceneMarker?: string,
  knownEntities?: { id: string; name: string; type: string }[]
): string {
  let prompt = `## Prose Text to Analyze:\n${content}`;

  if (sceneMarker) {
    prompt += `\n\n## Current Scene: ${sceneMarker}`;
  }

  if (knownEntities && knownEntities.length > 0) {
    prompt += `\n\n## Known Entities:\n${JSON.stringify(knownEntities, null, 2)}`;
  }

  return prompt;
}

function generateInteractionId(interaction: ExtractedInteraction, index: number): string {
  const timestamp = Date.now();
  const source = interaction.source.toLowerCase().replace(/\s+/g, "_").slice(0, 10);
  const action = interaction.action.toLowerCase().slice(0, 5);
  return `int_${source}_${action}_${timestamp}_${index}`;
}

function buildNote(interaction: ExtractedInteraction): string | undefined {
  const parts: string[] = [];

  if (interaction.isHidden) {
    parts.push("[HIDDEN - DM Only]");
  }

  if (interaction.isHostile) {
    parts.push("[HOSTILE]");
  }

  if (interaction.note) {
    parts.push(interaction.note);
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}

function convertToInteractions(
  extracted: ExtractedInteraction[],
  documentId?: string,
  defaultSceneMarker?: string
): Interaction[] {
  const now = new Date().toISOString();

  return extracted.map((ext, index) => ({
    id: generateInteractionId(ext, index),
    source: ext.source,
    action: ext.action.toUpperCase(),
    target: ext.target,
    type: ext.type,
    time: ext.sceneMarker || defaultSceneMarker || "Sc 1",
    effect: ext.effect,
    note: buildNote(ext),
    documentId,
    createdAt: now,
  }));
}

function validateInteractionType(type: unknown): InteractionType {
  const validTypes: InteractionType[] = ["neutral", "hostile", "hidden", "passive"];
  if (typeof type === "string" && validTypes.includes(type as InteractionType)) {
    return type as InteractionType;
  }
  return "neutral";
}

function validateInteractions(raw: unknown): ExtractedInteraction[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      source: typeof item["source"] === "string" ? item["source"] : "Unknown",
      action: typeof item["action"] === "string" ? item["action"] : "UNKNOWN",
      target: typeof item["target"] === "string" ? item["target"] : "Unknown",
      type: validateInteractionType(item["type"]),
      isHidden: item["isHidden"] === true,
      isHostile: item["isHostile"] === true,
      effect: typeof item["effect"] === "string" ? item["effect"] : undefined,
      note: typeof item["note"] === "string" ? item["note"] : undefined,
      sceneMarker: typeof item["sceneMarker"] === "string" ? item["sceneMarker"] : undefined,
    }))
    .filter((interaction) => interaction.source && interaction.target);
}

function parseResponse(
  response: string,
  documentId: string | undefined,
  sceneMarker: string | undefined,
  processingTimeMs: number
): DynamicsResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      const extractedInteractions = validateInteractions(parsed["interactions"]);
      const interactions = convertToInteractions(extractedInteractions, documentId, sceneMarker);

      const summary =
        typeof parsed["summary"] === "string"
          ? parsed["summary"]
          : "Dynamics extracted successfully.";

      return {
        interactions,
        summary,
        processingTimeMs,
      };
    }
  } catch (error) {
    console.error("[ai/dynamics] Failed to parse response:", error);
  }

  return {
    interactions: [],
    summary: "Unable to extract dynamics. Please try again.",
    processingTimeMs,
  };
}

export const extractDynamics = internalAction({
  args: {
    projectId: v.string(),
    userId: v.string(),
    content: v.string(),
    sceneMarker: v.optional(v.string()),
    documentId: v.optional(v.string()),
    knownEntities: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          type: v.string(),
        })
      )
    ),
    tierId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<DynamicsResult> => {
    const { projectId, userId, content, sceneMarker, documentId, knownEntities } = args;
    const tierId = (args.tierId as TierId) ?? "free";
    const startTime = Date.now();

    // Check tier access (uses detect feature flag)
    const access = checkTaskAccess("dynamics", tierId);
    if (!access.allowed) {
      return {
        interactions: [],
        summary: "Dynamics extraction not available on current tier.",
        processingTimeMs: Date.now() - startTime,
      };
    }

    if (content.length < 50) {
      return {
        interactions: [],
        summary: "Content is too short for meaningful analysis.",
        processingTimeMs: Date.now() - startTime,
      };
    }

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const resolved = getModelForTaskSync("dynamics", tierId);
    const userPrompt = buildExtractionPrompt(content, sceneMarker, knownEntities);

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
          { role: "system", content: DYNAMICS_EXTRACTOR_SYSTEM },
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
    const responseContent = data.choices[0]?.message?.content ?? "";
    const dynamicsResult = parseResponse(responseContent, documentId, sceneMarker, processingTimeMs);

    await ctx.runMutation(internal.aiUsage.trackUsage, {
      userId,
      projectId: projectId as Id<"projects">,
      endpoint: "dynamics",
      model: resolved.model,
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
      billingMode: "managed",
      latencyMs: processingTimeMs,
      success: true,
    });

    return dynamicsResult;
  },
});
