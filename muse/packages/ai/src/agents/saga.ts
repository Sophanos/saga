/**
 * Saga AI Agent
 *
 * A reusable ToolLoopAgent abstraction for the unified Saga AI assistant.
 * This agent handles world building, entity detection, consistency checking,
 * and general creative writing assistance.
 *
 * Designed to work in both Edge Functions and Next.js API routes.
 *
 * @example
 * ```typescript
 * import { sagaAgent } from '@mythos/ai/agents/saga';
 *
 * const result = await sagaAgent.run({
 *   messages: [...],
 *   projectId: 'uuid',
 *   mode: 'editing',
 *   model: getModel('creative'),
 * });
 * ```
 */

import { z } from "zod";
import {
  streamText,
  generateText,
  tool,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
  type StreamTextResult,
} from "ai";

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * Saga mode determines the system prompt addendum and available actions.
 */
export const SagaModeSchema = z.enum(["onboarding", "creation", "editing", "analysis"]);
export type SagaMode = z.infer<typeof SagaModeSchema>;

/**
 * Editor context provides information about the user's current editing state.
 */
export const EditorContextSchema = z.object({
  documentTitle: z.string().optional(),
  selectionText: z.string().optional(),
});
export type EditorContext = z.infer<typeof EditorContextSchema>;

/**
 * RAG context item from vector search.
 */
export const RAGContextItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  preview: z.string(),
});
export type RAGContextItem = z.infer<typeof RAGContextItemSchema>;

/**
 * RAG context containing retrieved documents and entities.
 */
export const RAGContextSchema = z.object({
  documents: z.array(RAGContextItemSchema),
  entities: z.array(RAGContextItemSchema),
});
export type RAGContext = z.infer<typeof RAGContextSchema>;

/**
 * Retrieved memory record for personalization.
 */
export const RetrievedMemoryRecordSchema = z.object({
  id: z.string(),
  content: z.string(),
  category: z.string(),
  score: z.number().optional(),
});
export type RetrievedMemoryRecord = z.infer<typeof RetrievedMemoryRecordSchema>;

/**
 * Memory context organized by category.
 */
export const RetrievedMemoryContextSchema = z.object({
  decisions: z.array(RetrievedMemoryRecordSchema),
  style: z.array(RetrievedMemoryRecordSchema),
  preferences: z.array(RetrievedMemoryRecordSchema),
  session: z.array(RetrievedMemoryRecordSchema),
});
export type RetrievedMemoryContext = z.infer<typeof RetrievedMemoryContextSchema>;

/**
 * Profile preferences for the writer.
 */
export const ProfileContextSchema = z.object({
  preferredGenre: z.string().optional(),
  namingCulture: z.string().optional(),
  namingStyle: z.string().optional(),
  logicStrictness: z.string().optional(),
});
export type ProfileContext = z.infer<typeof ProfileContextSchema>;

/**
 * Entity types supported by the system.
 */
