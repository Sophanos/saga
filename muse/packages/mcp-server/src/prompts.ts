/**
 * Saga MCP Prompts
 *
 * Pre-built workflow prompts for common project tasks.
 * These guide AI clients through structured interactions.
 */

import type { Prompt } from "@modelcontextprotocol/sdk/types.js";

// =============================================================================
// Prompt Definitions
// =============================================================================

/**
 * Worldbuilding session prompt - guides through creating world elements.
 */
export const worldbuildingSessionPrompt: Prompt = {
  name: "worldbuilding-session",
  description:
    "Start a guided worldbuilding session. Choose a focus area (characters, locations, plot) and receive structured guidance for developing your world.",
  arguments: [
    {
      name: "projectId",
      description: "The project ID to work on",
      required: true,
    },
    {
      name: "focus",
      description:
        "What to focus on: characters, locations, items, factions, magic, plot, or all",
      required: false,
    },
    {
      name: "currentState",
      description: "Brief description of your current world/story state",
      required: false,
    },
  ],
};

/**
 * Character development prompt - deep dive into a character.
 */
export const characterDevelopmentPrompt: Prompt = {
  name: "character-development",
  description:
    "Deep dive into developing a specific character. Explore their backstory, motivations, relationships, and arc.",
  arguments: [
    {
      name: "projectId",
      description: "The project ID",
      required: true,
    },
    {
      name: "characterName",
      description: "Name of the character to develop",
      required: true,
    },
    {
      name: "aspect",
      description:
        "Specific aspect to focus on: backstory, psychology, relationships, arc, dialogue",
      required: false,
    },
  ],
};

/**
 * Consistency review prompt - check story for issues.
 */
export const consistencyReviewPrompt: Prompt = {
  name: "consistency-review",
  description:
    "Review your narrative for consistency issues, plot holes, and logical problems. Get suggestions for fixes.",
  arguments: [
    {
      name: "projectId",
      description: "The project ID to review",
      required: true,
    },
    {
      name: "documentId",
      description: "Specific document to review (optional - reviews all if not provided)",
      required: false,
    },
    {
      name: "focus",
      description: "Focus areas: character, world, plot, timeline, or all",
      required: false,
    },
  ],
};

/**
 * World genesis prompt - create a new world from concept.
 */
export const worldGenesisPrompt: Prompt = {
  name: "world-genesis",
  description:
    "Create a complete world from a concept. Generate entities, relationships, and story structure in one go.",
  arguments: [
    {
      name: "concept",
      description: "Your world/story concept or premise",
      required: true,
    },
    {
      name: "genre",
      description: "Genre (fantasy, sci-fi, horror, literary, etc.)",
      required: false,
    },
    {
      name: "scope",
      description: "Scale: minimal (5 entities), standard (10), detailed (20+)",
      required: false,
    },
  ],
};

/**
 * Magic system design prompt - create consistent magic rules.
 */
export const magicSystemPrompt: Prompt = {
  name: "magic-system-design",
  description:
    "Design a complete magic system with rules, limitations, and costs. Ensures internal consistency.",
  arguments: [
    {
      name: "projectId",
      description: "The project ID",
      required: true,
    },
    {
      name: "concept",
      description: "Core concept or theme of the magic",
      required: true,
    },
    {
      name: "hardness",
      description: "System hardness: hard (strict rules), soft (flexible), hybrid",
      required: false,
    },
  ],
};

/**
 * Writing coach prompt - get feedback on your prose.
 */
export const writingCoachPrompt: Prompt = {
  name: "writing-coach",
  description:
    "Get writing feedback on your prose. Analyze clarity, style, pacing, and get improvement suggestions.",
  arguments: [
    {
      name: "projectId",
      description: "The project ID",
      required: true,
    },
    {
      name: "documentId",
      description: "Document to analyze",
      required: true,
    },
    {
      name: "focus",
      description: "Focus: clarity, pacing, dialogue, description, or all",
      required: false,
    },
  ],
};

/**
 * Naming brainstorm prompt - generate names for world elements.
 */
export const namingBrainstormPrompt: Prompt = {
  name: "naming-brainstorm",
  description:
    "Generate culturally-appropriate names for characters, locations, or other story elements.",
  arguments: [
    {
      name: "entityType",
      description: "Type of entity to name: character, location, item, faction",
      required: true,
    },
    {
      name: "culture",
      description:
        "Cultural inspiration: western, norse, japanese, chinese, arabic, celtic, etc.",
      required: false,
    },
    {
      name: "context",
      description: "Context about the entity (role, personality, significance)",
      required: false,
    },
    {
      name: "avoid",
      description: "Names to avoid (comma-separated)",
      required: false,
    },
  ],
};

