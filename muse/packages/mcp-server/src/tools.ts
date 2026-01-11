/**
 * Saga MCP Tool Definitions
 *
 * Defines all tools exposed via the MCP server.
 * These map to Saga's edge function tools.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// Entity Types for Schema Definitions
// =============================================================================

const ENTITY_TYPES = [
  "character",
  "location",
  "item",
  "faction",
  "magic_system",
  "event",
  "concept",
] as const;

const RELATION_TYPES = [
  "knows",
  "loves",
  "hates",
  "killed",
  "created",
  "owns",
  "guards",
  "weakness",
  "strength",
  "parent_of",
  "child_of",
  "sibling_of",
  "married_to",
  "allied_with",
  "enemy_of",
  "member_of",
  "rules",
  "serves",
] as const;

const ITEM_CATEGORIES = [
  "weapon",
  "armor",
  "artifact",
  "consumable",
  "key",
  "other",
] as const;

const CONSISTENCY_FOCUS = [
  "character",
  "world",
  "plot",
  "timeline",
] as const;

const LOGIC_FOCUS = [
  "magic_rules",
  "causality",
  "knowledge_state",
  "power_scaling",
] as const;

const NAME_CULTURES = [
  "western",
  "norse",
  "japanese",
  "chinese",
  "arabic",
  "slavic",
  "celtic",
  "latin",
  "indian",
  "african",
  "custom",
] as const;

const DECISION_CATEGORIES = [
  "decision",
  "policy",
] as const;

const ASSET_TYPES = [
  "portrait",
  "scene",
  "location",
  "item",
  "reference",
  "other",
] as const;

const IMAGE_STYLES = [
  "fantasy_art",
  "dark_fantasy",
  "high_fantasy",
  "manga",
  "anime",
  "light_novel",
  "visual_novel",
  "realistic",
  "oil_painting",
  "watercolor",
  "concept_art",
  "portrait_photo",
  "sci_fi",
  "horror",
  "romance",
  "noir",
  "comic_book",
  "pixel_art",
  "chibi",
] as const;

const ASPECT_RATIOS = [
  "1:1",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "2:3",
  "3:2",
] as const;

const EXTRACTION_FOCUS = [
  "full",
  "appearance",
  "environment",
  "object",
] as const;

const SCENE_FOCUS = [
  "action",
  "dialogue",
  "establishing",
  "dramatic",
] as const;

// =============================================================================
// Citation Schema (aligned with muse/convex/ai/tools/citations.ts)
// =============================================================================

/**
 * Reusable JSON Schema fragment for citations.
 * Citations provide provenance for Knowledge PRs by referencing pinned memories.
 */
const CITATION_SCHEMA = {
  type: "object" as const,
  description: "Citation referencing a pinned canon/policy memory",
  properties: {
    memoryId: {
      type: "string",
      description: "Stable memory ID (from saga://projects/{projectId}/memories)",
    },
    category: {
      type: "string",
      enum: DECISION_CATEGORIES,
      description: "Memory category: decision (canon) or policy (house style)",
    },
    excerpt: {
      type: "string",
      description: "Short supporting excerpt from the memory",
    },
    reason: {
      type: "string",
      description: "Why this memory supports the change",
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence score (0-1)",
    },
  },
  required: ["memoryId"],
} as const;

/**
 * Citations array schema for tools that create Knowledge PRs.
 */
const CITATIONS_ARRAY_SCHEMA = {
  type: "array" as const,
  description: "Citations providing evidence/provenance for this change (max 10)",
  items: CITATION_SCHEMA,
  maxItems: 10,
} as const;

// =============================================================================
// Tool Definitions
// =============================================================================

/**
 * Create Entity Tool
 * Creates a new entity (character, location, item, etc.) in the world.
 */