export const EntityTypeSchema = z.enum([
  "character",
  "location",
  "item",
  "faction",
  "magic_system",
  "event",
  "concept",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

/**
 * Relationship types supported by the system.
 */
export const RelationTypeSchema = z.enum([
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
]);
export type RelationType = z.infer<typeof RelationTypeSchema>;

/**
 * Item categories for item entities.
 */
export const ItemCategorySchema = z.enum([
  "weapon",
  "armor",
  "artifact",
  "consumable",
  "key",
  "other",
]);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

/**
 * Content types for generation.
 */
export const ContentTypeSchema = z.enum([
  "description",
  "backstory",
  "dialogue",
  "scene",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/**
 * Length options for generation.
 */
export const LengthSchema = z.enum(["short", "medium", "long"]);
export type Length = z.infer<typeof LengthSchema>;

/**
 * Detail levels for world generation.
 */
export const GenesisDetailLevelSchema = z.enum(["minimal", "standard", "detailed"]);
export type GenesisDetailLevel = z.infer<typeof GenesisDetailLevelSchema>;

/**
 * Analysis scope options.
 */
export const AnalysisScopeSchema = z.enum(["selection", "document", "project"]);
export type AnalysisScope = z.infer<typeof AnalysisScopeSchema>;

/**
 * Template complexity levels.
 */
export const TemplateComplexitySchema = z.enum(["simple", "standard", "complex"]);
export type TemplateComplexity = z.infer<typeof TemplateComplexitySchema>;

/**
 * Consistency check focus areas.
 */
export const ConsistencyFocusSchema = z.enum(["character", "world", "plot", "timeline"]);
export type ConsistencyFocus = z.infer<typeof ConsistencyFocusSchema>;

/**
 * Logic check focus areas.
 */
export const LogicFocusSchema = z.enum([
  "magic_rules",
  "causality",
  "knowledge_state",
  "power_scaling",
]);
export type LogicFocus = z.infer<typeof LogicFocusSchema>;

/**
 * Logic check strictness levels.
 */
export const LogicStrictnessSchema = z.enum(["strict", "balanced", "lenient"]);
export type LogicStrictness = z.infer<typeof LogicStrictnessSchema>;

/**
 * Name culture options.
 */
export const NameCultureSchema = z.enum([
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
]);
export type NameCulture = z.infer<typeof NameCultureSchema>;

/**
 * Name style preferences.
 */
export const NameStyleSchema = z.enum(["short", "standard", "long"]);
export type NameStyle = z.infer<typeof NameStyleSchema>;

// =============================================================================
// Call Options Schema
// =============================================================================

/**
 * Options for invoking the Saga agent.
 */
export const SagaCallOptionsSchema = z.object({
  /** The operation mode (affects system prompt) */
  mode: SagaModeSchema.default("editing"),
  /** The project UUID for context retrieval */
  projectId: z.string(),
  /** Current editor context */
  editorContext: EditorContextSchema.optional(),
  /** Retrieved RAG context (documents and entities) */
  ragContext: RAGContextSchema.optional(),
  /** Retrieved memory context for personalization */
  memoryContext: RetrievedMemoryContextSchema.optional(),
  /** User profile preferences */
  profileContext: ProfileContextSchema.optional(),
});
export type SagaCallOptions = z.infer<typeof SagaCallOptionsSchema>;

// =============================================================================
// System Prompt Builder
// =============================================================================

const SAGA_BASE_SYSTEM = `You are Saga, the AI assistant for Mythos IDE - a creative writing tool that treats "story as code."

You help fiction writers build worlds, track entities, and maintain story consistency.

## Your Capabilities

You have access to powerful tools organized into two categories:

### World Building & Analysis Tools (Saga Tools)
These propose complex operations that require user confirmation:

1. **genesis_world** - Generate a complete world from a story description
   - Use when: Author describes a story concept and wants to scaffold entities
   - Creates: Characters, locations, items, factions, relationships, optional outline

2. **detect_entities** - Extract entities from narrative text
   - Use when: Author wants to find characters/locations in existing text
   - Creates: List of detected entities with positions and confidence

3. **check_consistency** - Find contradictions and plot holes
   - Use when: Author asks about inconsistencies or wants a story audit
   - Creates: List of issues with locations and suggestions

4. **generate_template** - Create a custom project template
   - Use when: Author describes their story type and wants custom entity types
   - Creates: Template with entity kinds, relationships, linter rules

5. **clarity_check** - Check prose for word/phrase-level clarity issues
   - Use when: Author wants to improve readability
   - Creates: List of clarity issues with suggestions

6. **check_logic** - Validate story logic against explicit rules
   - Use when: Author wants to verify magic system rules, causality, etc.
   - Creates: List of logic violations with rule references

7. **name_generator** - Generate culturally-aware names
   - Use when: Author needs character or place names
   - Creates: List of names with meanings and pronunciation

### Entity Management Tools (Core Tools)
These modify the author's world directly:

- **create_entity** - Add a character, location, item, faction, magic system, event, or concept
- **update_entity** - Modify an existing entity's properties
- **delete_entity** - Remove an entity
- **create_relationship** - Connect two entities (knows, loves, hates, allied_with, etc.)
- **update_relationship** / **delete_relationship** - Modify or remove connections
- **generate_content** - Create backstories, descriptions, dialogue, scenes

## Intent Detection & Tool Selection

Based on the author's message, determine the right approach:

| If the author says... | Use this tool |
|-----------------------|---------------|
| "Build me a world about..." | genesis_world |
| "Create a template for my story about..." | generate_template |
| "Find/detect/extract entities in..." | detect_entities |
| "Check for inconsistencies/contradictions" | check_consistency |
| "Check the clarity/readability of..." | clarity_check |
| "Check the logic/rules of..." | check_logic |
| "Generate names for..." | name_generator |
| "Create a character named..." | create_entity |
| "What are Marcus's relationships?" | Answer from context (no tool) |
| "Add a rivalry between X and Y" | create_relationship |

## Response Guidelines

1. **Be concise but helpful** - Don't over-explain unless asked
2. **Use retrieved context** - Reference specific elements from the author's world
3. **Propose don't assume** - Tools create proposals that authors can accept or modify
4. **Match the author's voice** - Use their terminology and naming conventions
5. **Ask when unclear** - If a request is ambiguous, ask for clarification

## Tool Proposal Format

When using a Saga tool (genesis_world, detect_entities, check_consistency, generate_template, clarity_check, check_logic, name_generator):
- Briefly explain what you're about to do
- Make the tool call with appropriate parameters
- The author will see the proposal and can accept, modify, or reject it

When using Core tools (create_entity, create_relationship, etc.):
- Summarize what you're creating
- Make the tool call
- The author can accept or reject each proposal

## Important Notes

- All tools create "proposals" - nothing is written to the database until the author accepts
- Use entity names (not IDs) when referencing existing entities
- Be creative but consistent with established world rules
- If no context is retrieved, you may still answer general writing questions`;

const SAGA_MODE_ADDENDUMS: Record<SagaMode, string> = {
  onboarding: `
## Onboarding Context

The author is just starting. Focus on:
- Understanding their story vision
- Using genesis_world to scaffold their world
- Or generate_template if they describe a specific genre/structure

Be welcoming and encouraging. This might be their first creative writing tool.`,

  creation: `
## Project Creation Context

The author is setting up a new project. Focus on:
- genesis_world for story concept -> entities
- generate_template for custom structure
- Help them choose between builtin templates or custom generation`,

  editing: `
## Editing Context

The author is actively writing. Focus on:
- Quick entity creation for new characters/places mentioned
- Relationship tracking as the story develops
- detect_entities if they paste external content
- check_consistency if they ask about plot holes`,

  analysis: `
## Analysis Context

The author wants feedback. Focus on:
- check_consistency for contradictions and plot holes
- clarity_check for readability improvements
- check_logic for rule validation
- Be thorough but constructive
- Prioritize actionable suggestions`,
};

const SAGA_MEMORY_TEMPLATE = `## Remembered Context

### Canon Decisions (never contradict these)
{decisions}

### Writer Style Preferences (try to match these)
{style}

### Personal Preferences (avoid repeating rejected patterns)
{preferences}

### Session Continuity (current focus)
{session}`;

const SAGA_CONTEXT_TEMPLATE = `## Retrieved Context

The following was retrieved from the author's story world:

### Documents
{documents}

### Entities
{entities}

Use this to provide relevant, consistent answers.`;

const SAGA_EDITOR_CONTEXT_TEMPLATE = `## Current Editor Context

**Document:** {documentTitle}
{selectionContext}

Consider this when responding.`;

const SAGA_NO_CONTEXT = `No specific context was retrieved for this query. You may still help with general writing questions or suggest using tools to build the world.`;

/**
 * Format memory records for prompt injection.
 */
function formatMemoryRecords(records: RetrievedMemoryRecord[]): string {
  if (!records || records.length === 0) {
    return "None recorded.";
  }
  return records.map((r) => `- ${r.content}`).join("\n");
}

/**
 * Build the complete system prompt for a Saga agent call.
 */
export function buildSagaSystemPrompt(options: {
  mode?: SagaMode;
  ragContext?: RAGContext;
  editorContext?: EditorContext;
  profileContext?: ProfileContext;
  memoryContext?: RetrievedMemoryContext;
}): string {
  const { mode, ragContext, editorContext, profileContext, memoryContext } = options;

  let prompt = SAGA_BASE_SYSTEM;

  // Add mode-specific guidance
  if (mode && SAGA_MODE_ADDENDUMS[mode]) {
    prompt += "\n" + SAGA_MODE_ADDENDUMS[mode];
  }

  // Build memory context with profile integration
  if (memoryContext || profileContext) {
    // Convert profile to style entries (high priority)
    let styleEntries: RetrievedMemoryRecord[] = [...(memoryContext?.style ?? [])];
    if (profileContext) {
      const profileLines: string[] = [];
      if (profileContext.preferredGenre) {
        profileLines.push(`Preferred genre: ${profileContext.preferredGenre}`);
      }
      if (profileContext.namingCulture) {
        profileLines.push(`Character naming culture: ${profileContext.namingCulture}`);
      }
      if (profileContext.namingStyle) {
        profileLines.push(`Name style preference: ${profileContext.namingStyle}`);
      }
      if (profileContext.logicStrictness) {
        profileLines.push(`World logic strictness: ${profileContext.logicStrictness}`);
      }

      // Prepend profile entries as pseudo-memories
      const profileRecords = profileLines.map((line, i) => ({
        id: `profile-${i}`,
        content: line,
        category: "style",
        score: 1.0,
      }));
      styleEntries = [...profileRecords, ...styleEntries];
    }

    const hasMemories =
      (memoryContext?.decisions?.length ?? 0) > 0 ||
      styleEntries.length > 0 ||
      (memoryContext?.preferences?.length ?? 0) > 0 ||
      (memoryContext?.session?.length ?? 0) > 0;

    if (hasMemories) {
      prompt +=
        "\n\n" +
        SAGA_MEMORY_TEMPLATE.replace("{decisions}", formatMemoryRecords(memoryContext?.decisions ?? []))
          .replace("{style}", formatMemoryRecords(styleEntries))
          .replace("{preferences}", formatMemoryRecords(memoryContext?.preferences ?? []))
          .replace("{session}", formatMemoryRecords(memoryContext?.session ?? []));
    }
  }

  // Add RAG context
  if (ragContext && (ragContext.documents.length > 0 || ragContext.entities.length > 0)) {
    const docsText =
      ragContext.documents.length > 0
        ? ragContext.documents.map((d) => `- **${d.title}**: ${d.preview}`).join("\n")
        : "None retrieved.";
    const entitiesText =
      ragContext.entities.length > 0
        ? ragContext.entities.map((e) => `- **${e.title}** (${e.type}): ${e.preview}`).join("\n")
        : "None retrieved.";

    prompt += "\n\n" + SAGA_CONTEXT_TEMPLATE.replace("{documents}", docsText).replace("{entities}", entitiesText);
  } else {
    prompt += "\n\n" + SAGA_NO_CONTEXT;
  }

  // Add editor context
  if (editorContext?.documentTitle) {
    const selectionContext = editorContext.selectionText
      ? `**Selected text:** "${editorContext.selectionText.slice(0, 200)}${editorContext.selectionText.length > 200 ? "..." : ""}"`
      : "No text selected.";

    prompt +=
      "\n\n" +
      SAGA_EDITOR_CONTEXT_TEMPLATE.replace("{documentTitle}", editorContext.documentTitle).replace(
        "{selectionContext}",
        selectionContext
      );
  }

  return prompt;
}

// =============================================================================
// Tool Definitions (AI SDK Compatible)
// =============================================================================

/**
 * Tool execution result structure.
 */
export interface ToolProposal<T = unknown> {
  toolName: string;
  proposal: T;
  message: string;
}

/**
 * Create entity tool parameter schema.
 */
const createEntityParameters = z.object({
  type: EntityTypeSchema.describe("The type of entity to create"),
  name: z.string().describe("The name of the entity"),
  aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
  notes: z.string().optional().describe("General notes about the entity"),
  // Character-specific
  archetype: z.string().optional().describe("Character archetype (hero, mentor, shadow, trickster, etc.)"),
  backstory: z.string().optional().describe("Character's background story"),
  goals: z.array(z.string()).optional().describe("Character's goals and motivations"),
  fears: z.array(z.string()).optional().describe("Character's fears"),
  // Location-specific
  climate: z.string().optional().describe("Climate or weather of the location"),
  atmosphere: z.string().optional().describe("Mood and feeling of the place"),
  // Item-specific
  category: ItemCategorySchema.optional().describe("Category of item"),
  abilities: z.array(z.string()).optional().describe("Special abilities or properties"),
  // Faction-specific
  leader: z.string().optional().describe("Name of the faction leader"),
  headquarters: z.string().optional().describe("Main base or location"),
  factionGoals: z.array(z.string()).optional().describe("Faction's goals"),
  // Magic System-specific
  rules: z.array(z.string()).optional().describe("Rules of the magic system"),
  limitations: z.array(z.string()).optional().describe("Limitations and costs"),
});

export type CreateEntityArgs = z.infer<typeof createEntityParameters>;

const updateEntityParameters = z.object({
  entityName: z.string().describe("Entity name to find (LLM doesn't know IDs)"),
  entityType: EntityTypeSchema.optional().describe("Optional type for disambiguation"),
  updates: z
    .object({
      name: z.string().optional(),
      aliases: z.array(z.string()).optional(),
      notes: z.string().optional(),
      archetype: z.string().optional(),
      backstory: z.string().optional(),
      goals: z.array(z.string()).optional(),
      fears: z.array(z.string()).optional(),
      climate: z.string().optional(),
      atmosphere: z.string().optional(),
      category: ItemCategorySchema.optional(),
      abilities: z.array(z.string()).optional(),
      leader: z.string().optional(),
      headquarters: z.string().optional(),
      factionGoals: z.array(z.string()).optional(),
      rules: z.array(z.string()).optional(),
      limitations: z.array(z.string()).optional(),
    })
    .describe("Fields to update"),
});

export type UpdateEntityArgs = z.infer<typeof updateEntityParameters>;

const deleteEntityParameters = z.object({
  entityName: z.string().describe("Name of the entity to delete"),
  entityType: EntityTypeSchema.optional().describe("Optional type for disambiguation"),
  reason: z.string().optional().describe("Reason for deletion"),
});

export type DeleteEntityArgs = z.infer<typeof deleteEntityParameters>;

const createRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: RelationTypeSchema.describe("Type of relationship"),
  bidirectional: z.boolean().optional().describe("Whether the relationship goes both ways"),
  notes: z.string().optional().describe("Additional notes about the relationship"),
  strength: z.number().min(0).max(1).optional().describe("Relationship strength (0-1)"),
});

export type CreateRelationshipArgs = z.infer<typeof createRelationshipParameters>;

const updateRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: RelationTypeSchema.describe("Type of relationship"),
  updates: z
    .object({
      notes: z.string().optional(),
      strength: z.number().min(0).max(1).optional(),
      bidirectional: z.boolean().optional(),
    })
    .describe("Fields to update"),
});

