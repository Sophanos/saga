/**
 * Project Graph Tools - Entity/Relationship CRUD for the Saga agent.
 *
 * Tools for creating and updating entities and relationships in the Project Graph.
 * Handlers are in projectGraphHandlers.ts - these tool definitions intentionally
 * omit handlers so the client can collect human approval before execution.
 */

import { tool } from "ai";
import { z } from "zod";
import { citationSchema } from "./citations";

const entityTypeSchema = z.string();
const relationTypeSchema = z.string();

// =============================================================================
// Graph Mutation Tool
// =============================================================================

export const graphMutationParameters = z.union([
  z.object({
    action: z.literal("create"),
    target: z.enum(["entity", "node"]),
    type: z.string().describe("Entity/node type (validated against project registry)"),
    name: z.string().describe("Entity/node name"),
    aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
    notes: z.string().optional().describe("General notes about the entity/node"),
    properties: z.record(z.any()).optional().describe("Properties as defined by project registry schema"),
    citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
  }),
  z.object({
    action: z.literal("update"),
    target: z.enum(["entity", "node"]),
    entityName: z.string().describe("Existing entity/node name"),
    entityType: z.string().optional().describe("Entity/node type (for disambiguation)"),
    updates: z.record(z.any()).describe("Fields to update"),
    citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
  }),
  z.object({
    action: z.literal("delete"),
    target: z.enum(["entity", "node"]),
    entityName: z.string().describe("Entity/node name to delete"),
    entityType: z.string().optional().describe("Entity/node type (for disambiguation)"),
    reason: z.string().optional().describe("Reason for deletion"),
  }),
  z.object({
    action: z.literal("create"),
    target: z.enum(["relationship", "edge"]),
    type: z.string().describe("Relationship/edge type (validated against project registry)"),
    sourceName: z.string().describe("Source entity/node name"),
    targetName: z.string().describe("Target entity/node name"),
    bidirectional: z.boolean().optional().describe("Whether the relationship is bidirectional"),
    strength: z.number().min(0).max(1).optional().describe("Relationship strength (0-1)"),
    notes: z.string().optional().describe("Notes about the relationship"),
    metadata: z.record(z.any()).optional().describe("Relationship metadata"),
    citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
  }),
  z.object({
    action: z.literal("update"),
    target: z.enum(["relationship", "edge"]),
    type: z.string().describe("Relationship/edge type"),
    sourceName: z.string().describe("Source entity/node name"),
    targetName: z.string().describe("Target entity/node name"),
    updates: z.record(z.any()).describe("Fields to update"),
    citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
  }),
  z.object({
    action: z.literal("delete"),
    target: z.enum(["relationship", "edge"]),
    type: z.string().describe("Relationship/edge type"),
    sourceName: z.string().describe("Source entity/node name"),
    targetName: z.string().describe("Target entity/node name"),
    reason: z.string().optional().describe("Reason for deletion"),
  }),
]);

export type GraphMutationArgs = z.infer<typeof graphMutationParameters>;

export const graphMutationTool = tool({
  description:
    "Create, update, or delete entities/nodes and relationships/edges in the project graph. Some mutations require approval.",
  inputSchema: graphMutationParameters,
});

// =============================================================================
// Create Entity Tool
// =============================================================================

export const createEntityParameters = z.object({
  type: entityTypeSchema.describe("The type of entity to create (validated against project registry)"),
  name: z.string().describe("The name of the entity"),
  aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
  notes: z.string().optional().describe("General notes about the entity"),
  properties: z
    .record(z.any())
    .optional()
    .describe("Entity properties as defined by the project's type registry schema"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type CreateEntityArgs = z.infer<typeof createEntityParameters>;

export const createEntityTool = tool({
  description:
    "Create a new entity (character, location, item, faction, magic system, event, or concept) in the project graph. Some types require approval.",
  inputSchema: createEntityParameters,
});

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
      properties: z
        .record(z.any())
        .optional()
        .describe("Properties to merge into existing properties (shallow merge)"),
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
  metadata: z.record(z.any()).optional().describe("Additional relationship metadata (JSON object)"),
  citations: z.array(citationSchema).max(10).optional().describe("Supporting canon citations"),
});

export type CreateRelationshipArgs = z.infer<typeof createRelationshipParameters>;

export const createRelationshipTool = tool({
  description:
    "Create a relationship between two entities in the project graph. Some relationship types require approval.",
  inputSchema: createRelationshipParameters,
});

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
      metadata: z.record(z.any()).optional().describe("Updated metadata (merged or replaced by clients)"),
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
  imageSource: z.string().describe("Storage ID, asset ID, URL, or data URL of the image"),
  entityTypeHint: z.string().optional().describe("Optional entity type hint"),
  extractionFocus: z
    .enum(["full", "appearance", "environment", "object"])
    .optional()
    .describe("What aspect to focus extraction on"),
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