export const createEntityTool: Tool = {
  name: "create_entity",
  description:
    "Create a new entity (character, location, item, faction, magic system, event, or concept) in your worldbuilding project. Returns a proposal for the entity creation.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID to create the entity in",
      },
      type: {
        type: "string",
        enum: ENTITY_TYPES,
        description: "The type of entity to create",
      },
      name: {
        type: "string",
        description: "The name of the entity",
      },
      aliases: {
        type: "array",
        items: { type: "string" },
        description: "Alternative names or nicknames for the entity",
      },
      notes: {
        type: "string",
        description: "General notes about the entity",
      },
      // Character-specific properties
      archetype: {
        type: "string",
        description: "Character archetype (hero, mentor, shadow, trickster, etc.)",
      },
      backstory: {
        type: "string",
        description: "Character's background story",
      },
      goals: {
        type: "array",
        items: { type: "string" },
        description: "Character's goals and motivations",
      },
      fears: {
        type: "array",
        items: { type: "string" },
        description: "Character's fears",
      },
      // Location-specific properties
      climate: {
        type: "string",
        description: "Climate or weather of the location",
      },
      atmosphere: {
        type: "string",
        description: "Mood and feeling of the place",
      },
      // Item-specific properties
      category: {
        type: "string",
        enum: ITEM_CATEGORIES,
        description: "Category of item",
      },
      abilities: {
        type: "array",
        items: { type: "string" },
        description: "Special abilities or properties of the item",
      },
      // Faction-specific properties
      leader: {
        type: "string",
        description: "Name of the faction leader",
      },
      headquarters: {
        type: "string",
        description: "Main base or location of the faction",
      },
      factionGoals: {
        type: "array",
        items: { type: "string" },
        description: "Faction's goals",
      },
      // Magic System-specific properties
      rules: {
        type: "array",
        items: { type: "string" },
        description: "Rules of the magic system",
      },
      limitations: {
        type: "array",
        items: { type: "string" },
        description: "Limitations and costs of the magic system",
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "type", "name"],
  },
};

/**
 * Create Node Tool (Project Graph)
 * Creates a new node using a per-project type registry.
 */
export const createNodeTool: Tool = {
  name: "create_node",
  description:
    "Create a new project graph node using a per-project type registry. Returns a proposal for the node creation.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID to create the node in",
      },
      type: {
        type: "string",
        description: "Node type (validated against the project's type registry)",
      },
      name: {
        type: "string",
        description: "The name of the node",
      },
      aliases: {
        type: "array",
        items: { type: "string" },
        description: "Alternative names or nicknames for the node",
      },
      notes: {
        type: "string",
        description: "General notes about the node",
      },
      properties: {
        type: "object",
        description: "Arbitrary node properties (JSON object)",
        additionalProperties: true,
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "type", "name"],
  },
};

/**
 * Update Entity Tool
 * Updates an existing entity's properties.
 */
export const updateEntityTool: Tool = {
  name: "update_entity",
  description:
    "Update an existing entity's properties. Use this to modify characters, locations, items, and other world elements.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID containing the entity",
      },
      entityId: {
        type: "string",
        description: "The ID of the entity to update",
      },
      name: {
        type: "string",
        description: "New name for the entity (optional)",
      },
      notes: {
        type: "string",
        description: "Updated notes about the entity",
      },
      properties: {
        type: "object",
        description: "Properties to update (merged with existing)",
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "entityId"],
  },
};

/**
 * Update Node Tool (Project Graph)
 * Updates an existing node using a per-project type registry.
 */
export const updateNodeTool: Tool = {
  name: "update_node",
  description:
    "Update an existing project graph node using a per-project type registry. Identify the node by name (with optional type for disambiguation).",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID containing the node",
      },
      nodeName: {
        type: "string",
        description: "The current name of the node to update",
      },
      nodeType: {
        type: "string",
        description: "Optional node type for disambiguation",
      },
      updates: {
        type: "object",
        description: "Fields to update on the node",
        properties: {
          name: { type: "string", description: "New name for the node" },
          aliases: {
            type: "array",
            items: { type: "string" },
            description: "Updated aliases",
          },
          notes: { type: "string", description: "Updated notes" },
          properties: {
            type: "object",
            description: "Properties to merge into existing properties",
            additionalProperties: true,
          },
        },
        additionalProperties: false,
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "nodeName", "updates"],
  },
};

/**
 * Create Relationship Tool
 * Creates a relationship between two entities.
 */