export type UpdateRelationshipArgs = z.infer<typeof updateRelationshipParameters>;

const deleteRelationshipParameters = z.object({
  sourceName: z.string().describe("Name of the source entity"),
  targetName: z.string().describe("Name of the target entity"),
  type: RelationTypeSchema.describe("Type of relationship"),
  reason: z.string().optional().describe("Reason for deletion"),
});

export type DeleteRelationshipArgs = z.infer<typeof deleteRelationshipParameters>;

const generateContentParameters = z.object({
  contentType: ContentTypeSchema.describe("Type of content to generate"),
  subject: z.string().describe("Subject or topic of the content"),
  tone: z.string().optional().describe("Desired tone (e.g., dark, humorous, epic)"),
  length: LengthSchema.optional().describe("Desired length of content"),
});

export type GenerateContentArgs = z.infer<typeof generateContentParameters>;

const genesisWorldParameters = z.object({
  prompt: z.string().describe("Story/world description from user"),
  genre: z.string().optional().describe("Optional genre hint"),
  entityCount: z.number().min(3).max(50).optional().describe("Target number of entities (3-50)"),
  detailLevel: GenesisDetailLevelSchema.optional().describe("How detailed the generation should be"),
  includeOutline: z.boolean().optional().describe("Whether to include a story outline"),
});

