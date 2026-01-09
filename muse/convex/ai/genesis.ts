/**
 * Genesis World Action
 *
 * AI-powered world generation with optional persistence to database.
 * Migrated from Supabase Edge Function with enhanced prompts.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  GENESIS_SYSTEM_PROMPT,
  buildGenesisUserPrompt,
  type GenesisPromptInput,
} from "./prompts/genesis";

// ============================================================
// Constants
// ============================================================

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

// ============================================================
// Types
// ============================================================

export const GENESIS_ENTITY_TYPES = [
  "character",
  "location",
  "item",
  "faction",
  "magic_system",
] as const;

export type GenesisEntityType = (typeof GENESIS_ENTITY_TYPES)[number];

export interface GeneratedEntity {
  name: string;
  type: GenesisEntityType;
  description: string;
  properties?: Record<string, string | number | boolean>;
  relationships?: Array<{
    targetName: string;
    type: string;
    description?: string;
  }>;
}

export interface GenesisOutlineSection {
  title: string;
  summary: string;
}

export interface GenesisResult {
  entities: GeneratedEntity[];
  worldSummary: string;
  suggestedTitle?: string;
  outline?: GenesisOutlineSection[];
}

// Legacy format for backward compatibility
export interface LegacyGenesisResult {
  world: {
    name: string;
    description: string;
    genre: string;
    themes: string[];
  };
  entities: Array<{
    name: string;
    type: string;
    description: string;
    properties: Record<string, unknown>;
  }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    description: string;
  }>;
}

export interface PersistGenesisOutput {
  success: boolean;
  entitiesCreated: number;
  relationshipsCreated: number;
  entityIdMap: Record<string, string>;
  errors: string[];
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Normalize AI-generated entity types to valid schema types
 */
function normalizeEntityType(type: string): GenesisEntityType {
  const typeMap: Record<string, GenesisEntityType> = {
    character: "character",
    person: "character",
    protagonist: "character",
    antagonist: "character",
    npc: "character",
    location: "location",
    place: "location",
    setting: "location",
    area: "location",
    region: "location",
    item: "item",
    object: "item",
    artifact: "item",
    weapon: "item",
    tool: "item",
    faction: "faction",
    organization: "faction",
    group: "faction",
    guild: "faction",
    clan: "faction",
    magic_system: "magic_system",
    magic: "magic_system",
    power: "magic_system",
    ability: "magic_system",
  };
  return typeMap[type.toLowerCase()] ?? "item";
}

/**
 * Normalize AI-generated relationship types to schema types
 */
function normalizeRelationType(type: string): string {
  const typeMap: Record<string, string> = {
    ally: "allied_with",
    allies: "allied_with",
    allied: "allied_with",
    friend: "allied_with",
    enemy: "enemy_of",
    enemies: "enemy_of",
    rival: "enemy_of",
    parent: "parent_of",
    father: "parent_of",
    mother: "parent_of",
    child: "child_of",
    son: "child_of",
    daughter: "child_of",
    sibling: "sibling_of",
    brother: "sibling_of",
    sister: "sibling_of",
    spouse: "married_to",
    husband: "married_to",
    wife: "married_to",
    owns: "owns",
    possesses: "owns",
    has: "owns",
    member: "member_of",
    belongs_to: "member_of",
    leads: "rules",
    commands: "rules",
    ruler: "rules",
    serves: "serves",
    works_for: "serves",
    created: "created",
    creator: "created",
    made: "created",
    knows: "knows",
    knows_of: "knows",
    located_in: "knows",
    lives_in: "knows",
    works_at: "knows",
  };
  return typeMap[type.toLowerCase()] ?? "knows";
}

/**
 * Default result when generation fails
 */
function getDefaultGenesisResult(): GenesisResult {
  return {
    entities: [],
    worldSummary: "Unable to generate world. Please try again with a different prompt.",
    suggestedTitle: undefined,
    outline: undefined,
  };
}

/**
 * Validate and normalize entities from AI response
 */
function validateEntities(rawEntities: unknown[]): GeneratedEntity[] {
  if (!Array.isArray(rawEntities)) return [];

  return rawEntities
    .filter((e): e is Record<string, unknown> => e !== null && typeof e === "object")
    .map((e) => ({
      name: String(e["name"] || "Unnamed Entity"),
      type: normalizeEntityType(String(e["type"] || "item")),
      description: String(e["description"] || ""),
      properties:
        e["properties"] && typeof e["properties"] === "object"
          ? (e["properties"] as Record<string, string | number | boolean>)
          : undefined,
      relationships: Array.isArray(e["relationships"])
        ? (e["relationships"] as unknown[])
            .filter((r): r is Record<string, unknown> => r !== null && typeof r === "object")
            .map((r) => ({
              targetName: String(r["targetName"] || ""),
              type: String(r["type"] || "knows"),
              description: r["description"] ? String(r["description"]) : undefined,
            }))
        : undefined,
    }));
}