export const createRelationshipTool: Tool = {
  name: "create_relationship",
  description:
    "Create a relationship between two entities in your world. Relationships define how characters, locations, and other elements connect.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      sourceEntityId: {
        type: "string",
        description: "ID of the source entity",
      },
      targetEntityId: {
        type: "string",
        description: "ID of the target entity",
      },
      type: {
        type: "string",
        enum: RELATION_TYPES,
        description: "Type of relationship",
      },
      notes: {
        type: "string",
        description: "Additional notes about the relationship",
      },
      bidirectional: {
        type: "boolean",
        description: "Whether the relationship goes both ways",
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "sourceEntityId", "targetEntityId", "type"],
  },
};

/**
 * Create Edge Tool (Project Graph)
 * Creates an edge between two nodes using a per-project relationship registry.
 */
export const createEdgeTool: Tool = {
  name: "create_edge",
  description:
    "Create an edge between two nodes in the project graph using a per-project relationship registry.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      sourceName: {
        type: "string",
        description: "Name of the source node",
      },
      targetName: {
        type: "string",
        description: "Name of the target node",
      },
      type: {
        type: "string",
        description: "Edge type (validated against the project's type registry)",
      },
      notes: {
        type: "string",
        description: "Additional notes about the edge",
      },
      bidirectional: {
        type: "boolean",
        description: "Whether the edge goes both ways",
      },
      strength: {
        type: "number",
        description: "Strength of the edge (0-1)",
        minimum: 0,
        maximum: 1,
      },
      metadata: {
        type: "object",
        description: "Additional edge metadata (JSON object)",
        additionalProperties: true,
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "sourceName", "targetName", "type"],
  },
};

/**
 * Update Edge Tool (Project Graph)
 * Updates an existing edge between two nodes.
 */
export const updateEdgeTool: Tool = {
  name: "update_edge",
  description:
    "Update an existing edge between two nodes in the project graph. Identify the edge by source name, target name, and type.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      sourceName: {
        type: "string",
        description: "Name of the source node",
      },
      targetName: {
        type: "string",
        description: "Name of the target node",
      },
      type: {
        type: "string",
        description: "The current edge type (to identify it)",
      },
      updates: {
        type: "object",
        description: "Fields to update on the edge",
        properties: {
          notes: { type: "string", description: "Updated notes" },
          bidirectional: { type: "boolean", description: "Whether the edge is bidirectional" },
          strength: {
            type: "number",
            description: "Updated strength (0-1)",
            minimum: 0,
            maximum: 1,
          },
          metadata: {
            type: "object",
            description: "Updated metadata (JSON object)",
            additionalProperties: true,
          },
        },
        additionalProperties: false,
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "sourceName", "targetName", "type", "updates"],
  },
};

/**
 * Graph Mutation Tool
 * Unified create/update/delete operations for entities and relationships.
 */
export const graphMutationTool: Tool = {
  name: "graph_mutation",
  description:
    "Create, update, or delete entities/nodes and relationships/edges in the project graph using a single tool.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      action: {
        type: "string",
        enum: ["create", "update", "delete"],
        description: "Mutation action",
      },
      target: {
        type: "string",
        enum: ["entity", "node", "relationship", "edge"],
        description: "Target type for the mutation",
      },
      type: {
        type: "string",
        description: "Entity/relationship type (for create/update)",
      },
      name: {
        type: "string",
        description: "Entity/node name (for create)",
      },
      aliases: {
        type: "array",
        items: { type: "string" },
        description: "Alternative names or nicknames",
      },
      notes: {
        type: "string",
        description: "Notes about the entity or relationship",
      },
      properties: {
        type: "object",
        description: "Entity properties (JSON object)",
        additionalProperties: true,
      },
      archetype: { type: "string", description: "Character archetype" },
      backstory: { type: "string", description: "Character backstory" },
      goals: { type: "array", items: { type: "string" }, description: "Character goals" },
      fears: { type: "array", items: { type: "string" }, description: "Character fears" },
      entityName: {
        type: "string",
        description: "Existing entity/node name (for update/delete)",
      },
      entityType: {
        type: "string",
        description: "Entity/node type hint (for update/delete)",
      },
      updates: {
        type: "object",
        description: "Fields to update (entity or relationship)",
        additionalProperties: true,
      },
      sourceName: {
        type: "string",
        description: "Source entity/node name (relationships)",
      },
      targetName: {
        type: "string",
        description: "Target entity/node name (relationships)",
      },
      bidirectional: {
        type: "boolean",
        description: "Whether the relationship is bidirectional",
      },
      strength: {
        type: "number",
        description: "Relationship strength (0-1)",
        minimum: 0,
        maximum: 1,
      },
      metadata: {
        type: "object",
        description: "Relationship metadata (JSON object)",
        additionalProperties: true,
      },
      reason: {
        type: "string",
        description: "Reason for deletion",
      },
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["projectId", "action", "target"],
  },
};