export type GenesisWorldArgs = z.infer<typeof genesisWorldParameters>;

const detectEntitiesParameters = z.object({
  scope: AnalysisScopeSchema.optional().describe("Scope of detection"),
  text: z.string().optional().describe("Text to analyze (optional)"),
  minConfidence: z.number().min(0).max(1).optional().describe("Minimum confidence threshold"),
  maxEntities: z.number().optional().describe("Maximum entities to return"),
  entityTypes: z.array(EntityTypeSchema).optional().describe("Filter to specific entity types"),
});

export type DetectEntitiesArgs = z.infer<typeof detectEntitiesParameters>;

const checkConsistencyParameters = z.object({
  scope: AnalysisScopeSchema.optional().describe("Scope of consistency check"),
  text: z.string().optional().describe("Text to analyze (optional)"),
  focus: z.array(ConsistencyFocusSchema).optional().describe("Focus areas for the check"),
});

export type CheckConsistencyArgs = z.infer<typeof checkConsistencyParameters>;

const generateTemplateParameters = z.object({
  storyDescription: z.string().describe("Story/world description"),
  genreHints: z.array(z.string()).optional().describe("Genre hints to guide generation"),
  complexity: TemplateComplexitySchema.optional().describe("Complexity level"),
  baseTemplateId: z.string().optional().describe("Base template to inherit from"),
});

