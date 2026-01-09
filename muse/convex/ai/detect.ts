/**
 * Entity Detection Action
 *
 * Detects story entities (characters, locations, items, etc.) from text.
 * Uses OpenRouter for LLM inference with structured output.
 *
 * Exports:
 * - detectEntitiesPublic: Public action callable from client via useAction
 * - detectEntities: Internal action for server-side use
 */

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";

// ============================================================
// Constants
// ============================================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

// ============================================================
// Types
// ============================================================

interface DetectedEntity {
  name: string;
  type: string;
  aliases: string[];
  confidence: number;
  properties: Record<string, unknown>;
  textSpan?: {
    start: number;
    end: number;
    text: string;
  };
}

interface DetectionResult {
  entities: DetectedEntity[];
  stats: {
    totalFound: number;
    byType: Record<string, number>;
  };
}

// ============================================================
// Entity Detection Action
// ============================================================

export const detectEntities = internalAction({
  args: {
    text: v.string(),
    projectId: v.string(),
    userId: v.string(),
    entityTypes: v.optional(v.array(v.string())),
    minConfidence: v.optional(v.number()),
  },
  handler: async (_, args): Promise<DetectionResult> => {
    const { text, entityTypes, minConfidence = 0.7 } = args;

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const typeFilter = entityTypes?.length
      ? `Focus on these entity types: ${entityTypes.join(", ")}`
      : "Detect all entity types: character, location, item, faction, magic_system, event, concept";

    const systemPrompt = `You are an entity detection system for fiction writing. Analyze the provided text and identify story entities.

${typeFilter}

For each entity found, provide:
- name: The primary name used in the text
- type: One of: character, location, item, faction, magic_system, event, concept
- aliases: Alternative names or titles mentioned
- confidence: How confident you are (0-1)
- properties: Type-specific properties (e.g., for characters: role, traits)

Respond with a JSON object containing an "entities" array.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://mythos.app",
        "X-Title": "Saga AI",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this text for entities:\n\n${text}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { entities: [], stats: { totalFound: 0, byType: {} } };
    }

    try {
      const parsed = JSON.parse(content);
      const entities: DetectedEntity[] = (parsed.entities || [])
        .filter((e: DetectedEntity) => e.confidence >= minConfidence);

      // Calculate stats
      const byType: Record<string, number> = {};
      for (const entity of entities) {
        byType[entity.type] = (byType[entity.type] || 0) + 1;
      }

      return {
        entities,
        stats: {
          totalFound: entities.length,
          byType,
        },
      };
    } catch (error) {
      console.error("[detect] Failed to parse response:", error);
      return { entities: [], stats: { totalFound: 0, byType: {} } };
    }
  },
});

// ============================================================
// Public Entity Detection Action (for client useAction)
// ============================================================

/**
 * Public action for entity detection, callable from client via useAction.
 * Handles authentication and delegates to the core detection logic.
 */
export const detectEntitiesPublic = action({
  args: {
    text: v.string(),
    projectId: v.id("projects"),
    entityTypes: v.optional(v.array(v.string())),
    minConfidence: v.optional(v.number()),
    detectAliases: v.optional(v.boolean()),
    matchExisting: v.optional(v.boolean()),
    maxEntities: v.optional(v.number()),
    includeContext: v.optional(v.boolean()),
    contextLength: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DetectionResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Authentication required");
    }

    const { text, entityTypes, minConfidence = 0.7 } = args;

    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY not configured");
    }

    const typeFilter = entityTypes?.length
      ? `Focus on these entity types: ${entityTypes.join(", ")}`
      : "Detect all entity types: character, location, item, faction, magic_system, event, concept";

    const systemPrompt = `You are an entity detection system for fiction writing. Analyze the provided text and identify story entities.

${typeFilter}

For each entity found, provide:
- name: The primary name used in the text
- type: One of: character, location, item, faction, magic_system, event, concept
- aliases: Alternative names or titles mentioned
- confidence: How confident you are (0-1)
- properties: Type-specific properties (e.g., for characters: role, traits)

Respond with a JSON object containing an "entities" array.`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://mythos.app",
        "X-Title": "Saga AI",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this text for entities:\n\n${text}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { entities: [], stats: { totalFound: 0, byType: {} } };
    }

    try {
      const parsed = JSON.parse(content);
      const entities: DetectedEntity[] = (parsed.entities || [])
        .filter((e: DetectedEntity) => e.confidence >= minConfidence);

      // Calculate stats
      const byType: Record<string, number> = {};
      for (const entity of entities) {
        byType[entity.type] = (byType[entity.type] || 0) + 1;
      }

      return {
        entities,
        stats: {
          totalFound: entities.length,
          byType,
        },
      };
    } catch (error) {
      console.error("[detect] Failed to parse response:", error);
      return { entities: [], stats: { totalFound: 0, byType: {} } };
    }
  },
});