/**
 * Validate outline sections from AI response
 */
function validateOutline(rawOutline: unknown): GenesisOutlineSection[] | undefined {
  if (!Array.isArray(rawOutline)) return undefined;

  const sections = rawOutline
    .filter((s): s is Record<string, unknown> => s !== null && typeof s === "object")
    .map((s) => ({
      title: String(s["title"] || "Untitled Section"),
      summary: String(s["summary"] || ""),
    }));

  return sections.length > 0 ? sections : undefined;
}

/**
 * Convert GenesisResult to legacy format for backward compatibility
 */
function toLegacyFormat(result: GenesisResult, genre: string): LegacyGenesisResult {
  // Extract themes from world summary
  const themes = result.worldSummary
    .split(/[.,;]/)
    .slice(0, 3)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length < 50);

  // Flatten relationships from entities
  const relationships: LegacyGenesisResult["relationships"] = [];
  for (const entity of result.entities) {
    if (entity.relationships) {
      for (const rel of entity.relationships) {
        relationships.push({
          source: entity.name,
          target: rel.targetName,
          type: rel.type,
          description: rel.description || "",
        });
      }
    }
  }

  return {
    world: {
      name: result.suggestedTitle || "Generated World",
      description: result.worldSummary,
      genre,
      themes: themes.length > 0 ? themes : ["adventure", "conflict", "discovery"],
    },
    entities: result.entities.map((e) => ({
      name: e.name,
      type: e.type,
      description: e.description,
      properties: e.properties || {},
    })),
    relationships,
  };
}

// ============================================================
// Main Actions
// ============================================================

/**
 * Generate a story world using AI
 */