export type GenerateTemplateArgs = z.infer<typeof generateTemplateParameters>;

const clarityCheckParameters = z.object({
  scope: AnalysisScopeSchema.optional().describe("Scope of clarity check"),
  text: z.string().optional().describe("Text to analyze (optional)"),
  maxIssues: z.number().optional().describe("Maximum number of issues to return"),
});

export type ClarityCheckArgs = z.infer<typeof clarityCheckParameters>;

const checkLogicParameters = z.object({
  scope: AnalysisScopeSchema.optional().describe("Scope of logic check"),
  text: z.string().optional().describe("Text to analyze (optional)"),
  focus: z.array(LogicFocusSchema).optional().describe("Focus areas for the check"),
  strictness: LogicStrictnessSchema.optional().describe("How strict the validation should be"),
});

export type CheckLogicArgs = z.infer<typeof checkLogicParameters>;

const nameGeneratorParameters = z.object({
  entityType: EntityTypeSchema.describe("Type of entity to name"),
  genre: z.string().optional().describe("Genre context for name style"),
  culture: NameCultureSchema.optional().describe("Cultural inspiration for names"),
  count: z.number().optional().describe("Number of names to generate"),
  seed: z.string().optional().describe("Seed text for context"),
  avoid: z.array(z.string()).optional().describe("Names to avoid"),
  tone: z.string().optional().describe("Optional tone for the names"),
  style: NameStyleSchema.optional().describe("Style preference for name length"),
});