/**
 * Relationship mapping prompt - explore entity connections.
 */
export const relationshipMappingPrompt: Prompt = {
  name: "relationship-mapping",
  description:
    "Explore and develop relationships between entities. Discover connections, conflicts, and dynamics.",
  arguments: [
    {
      name: "projectId",
      description: "The project ID",
      required: true,
    },
    {
      name: "entityName",
      description: "Entity to map relationships for",
      required: false,
    },
    {
      name: "depth",
      description: "Relationship depth: direct (1 hop), extended (2 hops), full",
      required: false,
    },
  ],
};

/**
 * Scene planning prompt - plan a specific scene.
 */
export const scenePlanningPrompt: Prompt = {
  name: "scene-planning",
  description:
    "Plan a scene with beat-by-beat structure, character objectives, and dramatic tension.",
  arguments: [
    {
      name: "projectId",
      description: "The project ID",
      required: true,
    },
    {
      name: "characters",
      description: "Characters involved (comma-separated names)",
      required: true,
    },
    {
      name: "location",
      description: "Where the scene takes place",
      required: false,
    },
    {
      name: "objective",
      description: "What should happen in this scene",
      required: true,
    },
  ],
};

/**
 * Entity detection prompt - find entities in text.
 */
export const entityDetectionPrompt: Prompt = {
  name: "entity-detection",
  description:
    "Analyze text to detect and extract entities. Identify characters, locations, items, and other story elements.",
  arguments: [
    {
      name: "text",
      description: "The text to analyze",
      required: true,
    },
    {
      name: "entityTypes",
      description: "Types to detect (comma-separated): character, location, item, faction, event",
      required: false,
    },
  ],
};

// =============================================================================
// Prompt Registry
// =============================================================================

/**
 * All available prompts.
 */
export const SAGA_PROMPTS: Prompt[] = [
  worldbuildingSessionPrompt,
  characterDevelopmentPrompt,
  consistencyReviewPrompt,
  worldGenesisPrompt,
  magicSystemPrompt,
  writingCoachPrompt,
  namingBrainstormPrompt,
  relationshipMappingPrompt,
  scenePlanningPrompt,
  entityDetectionPrompt,
];

/**
 * Map of prompt names to prompts.
 */
export const PROMPT_MAP = new Map<string, Prompt>(
  SAGA_PROMPTS.map((prompt) => [prompt.name, prompt])
);

// =============================================================================
// Prompt Message Generation
// =============================================================================

/**
 * Generates the prompt messages for a given prompt and arguments.
 */
export function getPromptMessages(
  promptName: string,
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  switch (promptName) {
    case "worldbuilding-session":
      return generateWorldbuildingSessionMessages(args);
    case "character-development":
      return generateCharacterDevelopmentMessages(args);
    case "consistency-review":
      return generateConsistencyReviewMessages(args);
    case "world-genesis":
      return generateWorldGenesisMessages(args);
    case "magic-system-design":
      return generateMagicSystemMessages(args);
    case "writing-coach":
      return generateWritingCoachMessages(args);
    case "naming-brainstorm":
      return generateNamingBrainstormMessages(args);
    case "relationship-mapping":
      return generateRelationshipMappingMessages(args);
    case "scene-planning":
      return generateScenePlanningMessages(args);
    case "entity-detection":
      return generateEntityDetectionMessages(args);
    default:
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Unknown prompt: ${promptName}`,
          },
        },
      ];
  }
}

// =============================================================================
// Prompt Message Generators
// =============================================================================

function generateWorldbuildingSessionMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const focus = args.focus || "all aspects";
  const state = args.currentState || "a new world";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I want to have a worldbuilding session for project ${args.projectId}.

Focus area: ${focus}
Current state: ${state}

Please start by:
1. Using search_entities to understand what already exists in this world
2. Asking me clarifying questions about what I want to develop
3. Suggesting 2-3 directions we could take this session

After I choose a direction, help me develop it step by step, creating entities and relationships as we go.`,
      },
    },
  ];
}

function generateCharacterDevelopmentMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const aspect = args.aspect || "all aspects";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `I want to develop the character "${args.characterName}" in project ${args.projectId}.

Focus: ${aspect}

Please:
1. First, use search_entities to find this character and related entities
2. Analyze their current state and relationships
3. Ask me probing questions to develop this character further
4. Suggest ways to deepen their characterization

Use graph_mutation with { action: "update", target: "entity" } to save any developments we agree on.`,
      },
    },
  ];
}

function generateConsistencyReviewMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const focus = args.focus || "all areas";
  const docClause = args.documentId
    ? `document ${args.documentId}`
    : "the entire project";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please review ${docClause} in project ${args.projectId} for consistency issues.