/**
 * Genesis World Tool
 * Generates a complete world scaffold from a description.
 */
export const genesisWorldTool: Tool = {
  name: "genesis_world",
  description:
    "Generate a complete world scaffold with entities, relationships, and optional story outline from a story description. Perfect for kickstarting a new worldbuilding project.",
  inputSchema: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "Story or world description (minimum 10 characters)",
        minLength: 10,
      },
      genre: {
        type: "string",
        description: "Genre hint (e.g., 'dark fantasy', 'sci-fi', 'romance')",
      },
      entityCount: {
        type: "integer",
        description: "Target number of entities to generate (3-50, default 10)",
        minimum: 3,
        maximum: 50,
      },
      detailLevel: {
        type: "string",
        enum: ["minimal", "standard", "detailed"],
        description: "How detailed the generation should be",
      },
      includeOutline: {
        type: "boolean",
        description: "Whether to include a story outline with chapters/acts",
      },
    },
    required: ["prompt"],
  },
};

/**
 * Project Manage Tool
 * Unified entry point for bootstrapping/migrating a project.
 */
export const projectManageTool: Tool = {
  name: "project_manage",
  description:
    "Bootstrap or migrate a project. Bootstrap always generates template structure. Set seed=true (default) to include starter entities/relationships, seed=false for structure only.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: { type: "string", description: "Project ID (required)" },
      action: {
        type: "string",
        enum: ["bootstrap", "restructure", "pivot"],
        description: "Operation to perform",
      },
      // bootstrap
      description: {
        type: "string",
        description: "High-level story or world description",
        minLength: 10,
      },
      seed: {
        type: "boolean",
        description: "Whether to persist starter entities/relationships (default true)",
      },
      genre: { type: "string", description: "Optional genre hint" },
      entityCount: {
        type: "integer",
        description: "Target number of entities to generate (3-50)",
        minimum: 3,
        maximum: 50,
      },
      detailLevel: {
        type: "string",
        enum: ["minimal", "standard", "detailed"],
        description: "How detailed the generation should be",
      },
      includeOutline: { type: "boolean", description: "Whether to include a story outline" },
      skipEntityTypes: {
        type: "array",
        items: { type: "string" },
        description: "Entity types to skip during persistence",
      },
      // restructure
      changes: {
        type: "array",
        description: "Restructure operations (currently may be unsupported)",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            op: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
            type: { type: "string" },
            field: { type: "string" },
          },
          required: ["op"],
        },
      },
      // pivot
      toTemplate: { type: "string", description: "Target template ID to pivot to" },
      mappings: {
        type: "array",
        description: "Type mappings for pivot",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            from: { type: "string" },
            to: { type: "string" },
          },
          required: ["from", "to"],
        },
      },
      unmappedContent: {
        type: "string",
        enum: ["archive", "discard"],
        description: "What to do with unmapped content",
      },
    },
    required: ["projectId", "action"],
  },
};

/**
 * Detect Entities Tool
 * Detects and extracts entities from narrative text.
 */