export type NameGeneratorArgs = z.infer<typeof nameGeneratorParameters>;

/**
 * Core entity/relationship tools.
 * These create proposals for user confirmation.
 */
export const coreTools = {
  create_entity: tool({
    description:
      "Propose creating a new entity (character, location, item, faction, magic system, event, or concept) in the author's world",
    inputSchema: createEntityParameters,
    execute: async (args): Promise<ToolProposal<CreateEntityArgs>> => ({
      toolName: "create_entity",
      proposal: args,
      message: `Proposed creating ${args.type}: "${args.name}"`,
    }),
  }),

  update_entity: tool({
    description: "Propose updating an existing entity's properties",
    inputSchema: updateEntityParameters,
    execute: async (args): Promise<ToolProposal<UpdateEntityArgs>> => ({
      toolName: "update_entity",
      proposal: args,
      message: `Proposed updating ${args.entityType || "entity"}: "${args.entityName}"`,
    }),
  }),

  delete_entity: tool({
    description: "Propose deleting an entity from the author's world",
    inputSchema: deleteEntityParameters,
    execute: async (args): Promise<ToolProposal<DeleteEntityArgs>> => ({
      toolName: "delete_entity",
      proposal: args,
      message: `Proposed deleting ${args.entityType || "entity"}: "${args.entityName}"`,
    }),
  }),

  create_relationship: tool({
    description: "Propose creating a relationship between two entities",
    inputSchema: createRelationshipParameters,
    execute: async (args): Promise<ToolProposal<CreateRelationshipArgs>> => ({
      toolName: "create_relationship",
      proposal: args,
      message: `Proposed relationship: ${args.sourceName} ${args.type} ${args.targetName}`,
    }),
  }),

  update_relationship: tool({
    description: "Propose updating an existing relationship",
    inputSchema: updateRelationshipParameters,
    execute: async (args): Promise<ToolProposal<UpdateRelationshipArgs>> => ({
      toolName: "update_relationship",
      proposal: args,
      message: `Proposed updating relationship: ${args.sourceName} ${args.type} ${args.targetName}`,
    }),
  }),

  delete_relationship: tool({
    description: "Propose deleting a relationship between entities",
    inputSchema: deleteRelationshipParameters,
    execute: async (args): Promise<ToolProposal<DeleteRelationshipArgs>> => ({
      toolName: "delete_relationship",
      proposal: args,
      message: `Proposed deleting relationship: ${args.sourceName} ${args.type} ${args.targetName}`,
    }),
  }),

  generate_content: tool({
    description: "Generate creative content (description, backstory, dialogue, scene) for an entity or topic",
    inputSchema: generateContentParameters,
    execute: async (args): Promise<ToolProposal<GenerateContentArgs>> => ({
      toolName: "generate_content",
      proposal: args,
      message: `Proposed generating ${args.contentType} for: "${args.subject}"`,
    }),
  }),
};