export const runGenesis = internalAction({
  args: {
    prompt: v.string(),
    genre: v.optional(v.string()),
    entityCount: v.optional(v.number()),
    detailLevel: v.optional(
      v.union(v.literal("minimal"), v.literal("standard"), v.literal("detailed"))
    ),
    includeOutline: v.optional(v.boolean()),
  },
  handler: async (_ctx, args): Promise<GenesisResult> => {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      console.error("[genesis] OPENROUTER_API_KEY not configured");
      return getDefaultGenesisResult();
    }

    const promptInput: GenesisPromptInput = {
      prompt: args.prompt,
      genre: args.genre ?? "fantasy",
      entityCount: args.entityCount ?? 10,
      detailLevel: args.detailLevel ?? "standard",
      includeOutline: args.includeOutline ?? true,
    };

    const userPrompt = buildGenesisUserPrompt(promptInput);

    console.log("[genesis] Generating world", {
      genre: promptInput.genre,
      entityCount: promptInput.entityCount,
      detailLevel: promptInput.detailLevel,
    });

    try {
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
            { role: "system", content: GENESIS_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 8192,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[genesis] OpenRouter error: ${response.status} - ${errorText}`);
        return getDefaultGenesisResult();
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error("[genesis] No response content from AI");
        return getDefaultGenesisResult();
      }

      const parsed = JSON.parse(content);

      const result: GenesisResult = {
        entities: validateEntities(parsed.entities),
        worldSummary: String(parsed.worldSummary || "A newly generated story world."),
        suggestedTitle: parsed.suggestedTitle ? String(parsed.suggestedTitle) : undefined,
        outline: validateOutline(parsed.outline),
      };

      console.log("[genesis] Generated world", {
        entityCount: result.entities.length,
        hasOutline: !!result.outline,
        title: result.suggestedTitle,
      });

      return result;
    } catch (error) {
      console.error("[genesis] Generation failed:", error);
      return getDefaultGenesisResult();
    }
  },
});

/**
 * Generate world with legacy return format for backward compatibility
 */
export const runGenesisLegacy = internalAction({
  args: {
    prompt: v.string(),
    genre: v.optional(v.string()),
    entityCount: v.optional(v.number()),
    detailLevel: v.optional(
      v.union(v.literal("minimal"), v.literal("standard"), v.literal("detailed"))
    ),
  },
  handler: async (ctx, args): Promise<LegacyGenesisResult> => {
    const result = await ctx.runAction((internal as any)["ai/genesis"].runGenesis, {
      prompt: args.prompt,
      genre: args.genre,
      entityCount: args.entityCount,
      detailLevel: args.detailLevel,
      includeOutline: false,
    });

    return toLegacyFormat(result, args.genre ?? "fantasy");
  },
});

/**
 * Persist generated world to database
 */
export const persistGenesisWorld = internalAction({
  args: {
    projectId: v.id("projects"),
    result: v.any(),
    skipEntityTypes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<PersistGenesisOutput> => {
    const { projectId, result, skipEntityTypes = [] } = args;
    const entityIdMap: Record<string, string> = {};
    const errors: string[] = [];
    let entitiesCreated = 0;
    let relationshipsCreated = 0;

    const entities = result.entities as GeneratedEntity[];
    if (!Array.isArray(entities)) {
      return {
        success: false,
        entitiesCreated: 0,
        relationshipsCreated: 0,
        entityIdMap: {},
        errors: ["Invalid result: entities is not an array"],
      };
    }

    console.log("[genesis.persist] Starting persistence", {
      projectId,
      entityCount: entities.length,
      skipEntityTypes,
    });

    // Phase 1: Create all entities first
    for (const entity of entities) {
      if (skipEntityTypes.includes(entity.type)) {
        console.log(`[genesis.persist] Skipping entity type: ${entity.type}`);
        continue;
      }

      try {
        // Check if entity already exists
        const existing = await ctx.runQuery(
          (internal as any)["ai/tools/worldGraphHandlers"].findEntityByName,
          { projectId, name: entity.name, type: entity.type }
        );

        if (existing) {
          entityIdMap[entity.name] = existing._id;
          console.log(`[genesis.persist] Entity exists: ${entity.name}`);
          continue;
        }

        // Create entity
        const entityId = await ctx.runMutation(
          (internal as any)["ai/tools/worldGraphHandlers"].createEntityMutation,
          {
            projectId,
            type: entity.type,
            name: entity.name,
            properties: {
              ...(entity.properties || {}),
              generatedBy: "genesis",
            },
            notes: entity.description,
          }
        );

        entityIdMap[entity.name] = entityId;
        entitiesCreated++;
        console.log(`[genesis.persist] Created entity: ${entity.name}`);
      } catch (error) {
        const errorMsg = `Failed to create entity "${entity.name}": ${error}`;
        console.error(`[genesis.persist] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    // Phase 2: Create relationships using ID map
    for (const entity of entities) {
      if (!entity.relationships) continue;

      for (const rel of entity.relationships) {
        const sourceId = entityIdMap[entity.name];
        const targetId = entityIdMap[rel.targetName];

        if (!sourceId || !targetId) {
          const errorMsg = `Cannot create relationship: missing entity ID for "${entity.name}" or "${rel.targetName}"`;
          console.warn(`[genesis.persist] ${errorMsg}`);
          errors.push(errorMsg);
          continue;
        }

        try {
          // Check if relationship exists
          const existing = await ctx.runQuery(
            (internal as any)["ai/tools/worldGraphHandlers"].findRelationship,
            {
              projectId,
              sourceId: sourceId as Id<"entities">,
              targetId: targetId as Id<"entities">,
              type: normalizeRelationType(rel.type),
            }
          );

          if (existing) {
            console.log(
              `[genesis.persist] Relationship exists: ${entity.name} -> ${rel.targetName}`
            );
            continue;
          }

          await ctx.runMutation(
            (internal as any)["ai/tools/worldGraphHandlers"].createRelationshipMutation,
            {
              projectId,
              sourceId: sourceId as Id<"entities">,
              targetId: targetId as Id<"entities">,
              type: normalizeRelationType(rel.type),
              notes: rel.description,
            }
          );

          relationshipsCreated++;
          console.log(`[genesis.persist] Created relationship: ${entity.name} -> ${rel.targetName}`);
        } catch (error) {
          const errorMsg = `Failed to create relationship "${entity.name}" -> "${rel.targetName}": ${error}`;
          console.error(`[genesis.persist] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    console.log("[genesis.persist] Persistence complete", {
      entitiesCreated,
      relationshipsCreated,
      errorCount: errors.length,
    });

    return {
      success: errors.length === 0,
      entitiesCreated,
      relationshipsCreated,
      entityIdMap,
      errors,
    };
  },
});