export const detectEntitiesTool: Tool = {
  name: "detect_entities",
  description:
    "Detect and extract entities (characters, locations, items, etc.) from narrative text. Returns detected entities with confidence scores and text positions.",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "The text to analyze for entities",
      },
      minConfidence: {
        type: "number",
        description: "Minimum confidence threshold (0-1, default 0.7)",
        minimum: 0,
        maximum: 1,
      },
      maxEntities: {
        type: "integer",
        description: "Maximum number of entities to return (default 50)",
        minimum: 1,
        maximum: 100,
      },
      entityTypes: {
        type: "array",
        items: {
          type: "string",
          enum: ENTITY_TYPES,
        },
        description: "Filter to specific entity types",
      },
    },
    required: ["text"],
  },
};

/**
 * Analyze Content Tool
 * Unified analysis tool for entities, consistency, logic, clarity, and policy.
 */
export const analyzeContentTool: Tool = {
  name: "analyze_content",
  description:
    "Analyze content for entities, consistency, logic, clarity, or policy issues in one tool.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      mode: {
        type: "string",
        enum: ["entities", "consistency", "logic", "clarity", "policy"],
        description: "Which analysis mode to run",
      },
      text: {
        type: "string",
        description: "The text to analyze",
      },
      options: {
        type: "object",
        description: "Optional analysis options",
        properties: {
          focus: {
            type: "array",
            items: { type: "string" },
            description: "Focus labels for consistency/logic checks",
          },
          strictness: {
            type: "string",
            enum: ["strict", "balanced", "lenient"],
            description: "Strictness for logic checks",
          },
          maxIssues: {
            type: "number",
            minimum: 1,
            maximum: 200,
            description: "Maximum issues to return",
          },
          entityTypes: {
            type: "array",
            items: { type: "string", enum: ENTITY_TYPES },
            description: "Entity types to detect",
          },
          minConfidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Minimum confidence for detection",
          },
        },
        additionalProperties: false,
      },
    },
    required: ["projectId", "mode", "text"],
  },
};

/**
 * Check Consistency Tool
 * Checks narrative for contradictions and plot holes.
 */
export const checkConsistencyTool: Tool = {
  name: "check_consistency",
  description:
    "Check your narrative for consistency issues, contradictions, plot holes, and timeline errors. Returns a list of issues with suggestions for fixing them.",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "The text to analyze for consistency issues",
      },
      focus: {
        type: "array",
        items: {
          type: "string",
          enum: CONSISTENCY_FOCUS,
        },
        description: "Focus areas: character, world, plot, timeline (default: all)",
      },
      entities: {
        type: "array",
        description: "Known entities to check against",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string", enum: ENTITY_TYPES },
            properties: { type: "object" },
          },
          required: ["id", "name", "type"],
        },
      },
    },
    required: ["text"],
  },
};

/**
 * Clarity Check Tool
 * Checks prose for clarity issues.
 */
export const clarityCheckTool: Tool = {
  name: "clarity_check",
  description:
    "Check prose for clarity issues including ambiguous pronouns, unclear antecedents, cliches, filler/weasel words, and dangling modifiers. Also computes readability metrics (Flesch-Kincaid grade, etc.).",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "The text to analyze for clarity issues",
      },
      maxIssues: {
        type: "integer",
        description: "Maximum number of issues to return (default 25)",
        minimum: 1,
        maximum: 100,
      },
    },
    required: ["text"],
  },
};

/**
 * Check Logic Tool
 * Validates story logic against explicit rules.
 */
export const checkLogicTool: Tool = {
  name: "check_logic",
  description:
    "Validate story logic against explicit rules and world state. Checks for magic rule violations, causality breaks, knowledge state violations, and power scaling issues.",
  inputSchema: {
    type: "object" as const,
    properties: {
      text: {
        type: "string",
        description: "The text to analyze for logic violations",
      },
      focus: {
        type: "array",
        items: {
          type: "string",
          enum: LOGIC_FOCUS,
        },
        description: "Focus areas: magic_rules, causality, knowledge_state, power_scaling",
      },
      strictness: {
        type: "string",
        enum: ["strict", "balanced", "lenient"],
        description: "How strict the validation should be",
      },
      magicSystems: {
        type: "array",
        description: "Magic systems with their rules to check against",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            rules: { type: "array", items: { type: "string" } },
            limitations: { type: "array", items: { type: "string" } },
            costs: { type: "array", items: { type: "string" } },
          },
          required: ["id", "name", "rules", "limitations"],
        },
      },
      characters: {
        type: "array",
        description: "Characters with power levels and knowledge for validation",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            powerLevel: { type: "number" },
            knowledge: { type: "array", items: { type: "string" } },
          },
          required: ["id", "name"],
        },
      },
    },
    required: ["text"],
  },
};