/**
 * Saga analysis and generation tools.
 * These propose complex operations requiring user confirmation.
 */
export const sagaTools = {
  genesis_world: tool({
    description: "Generate a complete world scaffold from a story description",
    inputSchema: genesisWorldParameters,
    execute: async (args): Promise<ToolProposal<GenesisWorldArgs>> => ({
      toolName: "genesis_world",
      proposal: args,
      message: `Proposed world generation from: "${args.prompt.slice(0, 50)}..."`,
    }),
  }),

  detect_entities: tool({
    description: "Extract entities (characters, locations, items, etc.) from narrative text",
    inputSchema: detectEntitiesParameters,
    execute: async (args): Promise<ToolProposal<DetectEntitiesArgs>> => ({
      toolName: "detect_entities",
      proposal: args,
      message: `Proposed entity detection with scope: ${args.scope || "document"}`,
    }),
  }),

  check_consistency: tool({
    description: "Check narrative text for contradictions, timeline errors, and plot holes",
    inputSchema: checkConsistencyParameters,
    execute: async (args): Promise<ToolProposal<CheckConsistencyArgs>> => ({
      toolName: "check_consistency",
      proposal: args,
      message: `Proposed consistency check with scope: ${args.scope || "document"}`,
    }),
  }),

  generate_template: tool({
    description: "Create a custom project template with entity kinds, relationships, and linter rules",
    inputSchema: generateTemplateParameters,
    execute: async (args): Promise<ToolProposal<GenerateTemplateArgs>> => ({
      toolName: "generate_template",
      proposal: args,
      message: `Proposed template generation for: "${args.storyDescription.slice(0, 50)}..."`,
    }),
  }),

  clarity_check: tool({
    description: "Check prose for word/phrase-level clarity issues (ambiguous pronouns, cliches, etc.)",
    inputSchema: clarityCheckParameters,
    execute: async (args): Promise<ToolProposal<ClarityCheckArgs>> => ({
      toolName: "clarity_check",
      proposal: args,
      message: `Proposed clarity check with scope: ${args.scope || "document"}`,
    }),
  }),

  check_logic: tool({
    description:
      "Validate story logic against explicit rules (magic systems, causality, knowledge state, power scaling)",
    inputSchema: checkLogicParameters,
    execute: async (args): Promise<ToolProposal<CheckLogicArgs>> => ({
      toolName: "check_logic",
      proposal: args,
      message: `Proposed logic check with strictness: ${args.strictness || "balanced"}`,
    }),
  }),

  name_generator: tool({
    description: "Generate culturally-aware, genre-appropriate names for entities",
    inputSchema: nameGeneratorParameters,
    execute: async (args): Promise<ToolProposal<NameGeneratorArgs>> => ({
      toolName: "name_generator",
      proposal: args,
      message: `Proposed generating ${args.count || 10} ${args.culture || "fantasy"} names for ${args.entityType}`,
    }),
  }),
};

/**
 * All agent tools combined.
 */
export const sagaAgentTools = {
  ...coreTools,
  ...sagaTools,
} as const;

export type SagaToolName = keyof typeof sagaAgentTools;

// =============================================================================
// ToolLoopAgent Abstraction
// =============================================================================

/**
 * Configuration for the Saga ToolLoopAgent.
 */
export interface SagaAgentConfig {
  /** Maximum number of tool steps per run (default: 5) */
  maxSteps?: number;
  /** Temperature for generation (default: 0.7) */
  temperature?: number;
  /** Maximum tokens to generate (default: 4096) */
  maxTokens?: number;
  /** Custom tool executor for actual tool execution */
  toolExecutor?: (toolName: SagaToolName, args: unknown) => Promise<unknown>;
}

/**
 * Input for running the Saga agent.
 */
export interface SagaAgentInput {
  /** The language model to use */
  model: LanguageModel;
  /** Conversation messages */
  messages: ModelMessage[];
  /** Call options with context */
  options: SagaCallOptions;
  /** Optional config overrides */
  config?: Partial<SagaAgentConfig>;
}

/**
 * Result from a Saga agent run.
 */