Focus areas: ${focus}

Steps:
1. Use search_entities to get the world state
2. Use analyze_content with mode "consistency" on the relevant text
3. For each issue found, explain it clearly and suggest fixes
4. Prioritize issues by severity (errors > warnings > info)

Present findings in a clear, actionable format.`,
      },
    },
  ];
}

function generateWorldGenesisMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const genre = args.genre || "fantasy";
  const scope = args.scope || "standard";

  const entityCount = scope === "minimal" ? 5 : scope === "detailed" ? 20 : 10;

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Create a new world based on this concept:

"${args.concept}"

Genre: ${genre}
Scope: ${scope} (~${entityCount} entities)

Please use genesis_world with:
- prompt: "${args.concept}"
- genre: "${genre}"
- entityCount: ${entityCount}
- detailLevel: "${scope}"
- includeOutline: true

After generation, present the world summary and ask if I want to refine any elements before we proceed.`,
      },
    },
  ];
}

function generateMagicSystemMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const hardness = args.hardness || "hybrid";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Help me design a magic system for project ${args.projectId}.

Core concept: ${args.concept}
System hardness: ${hardness}

Please:
1. Brainstorm the fundamental principles of this magic
2. Define clear rules (what can and cannot be done)
3. Establish limitations and costs (to maintain tension)
4. Consider how this magic affects society and conflict
5. Create it as a magic_system entity with graph_mutation (action: "create", target: "entity")

The system should be internally consistent and serve the story's needs.`,
      },
    },
  ];
}

function generateWritingCoachMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const focus = args.focus || "all aspects";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Please analyze document ${args.documentId} in project ${args.projectId} as a writing coach.

Focus: ${focus}

Steps:
1. Use analyze_content with mode "clarity" to analyze the prose
2. Review the readability metrics
3. For each issue, provide:
   - The problematic text
   - Why it's a problem
   - A concrete suggestion for improvement
4. End with 2-3 strengths of the writing and overall recommendations

Be encouraging but honest. Focus on actionable improvements.`,
      },
    },
  ];
}

function generateNamingBrainstormMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const culture = args.culture || "varied";
  const context = args.context || "no specific context";
  const avoid = args.avoid || "none";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Generate names for a ${args.entityType}.

Cultural inspiration: ${culture}
Context: ${context}
Names to avoid: ${avoid}

Please use name_generator with:
- entityType: "${args.entityType}"
- culture: "${culture}"
- count: 10
- avoid: [${avoid.split(",").map((n) => `"${n.trim()}"`).join(", ")}]

For each name, explain its meaning and why it might fit. Let me know which ones resonate and I'll help narrow it down.`,
      },
    },
  ];
}

function generateRelationshipMappingMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const depth = args.depth || "direct";
  const entityClause = args.entityName
    ? `focusing on "${args.entityName}"`
    : "for all major entities";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Map relationships in project ${args.projectId}, ${entityClause}.

Relationship depth: ${depth}

Please:
1. Use search_entities to find relevant entities
2. Analyze existing relationships
3. Identify:
   - Strong connections (allies, family, lovers)
   - Conflicts (enemies, rivals, tension)
   - Missing relationships that could add depth
4. Suggest new relationships that would enrich the story

Use graph_mutation with { action: "create", target: "relationship" } to establish any relationships I approve.`,
      },
    },
  ];
}

function generateScenePlanningMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const location = args.location || "to be determined";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Help me plan a scene in project ${args.projectId}.

Characters: ${args.characters}
Location: ${location}
Objective: ${args.objective}

Please:
1. Use search_entities to understand each character
2. Define each character's objective in this scene
3. Identify potential conflicts and tension points
4. Outline the scene beat by beat:
   - Opening hook
   - Rising tension
   - Key turning point
   - Resolution/cliffhanger
5. Suggest specific dialogue beats or moments

Consider how this scene advances character arcs and plot.`,
      },
    },
  ];
}

function generateEntityDetectionMessages(
  args: Record<string, string>
): Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }> {
  const types = args.entityTypes || "all types";

  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Analyze this text to detect entities:

"""
${args.text}
"""

Entity types to detect: ${types}

Please use analyze_content with mode "entities" and:
- text: the text above
- minConfidence: 0.7
${args.entityTypes ? `- entityTypes: [${args.entityTypes.split(",").map((t) => `"${t.trim()}"`).join(", ")}]` : ""}

For each detected entity:
1. Show where it appears in the text
2. Suggest whether it should be created as a new entity or linked to an existing one
3. Note any suggested properties or aliases

Let me confirm which entities to create.`,
      },
    },
  ];
}