/**
 * Name Generator Tool
 * Generates culturally-aware names for entities.
 */
export const nameGeneratorTool: Tool = {
  name: "name_generator",
  description:
    "Generate culturally-aware, genre-appropriate names for characters, locations, items, and other story entities. Provides meaning and pronunciation when applicable.",
  inputSchema: {
    type: "object" as const,
    properties: {
      entityType: {
        type: "string",
        enum: ENTITY_TYPES,
        description: "Type of entity to name",
      },
      genre: {
        type: "string",
        description: "Genre context for name style (e.g., fantasy, sci-fi, historical)",
      },
      culture: {
        type: "string",
        enum: NAME_CULTURES,
        description: "Cultural inspiration for names",
      },
      count: {
        type: "integer",
        description: "Number of names to generate (default: 10)",
        minimum: 1,
        maximum: 50,
      },
      seed: {
        type: "string",
        description: "Seed text for context (entity notes, description)",
      },
      avoid: {
        type: "array",
        items: { type: "string" },
        description: "Names to avoid (existing entities)",
      },
      tone: {
        type: "string",
        description: "Tone for the names (e.g., heroic, mysterious, whimsical)",
      },
      style: {
        type: "string",
        enum: ["short", "standard", "long"],
        description: "Style preference for name length",
      },
    },
    required: ["entityType"],
  },
};

/**
 * Generate Template Tool
 * Generates a custom project template.
 */
export const generateTemplateTool: Tool = {
  name: "generate_template",
  description:
    "Generate a custom project template with entity types, relationship kinds, document types, and linter rules tailored to your story's genre and needs.",
  inputSchema: {
    type: "object" as const,
    properties: {
      storyDescription: {
        type: "string",
        description: "Description of the story to generate a template for",
      },
      genreHints: {
        type: "array",
        items: { type: "string" },
        description: "Genre hints (e.g., ['fantasy', 'romance'])",
      },
      complexity: {
        type: "string",
        enum: ["simple", "standard", "complex"],
        description: "Template complexity level",
      },
      baseTemplateId: {
        type: "string",
        description: "Base template to customize from",
      },
    },
    required: ["storyDescription"],
  },
};

/**
 * Search Entities Tool
 * Semantic search for entities in the project.
 */
export const searchEntitiesTool: Tool = {
  name: "search_entities",
  description:
    "Search for entities in your worldbuilding project using semantic search. Find characters, locations, items, and more that match your query.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID to search in",
      },
      query: {
        type: "string",
        description: "Search query (semantic search)",
      },
      entityTypes: {
        type: "array",
        items: {
          type: "string",
          enum: ENTITY_TYPES,
        },
        description: "Filter to specific entity types",
      },
      limit: {
        type: "integer",
        description: "Maximum number of results (default: 10)",
        minimum: 1,
        maximum: 50,
      },
    },
    required: ["projectId", "query"],
  },
};

/**
 * Generate Content Tool
 * Generates content for an entity.
 */
export const generateContentTool: Tool = {
  name: "generate_content",
  description:
    "Generate content for an entity such as descriptions, backstories, dialogue, or scenes. Uses AI to create contextually appropriate content.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      entityId: {
        type: "string",
        description: "The entity to generate content for",
      },
      contentType: {
        type: "string",
        enum: ["description", "backstory", "dialogue", "scene"],
        description: "Type of content to generate",
      },
      context: {
        type: "string",
        description: "Additional context for generation",
      },
      length: {
        type: "string",
        enum: ["short", "medium", "long"],
        description: "Desired content length",
      },
    },
    required: ["projectId", "entityId", "contentType"],
  },
};

/**
 * Commit Decision Tool
 * Stores a pinned canon or policy decision in project memory.
 */