export interface SagaAgentResult {
  /** Final text response */
  text: string;
  /** Tool calls made during the run */
  toolCalls: Array<{
    toolCallId: string;
    toolName: SagaToolName;
    args: unknown;
    result: unknown;
  }>;
  /** Whether max steps was reached */
  maxStepsReached: boolean;
  /** Token usage statistics */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * ToolLoopAgent abstraction for the Saga AI assistant.
 *
 * Encapsulates the tool loop pattern with:
 * - Dynamic system prompt building based on context
 * - Tool definitions for entity management and analysis
 * - Step limiting for controlled execution
 * - Streaming and non-streaming modes
 */
export class SagaAgent {
  private config: Required<SagaAgentConfig>;

  constructor(config: SagaAgentConfig = {}) {
    this.config = {
      maxSteps: config.maxSteps ?? 5,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 4096,
      toolExecutor: config.toolExecutor ?? (async () => undefined),
    };
  }

  /**
   * Build the system prompt for a call.
   */
  buildSystemPrompt(options: SagaCallOptions): string {
    return buildSagaSystemPrompt(options);
  }

  /**
   * Run the agent with streaming response.
   * Returns an async iterable for incremental processing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream(input: SagaAgentInput): StreamTextResult<typeof sagaAgentTools, any> {
    const { model, messages, options, config } = input;
    const mergedConfig = { ...this.config, ...config };

    const systemPrompt = this.buildSystemPrompt(options);
    const apiMessages: ModelMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

    return streamText({
      model,
      messages: apiMessages,
      tools: sagaAgentTools,
      stopWhen: stepCountIs(mergedConfig.maxSteps),
      temperature: mergedConfig.temperature,
      maxOutputTokens: mergedConfig.maxTokens,
    });
  }

  /**
   * Run the agent and wait for complete response.
   */
  async run(input: SagaAgentInput): Promise<SagaAgentResult> {
    const { model, messages, options, config } = input;
    const mergedConfig = { ...this.config, ...config };

    const systemPrompt = this.buildSystemPrompt(options);
    const apiMessages: ModelMessage[] = [{ role: "system", content: systemPrompt }, ...messages];

    const result = await generateText({
      model,
      messages: apiMessages,
      tools: sagaAgentTools,
      stopWhen: stepCountIs(mergedConfig.maxSteps),
      temperature: mergedConfig.temperature,
      maxOutputTokens: mergedConfig.maxTokens,
    });

    // Extract tool calls from steps
    const toolCalls: SagaAgentResult["toolCalls"] = [];
    for (const step of result.steps || []) {
      if (step.toolCalls) {
        for (const call of step.toolCalls) {
          // Find matching result
          const matchingResult = step.toolResults?.find(
            (r) => r.toolCallId === call.toolCallId
          );
          toolCalls.push({
            toolCallId: call.toolCallId,
            toolName: call.toolName as SagaToolName,
            args: call.input as Record<string, unknown>,
            result: matchingResult?.output,
          });
        }
      }
    }

    return {
      text: result.text,
      toolCalls,
      maxStepsReached: (result.steps?.length || 0) >= mergedConfig.maxSteps,
      usage: result.usage ? {
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      } : undefined,
    };
  }

  /**
   * Get the tools for external use (e.g., in Edge Functions).
   */
  getTools() {
    return sagaAgentTools;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

/**
 * Default Saga agent instance with standard configuration.
 */
export const sagaAgent = new SagaAgent();

// =============================================================================
// Type Exports for Frontend Consumption
// =============================================================================

/**
 * Union type of all possible tool arguments.
 */
export type SagaToolArgs =
  | CreateEntityArgs
  | UpdateEntityArgs
  | DeleteEntityArgs
  | CreateRelationshipArgs
  | UpdateRelationshipArgs
  | DeleteRelationshipArgs
  | GenerateContentArgs
  | GenesisWorldArgs
  | DetectEntitiesArgs
  | CheckConsistencyArgs
  | GenerateTemplateArgs
  | ClarityCheckArgs
  | CheckLogicArgs
  | NameGeneratorArgs;

/**
 * Type helper for inferring UI message types from the agent.
 */
export type InferAgentUIMessage<T> = T extends SagaAgent
  ? {
      role: "user" | "assistant" | "system";
      content: string;
      toolInvocations?: Array<{
        toolCallId: string;
        toolName: SagaToolName;
        args: SagaToolArgs;
        state: "partial-call" | "call" | "result";
        result?: unknown;
      }>;
    }
  : never;

/**
 * UI message type for Saga agent conversations.
 */
export type SagaAgentUIMessage = InferAgentUIMessage<typeof sagaAgent>;

// Re-export stepCountIs for external use
export { stepCountIs };
