/**
 * Project Graph Tools - Entity/Relationship CRUD for the Saga agent.
 *
 * Tools for creating and updating entities and relationships in the Project Graph.
 * Handlers are in worldGraphHandlers.ts - these tool definitions intentionally
 * omit handlers so the client can collect human approval before execution.
 */

import { tool } from "ai";
import { z } from "zod";
import { needsToolApproval } from "../../lib/approvalConfig";
import { getWriterDefaultRegistry } from "../../lib/typeRegistry";
import { citationSchema } from "./citations";

const WRITER_REGISTRY = getWriterDefaultRegistry();

const entityTypeSchema = z.string();
const relationTypeSchema = z.string();

const itemCategorySchema = z.enum([
  "weapon",
  "armor",
  "artifact",
  "consumable",
  "key",
  "other",
]);

// =============================================================================
// Create Entity Tool
// =============================================================================

export const createEntityParameters = z.object({
  type: entityTypeSchema.describe("The type of entity to create"),
  name: z.string().describe("The name of the entity"),
  aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
  notes: z.string().optional().describe("General notes about the entity"),
  archetype: z.string().optional().describe("Character archetype (hero, mentor, shadow, etc.)"),
  backstory: z.string().optional().describe("Character's background story"),
  goals: z.array(z.string()).optional().describe("Character's goals and motivations"),
  fears: z.array(z.string()).optional().describe("Character's fears"),
  climate: z.string().optional().describe("Climate or weather of the location"),
  atmosphere: z.string().optional().describe("Mood and feeling of the place"),
  category: itemCategorySchema.optional().describe("Category of item"),
  abilities: z.array(z.string()).optional().describe("Special abilities or properties"),
  leader: z.string().optional().describe("Name of the faction leader"),
  headquarters: z.string().optional().describe("Main base or location"),
  factionGoals: z.array(z.string()).optional().describe("Faction's goals"),
  rules: z.array(z.string()).optional().describe("Rules of the magic system"),
  limitations: z.array(z.string()).optional().describe("Limitations and costs"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type CreateEntityArgs = z.infer<typeof createEntityParameters>;

export const createEntityTool = tool({
  description:
    "Create a new entity (character, location, item, faction, magic system, event, or concept) in the project graph. Some types require approval.",
  inputSchema: createEntityParameters,
});

export function createEntityNeedsApproval(args: CreateEntityArgs): boolean {
  return needsToolApproval(WRITER_REGISTRY, "create_entity", { type: args.type });
}

// =============================================================================
// Update Entity Tool
// =============================================================================

export const updateEntityParameters = z.object({
  entityName: z.string().describe("The current name of the entity to update"),
  entityType: entityTypeSchema.optional().describe("The type of entity (for disambiguation)"),
  updates: z
    .object({
      name: z.string().optional().describe("New name for the entity"),
      aliases: z.array(z.string()).optional().describe("Updated alternative names"),
      notes: z.string().optional().describe("Updated notes"),
      archetype: z.string().optional().describe("Updated archetype"),
      backstory: z.string().optional().describe("Updated backstory"),
      goals: z.array(z.string()).optional().describe("Updated goals"),
      fears: z.array(z.string()).optional().describe("Updated fears"),
      climate: z.string().optional().describe("Updated climate"),
      atmosphere: z.string().optional().describe("Updated atmosphere"),
      category: itemCategorySchema.optional().describe("Updated category"),
      abilities: z.array(z.string()).optional().describe("Updated abilities"),
      leader: z.string().optional().describe("Updated leader"),
      headquarters: z.string().optional().describe("Updated headquarters"),
      factionGoals: z.array(z.string()).optional().describe("Updated faction goals"),
      rules: z.array(z.string()).optional().describe("Updated rules"),
      limitations: z.array(z.string()).optional().describe("Updated limitations"),
    })
    .describe("Fields to update on the entity"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type UpdateEntityArgs = z.infer<typeof updateEntityParameters>;

export const updateEntityTool = tool({
  description:
    "Update an existing entity's properties. Identify the entity by name. Identity changes require approval.",
  inputSchema: updateEntityParameters,
});

export function updateEntityNeedsApproval(args: UpdateEntityArgs): boolean {
  return needsToolApproval(WRITER_REGISTRY, "update_entity", {
    entityType: args.entityType,
    updates: args.updates as Record<string, unknown>,
  });
}

// =============================================================================
// Create Relationship Tool
// =============================================================================

export const createRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: relationTypeSchema.describe("The type of relationship"),
  bidirectional: z.boolean().optional().describe("Whether the relationship goes both ways"),
  notes: z.string().optional().describe("Additional context about the relationship"),
  strength: z.number().min(0).max(1).optional().describe("Strength of the relationship (0-1)"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type CreateRelationshipArgs = z.infer<typeof createRelationshipParameters>;

export const createRelationshipTool = tool({
  description:
    "Create a relationship between two entities in the project graph. Some relationship types require approval.",
  inputSchema: createRelationshipParameters,
});

export function createRelationshipNeedsApproval(args: CreateRelationshipArgs): boolean {
  return needsToolApproval(WRITER_REGISTRY, "create_relationship", { type: args.type });
}

// =============================================================================
// Update Relationship Tool
// =============================================================================

export const updateRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: relationTypeSchema.describe("The current type of relationship (to identify it)"),
  updates: z
    .object({
      notes: z.string().optional().describe("Updated notes about the relationship"),
      strength: z.number().min(0).max(1).optional().describe("Updated strength (0-1)"),
      bidirectional: z.boolean().optional().describe("Whether the relationship is bidirectional"),
    })
    .describe("Fields to update on the relationship"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type UpdateRelationshipArgs = z.infer<typeof updateRelationshipParameters>;

export const updateRelationshipTool = tool({
  description:
    "Update an existing relationship between two entities. Significant changes require approval.",
  inputSchema: updateRelationshipParameters,
});

export function updateRelationshipNeedsApproval(args: UpdateRelationshipArgs): boolean {
  return needsToolApproval(WRITER_REGISTRY, "update_relationship", {
    type: args.type,
    updates: args.updates as Record<string, unknown>,
  });
}

// =============================================================================
// Project Graph (Generic) Tools
// =============================================================================

export const createNodeParameters = z.object({
  type: z.string().describe("Node type (validated against the project registry)"),
  name: z.string().describe("The name of the node"),
  aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
  notes: z.string().optional().describe("General notes about the node"),
  properties: z
    .record(z.any())
    .optional()
    .describe("Arbitrary node properties (shallow object)"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type CreateNodeArgs = z.infer<typeof createNodeParameters>;

export const createNodeTool = tool({
  description:
    "Create a new project graph node using a per-project type registry. This is the generic counterpart to create_entity.",
  inputSchema: createNodeParameters,
});

export const updateNodeParameters = z.object({
  nodeName: z.string().describe("The current name of the node to update"),
  nodeType: z.string().optional().describe("Optional type (for disambiguation)"),
  updates: z.object({
    name: z.string().optional().describe("New name for the node"),
    aliases: z.array(z.string()).optional().describe("Updated alternative names"),
    notes: z.string().optional().describe("Updated notes"),
    properties: z
      .record(z.any())
      .optional()
      .describe("Properties to merge into existing properties (shallow merge)"),
  }),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type UpdateNodeArgs = z.infer<typeof updateNodeParameters>;

export const updateNodeTool = tool({
  description:
    "Update an existing project graph node using a per-project type registry. This is the generic counterpart to update_entity.",
  inputSchema: updateNodeParameters,
});

export const createEdgeParameters = z.object({
  sourceName: z.string().describe("Name of the source node"),
  targetName: z.string().describe("Name of the target node"),
  type: z.string().describe("Edge type (validated against the project registry)"),
  bidirectional: z.boolean().optional().describe("Whether the edge goes both ways"),
  notes: z.string().optional().describe("Additional context about the edge"),
  strength: z.number().min(0).max(1).optional().describe("Strength of the edge (0-1)"),
  metadata: z.record(z.any()).optional().describe("Additional edge metadata (JSON object)"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type CreateEdgeArgs = z.infer<typeof createEdgeParameters>;

export const createEdgeTool = tool({
  description:
    "Create an edge between two nodes using a per-project type registry. This is the generic counterpart to create_relationship.",
  inputSchema: createEdgeParameters,
});

export const updateEdgeParameters = z.object({
  sourceName: z.string().describe("Name of the source node"),
  targetName: z.string().describe("Name of the target node"),
  type: z.string().describe("The current edge type (to identify it)"),
  updates: z.object({
    notes: z.string().optional().describe("Updated notes about the edge"),
    strength: z.number().min(0).max(1).optional().describe("Updated strength (0-1)"),
    bidirectional: z.boolean().optional().describe("Whether the edge is bidirectional"),
    metadata: z.record(z.any()).optional().describe("Updated metadata (merged or replaced by clients)"),
  }),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type UpdateEdgeArgs = z.infer<typeof updateEdgeParameters>;

export const updateEdgeTool = tool({
  description:
    "Update an existing edge between two nodes using a per-project type registry. This is the generic counterpart to update_relationship.",
  inputSchema: updateEdgeParameters,
});

// =============================================================================
// Image Tools
// =============================================================================

const imageStyleSchema = z.enum([
  "realistic",
  "illustrated",
  "anime",
  "painterly",
  "sketch",
  "comic",
  "fantasy_art",
  "dark_fantasy",
  "sci_fi",
  "portrait",
  "landscape",
  "concept_art",
]);

const aspectRatioSchema = z.enum([
  "1:1",
  "3:4",
  "4:3",
  "16:9",
  "9:16",
  "2:3",
  "3:2",
]);

const imageTierSchema = z.enum([
  "inline",
  "fast",
  "standard",
  "premium",
  "ultra",
]);

export const generateImageParameters = z.object({
  subject: z.string().describe("The main subject to generate (character, scene, location, etc.)"),
  style: imageStyleSchema.optional().describe("Visual style for the image"),
  aspectRatio: aspectRatioSchema.optional().describe("Aspect ratio (default 1:1)"),
  visualDescription: z.string().optional().describe("Additional visual details to include"),
  negativePrompt: z.string().optional().describe("Elements to exclude from the image"),
  entityId: z.string().optional().describe("ID of an entity to associate the image with"),
  tier: imageTierSchema.optional().describe("Quality tier (default: standard)"),
});

export type GenerateImageArgs = z.infer<typeof generateImageParameters>;

export const generateImageTool = tool({
  description:
    "Generate an image for a character portrait, scene illustration, location, or concept. Use this when the author needs visual reference material.",
  inputSchema: generateImageParameters,
});

export function generateImageNeedsApproval(): boolean {
  return true; // Always require approval for image generation
}

export const illustrateSceneParameters = z.object({
  sceneText: z.string().describe("The prose or scene description to illustrate"),
  style: imageStyleSchema.optional().describe("Visual style for the illustration"),
  aspectRatio: aspectRatioSchema.optional().describe("Aspect ratio (default 16:9 for scenes)"),
  sceneFocus: z
    .enum(["action", "dialogue", "establishing", "dramatic"])
    .optional()
    .describe("What aspect of the scene to emphasize"),
});

export type IllustrateSceneArgs = z.infer<typeof illustrateSceneParameters>;

export const illustrateSceneTool = tool({
  description:
    "Create an illustration based on a scene from the narrative. Analyzes the prose and generates a fitting visual.",
  inputSchema: illustrateSceneParameters,
});

export function illustrateSceneNeedsApproval(): boolean {
  return true;
}

export const analyzeImageParameters = z.object({
  imageUrl: z.string().describe("URL of the image to analyze"),
  analysisPrompt: z.string().optional().describe("Specific aspects to analyze"),
});

export type AnalyzeImageArgs = z.infer<typeof analyzeImageParameters>;

export const analyzeImageTool = tool({
  description:
    "Analyze an uploaded image to extract characters, settings, mood, and style information for use in the story.",
  inputSchema: analyzeImageParameters,
});

export function analyzeImageNeedsApproval(): boolean {
  return false; // Analysis doesn't modify anything
}

// =============================================================================
// Genesis World Tools
// =============================================================================

const genesisGenreSchema = z.enum([
  "fantasy",
  "scifi",
  "thriller",
  "romance",
  "literary",
  "horror",
  "mystery",
  "historical",
]);

const genesisDetailLevelSchema = z.enum(["minimal", "standard", "detailed"]);

export const genesisWorldParameters = z.object({
  prompt: z.string().describe("The world concept or idea to generate from"),
  genre: genesisGenreSchema.optional().describe("Genre for the world (default: fantasy)"),
  entityCount: z
    .number()
    .min(5)
    .max(30)
    .optional()
    .describe("Approximate number of entities to generate (default: 10)"),
  detailLevel: genesisDetailLevelSchema
    .optional()
    .describe("Level of detail for entity descriptions (default: standard)"),
  includeOutline: z.boolean().optional().describe("Whether to include a story outline"),
});

export type GenesisWorldArgs = z.infer<typeof genesisWorldParameters>;

export const genesisWorldTool = tool({
  description:
    "Generate a complete story world with interconnected characters, locations, items, factions, and magic systems based on a concept prompt. Returns entities with relationships that can be persisted after user approval.",
  inputSchema: genesisWorldParameters,
});

export function genesisWorldNeedsApproval(): boolean {
  return true; // Always require approval - creates multiple entities
}

export const persistGenesisWorldParameters = z.object({
  result: z.any().describe("The GenesisResult object from genesisWorld"),
  skipEntityTypes: z
    .array(z.string())
    .optional()
    .describe("Entity types to skip during persistence"),
});

export type PersistGenesisWorldArgs = z.infer<typeof persistGenesisWorldParameters>;

export const persistGenesisWorldTool = tool({
  description:
    "Persist a generated world to the database after user approval. Creates entities and relationships from a GenesisResult.",
  inputSchema: persistGenesisWorldParameters,
});

export function persistGenesisWorldNeedsApproval(): boolean {
  return true; // Always require approval - creates multiple entities
}