export const commitDecisionTool: Tool = {
  name: "commit_decision",
  description:
    "Store a pinned canon (story fact) or policy (house style) decision in project memory for future citation and enforcement.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      decision: {
        type: "string",
        description: "Canonical decision statement to store",
      },
      category: {
        type: "string",
        enum: DECISION_CATEGORIES,
        description: "Decision category: decision (canon) or policy (house style)",
      },
      rationale: {
        type: "string",
        description: "Optional rationale/evidence for the decision",
      },
      entityIds: {
        type: "array",
        items: { type: "string" },
        description: "Related entity IDs (optional)",
      },
      documentId: {
        type: "string",
        description: "Source document ID (optional)",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Confidence score (0-1, optional)",
      },
      pinned: {
        type: "boolean",
        description: "Pin decision (default true on server)",
      },
      // Citations for provenance (other memories this decision references)
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["decision"],
  },
};

/**
 * Search Images Tool
 * Semantic text→image search over project assets.
 */
export const searchImagesTool: Tool = {
  name: "search_images",
  description:
    "Search for images in the project using semantic text search (CLIP embeddings). Returns ranked image hits.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID to search in",
      },
      query: {
        type: "string",
        description: "Search query for the images",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Maximum number of results (default 10)",
      },
      assetType: {
        type: "string",
        enum: ASSET_TYPES,
        description: "Filter by asset type",
      },
      entityId: {
        type: "string",
        description: "Filter by entity ID",
      },
      entityType: {
        type: "string",
        enum: ENTITY_TYPES,
        description: "Filter by entity type",
      },
      style: {
        type: "string",
        enum: IMAGE_STYLES,
        description: "Optional style filter",
      },
    },
    required: ["query"],
  },
};

/**
 * Find Similar Images Tool
 * Image→image similarity search using CLIP embeddings.
 */
export const findSimilarImagesTool: Tool = {
  name: "find_similar_images",
  description:
    "Find images similar to a reference image (by assetId) or an entity's portrait. Returns ranked results.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID to search in",
      },
      assetId: {
        type: "string",
        description: "UUID of the reference image asset",
      },
      entityName: {
        type: "string",
        description: "Entity name to use their portrait as reference (optional)",
      },
      entityType: {
        type: "string",
        enum: ENTITY_TYPES,
        description: "Entity type for disambiguation (optional)",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Maximum number of results (default 10)",
      },
      assetType: {
        type: "string",
        enum: ASSET_TYPES,
        description: "Filter by asset type",
      },
    },
  },
};

/**
 * Analyze Image Tool
 * Extracts structured visual details from an image.
 */
export const analyzeImageTool: Tool = {
  name: "analyze_image",
  description:
    "Analyze an uploaded/reference image to extract structured visual details (appearance, environment, objects).",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      imageSource: {
        type: "string",
        description: "Base64 data URL or storage path of the image",
      },
      entityTypeHint: {
        type: "string",
        enum: ENTITY_TYPES,
        description: "Optional entity type hint",
      },
      extractionFocus: {
        type: "string",
        enum: EXTRACTION_FOCUS,
        description: "What to focus extraction on (default full)",
      },
    },
    required: ["imageSource"],
  },
};

/**
 * Create Entity From Image Tool
 * Upload → analyze → create entity (+ optional portrait) composite.
 */
export const createEntityFromImageTool: Tool = {
  name: "create_entity_from_image",
  description:
    "Create an entity from an image: upload/analyze the image and create an entity, optionally setting the portrait.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      imageData: {
        type: "string",
        description: "Base64 encoded image data (data URL)",
      },
      name: {
        type: "string",
        description: "Optional name for the entity",
      },
      entityType: {
        type: "string",
        enum: ENTITY_TYPES,
        description: "Optional entity type (default character)",
      },
      setAsPortrait: {
        type: "boolean",
        description: "Whether to set the image as entity portrait (default true)",
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["imageData"],
  },
};

/**
 * Illustrate Scene Tool
 * Generates a scene illustration from narrative text.
 */
export const illustrateSceneTool: Tool = {
  name: "illustrate_scene",
  description:
    "Generate a scene illustration from narrative text. Optionally includes character portrait references for consistency.",
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "The project ID",
      },
      sceneText: {
        type: "string",
        description: "The narrative text describing the scene",
      },
      characterNames: {
        type: "array",
        items: { type: "string" },
        description: "Character names to include (optional)",
      },
      style: {
        type: "string",
        enum: IMAGE_STYLES,
        description: "Art style preset (optional)",
      },
      aspectRatio: {
        type: "string",
        enum: ASPECT_RATIOS,
        description: "Aspect ratio (default 16:9 for scenes)",
      },
      sceneFocus: {
        type: "string",
        enum: SCENE_FOCUS,
        description: "Composition focus (optional)",
      },
      negativePrompt: {
        type: "string",
        description: "Negative prompt (what to avoid, optional)",
      },
      // Citations for provenance
      citations: CITATIONS_ARRAY_SCHEMA,
    },
    required: ["sceneText"],
  },
};

// =============================================================================
// Tool Registry
// =============================================================================

/**
 * All available tools in the MCP server.
 */
export const SAGA_TOOLS: Tool[] = [
  // Entity CRUD
  createEntityTool,
  updateEntityTool,
  createRelationshipTool,
  graphMutationTool,
  // Project Graph (generic)
  createNodeTool,
  updateNodeTool,
  createEdgeTool,
  updateEdgeTool,
  searchEntitiesTool,
  generateContentTool,
  // World generation
  projectManageTool,
  genesisWorldTool,
  generateTemplateTool,
  // Canon / policy decisions
  commitDecisionTool,
  // Analysis
  analyzeContentTool,
  detectEntitiesTool,
  checkConsistencyTool,
  clarityCheckTool,
  checkLogicTool,
  // Utilities
  nameGeneratorTool,
  // Images
  searchImagesTool,
  findSimilarImagesTool,
  analyzeImageTool,
  createEntityFromImageTool,
  illustrateSceneTool,
];

/**
 * Map of tool names to tool definitions.
 */
export const TOOL_MAP = new Map<string, Tool>(
  SAGA_TOOLS.map((tool) => [tool.name, tool])
);

/**
 * Tool names that require a projectId.
 */
export const PROJECT_REQUIRED_TOOLS = new Set([
  "graph_mutation",
  "create_entity",
  "update_entity",
  "create_relationship",
  "create_node",
  "update_node",
  "create_edge",
  "update_edge",
  "search_entities",
  "generate_content",
  "project_manage",
  "commit_decision",
  "analyze_content",
  "search_images",
  "find_similar_images",
  "analyze_image",
  "create_entity_from_image",
  "illustrate_scene",
]);

/**
 * Tool names that can be executed without a project context.
 */
export const STANDALONE_TOOLS = new Set([
  "genesis_world",
  "detect_entities",
  "check_consistency",
  "clarity_check",
  "check_logic",
  "name_generator",
  "generate_template",
]);

/**
 * Mutating tools that should create Knowledge PRs (proposal-first).
 * These tools modify graph state and should go through review.
 * Read-only/analysis tools are executed immediately.
 */
export const PROPOSAL_FIRST_TOOLS = new Set([
  // Entity/Node mutations
  "graph_mutation",
  "create_entity",
  "update_entity",
  "create_node",
  "update_node",
  // Relationship/Edge mutations
  "create_relationship",
  "update_relationship",
  "create_edge",
  "update_edge",
  // Memory mutations
  "commit_decision",
  "project_manage",
  // Image-to-entity mutations (creates entities)
  "create_entity_from_image",
  "illustrate_scene",
]);

/**
 * Read-only/analysis tools that execute immediately.
 * These do not modify state and don't need review.
 */
export const IMMEDIATE_EXECUTION_TOOLS = new Set([
  // Analysis tools
  "analyze_content",
  "detect_entities",
  "check_consistency",
  "clarity_check",
  "check_logic",
  // Generation tools (no state mutation)
  "genesis_world",
  "generate_template",
  "name_generator",
  "generate_content",
  // Search tools (read-only)
  "search_entities",
  "search_images",
  "find_similar_images",
  "analyze_image",
]);
