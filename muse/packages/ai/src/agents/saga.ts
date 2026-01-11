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
  documentId: z.string().optional(),
  documentTitle: z.string().optional(),
  documentExcerpt: z.string().optional(),
  selectionText: z.string().optional(),
  selectionContext: z.string().optional(),
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
 * Mention context for explicitly referenced documents and entities.
 */
export const MentionedDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  contentText: z.string(),
  docType: z.string().optional(),
});
export const MentionedEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  entityType: z.string(),
  summaryText: z.string(),
});
export const MentionContextSchema = z.object({
  documents: z.array(MentionedDocumentSchema),
  entities: z.array(MentionedEntitySchema),
});
export type MentionContext = z.infer<typeof MentionContextSchema>;

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
  /** Explicitly mentioned context (documents and entities) */
  mentionContext: MentionContextSchema.optional(),
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

You help writers and teams build worlds, track entities, and maintain narrative or domain consistency.

Primary audiences include fiction writers, game designers, tabletop GMs, educators, researchers, and product teams building structured knowledge.

## Your Capabilities

You have access to powerful tools organized into two categories:

### World Building & Analysis Tools (Saga Tools)
These propose complex operations that require user confirmation:

1. **project_manage** - Bootstrap or migrate a project
   - Use when: The author or team is starting a new project and wants structure (with or without starter content)
   - Bootstrap always generates template structure
   - Ask first (plain question or ask_question tool if available):
     - "Create structure + starter content (recommended)" → seed: true
     - "Just the structure - I'll add my own content" → seed: false
   - Then call: { action: "bootstrap", description, seed } (+ optional genre/entityCount/detailLevel/includeOutline)

2. **genesis_world** - Generate a complete world from a story description
   - Use when: The author or team wants a world scaffold preview (no project changes)
   - Creates: Characters, locations, items, factions, relationships, optional outline

3. **analyze_content** - Unified analysis for entities, consistency, logic, clarity, or policy
   - Use when: The author or team wants diagnostics on a passage or selection
   - Modes: entities | consistency | logic | clarity | policy
   - Creates: Structured issues or detected entities

4. **generate_template** - Create a custom project template
   - Use when: The author or team describes their story type and wants custom entity types
   - Creates: Template with entity kinds, relationships, linter rules

5. **name_generator** - Generate culturally-aware names
   - Use when: The author or team needs character or place names
   - Creates: List of names with meanings and pronunciation

### Entity Management Tools (Core Tools)
These modify the project's knowledge graph directly:

- **graph_mutation** - Create/update/delete entities/nodes and relationships/edges
- **generate_content** - Create backstories, descriptions, dialogue, scenes

## Intent Detection & Tool Selection

Based on the user's message, determine the right approach:

| If the author says... | Use this tool |
|-----------------------|---------------|
| "I'm starting a new project about..." | project_manage |
| "Build me a world about..." | genesis_world |
| "Create a template for my story about..." | generate_template |
| "Find/detect/extract entities in..." | analyze_content (mode: "entities") |
| "Check for inconsistencies/contradictions" | analyze_content (mode: "consistency") |
| "Check the clarity/readability of..." | analyze_content (mode: "clarity") |
| "Check the logic/rules of..." | analyze_content (mode: "logic") |
| "Generate names for..." | name_generator |
| "Create a character named..." | graph_mutation (action: "create", target: "entity") |
| "What are Marcus's relationships?" | Answer from context (no tool) |
| "Add a rivalry between X and Y" | graph_mutation (action: "create", target: "relationship") |

## Copilot Mode Rules (High Priority)

- When context is empty and the author is starting a new project, ask seed vs no-seed, then propose project_manage.
- When context is empty and the author asks for world structure, setting, or premise (without implying persistence), propose genesis_world.
- When the author or team provides text (selection, excerpt, or pasted) and asks to extract structure, propose analyze_content with mode "entities".
- When they ask for consistency or logic without text, ask for a passage and offer analyze_content with mode "consistency" or "logic".
- When visuals are requested and image tools are available, prefer existing image search before generating new art.

## Response Guidelines

1. **Be concise but helpful** - Don't over-explain unless asked
2. **Use retrieved context** - Reference specific elements from the author's world
3. **Propose don't assume** - Tools create proposals that authors can accept or modify
4. **Match the author's voice** - Use their terminology and naming conventions
5. **Ask when unclear** - If a request is ambiguous, ask for clarification

## Tool Proposal Format

When using a Saga tool (project_manage, genesis_world, analyze_content, generate_template, name_generator):
- Briefly explain what you're about to do
- Make the tool call with appropriate parameters
- The author will see the proposal and can accept, modify, or reject it

When using Core tools (graph_mutation, generate_content):
- Summarize what you're creating
- Make the tool call
- The author can accept or reject each proposal

## Important Notes

- All tools create "proposals" - nothing is written to the database until the user accepts
- Use entity names (not IDs) when referencing existing entities
- Be creative but consistent with established world rules or domain constraints
- If no context is retrieved, you may still answer general writing or planning questions`;

const SAGA_MODE_ADDENDUMS: Record<SagaMode, string> = {
  onboarding: `
## Onboarding Context

The author or team is just starting. Focus on:
- Understanding their story vision
- Using project_manage (bootstrap) for structure + optional starter content (seed: true/false)
- Or generate_template if they describe a specific genre/structure

Be welcoming and encouraging. This might be their first creative writing tool.`,

  creation: `
## Project Creation Context

The author or team is setting up a new project. Focus on:
- project_manage (bootstrap) for structure + optional starter content (seed: true/false)
- generate_template for custom structure
- Help them choose between builtin templates or custom generation`,

  editing: `
## Editing Context

The author or team is actively creating. Focus on:
- Quick entity creation for new characters/places mentioned
- Relationship tracking as the story develops
- analyze_content (mode: "entities") if they paste external content
- analyze_content (mode: "consistency") if they ask about plot holes`,

  analysis: `
## Analysis Context

The author or team wants feedback. Focus on:
- analyze_content (mode: "consistency") for contradictions and plot holes
- analyze_content (mode: "clarity") for readability improvements
- analyze_content (mode: "logic") for rule validation
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

const SAGA_MENTION_CONTEXT_TEMPLATE = `## Mentioned Context

The author explicitly referenced the following items. Prioritize these over retrieved context.

### Documents
{documents}

### Entities
{entities}

Use this to focus the response.`;

const SAGA_CONTEXT_TEMPLATE = `## Retrieved Context

The following was retrieved from the author's story world:

### Documents
{documents}

### Entities
{entities}

Use this to provide relevant, consistent answers.`;

const SAGA_EDITOR_CONTEXT_TEMPLATE = `## Current Editor Context

**Document:** {documentTitle}
{contextLines}

Consider this when responding.`;

const SAGA_NO_CONTEXT = `No specific context was retrieved for this query.

Default behaviors when context is empty:
- For starting a new project, ask seed vs no-seed, then propose project_manage.
- For world structure, setting, or premise requests (without implying persistence), propose genesis_world.
- For extracting structure from provided text, propose analyze_content with mode "entities".
- For consistency or logic checks without text, ask for a passage and offer analyze_content with mode "consistency" or "logic".
- For visual requests, prefer existing image search before generating new art.`;

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
  mentionContext?: MentionContext;
  editorContext?: EditorContext;
  profileContext?: ProfileContext;
  memoryContext?: RetrievedMemoryContext;
}): string {
  const { mode, ragContext, mentionContext, editorContext, profileContext, memoryContext } = options;
  const mentionDocsCount = mentionContext?.documents.length ?? 0;
  const mentionEntitiesCount = mentionContext?.entities.length ?? 0;
  const ragDocsCount = ragContext?.documents.length ?? 0;
  const ragEntitiesCount = ragContext?.entities.length ?? 0;
  const editorHasText = Boolean(
    editorContext?.selectionText?.trim() || editorContext?.documentExcerpt?.trim()
  );

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

  prompt += "\n\n## Context Availability" +
    `\n- Mentioned docs: ${mentionDocsCount}` +
    `\n- Mentioned entities: ${mentionEntitiesCount}` +
    `\n- Retrieved docs: ${ragDocsCount}` +
    `\n- Retrieved entities: ${ragEntitiesCount}` +
    `\n- Editor text: ${editorHasText ? "yes" : "no"}`;

  // Add mention context
  if (mentionContext && (mentionDocsCount > 0 || mentionEntitiesCount > 0)) {
    const docsText = mentionDocsCount > 0
      ? mentionContext.documents
          .map((doc) => {
            const typeLabel = doc.docType ? ` (${doc.docType})` : "";
            const preview = doc.contentText || "No text available.";
            return `- **${doc.title}**${typeLabel}: ${preview}`;
          })
          .join("\n")
      : "None mentioned.";
    const entitiesText = mentionEntitiesCount > 0
      ? mentionContext.entities
          .map((entity) => `- **${entity.name}** (${entity.entityType}): ${entity.summaryText}`)
          .join("\n")
      : "None mentioned.";

    prompt += "\n\n" + SAGA_MENTION_CONTEXT_TEMPLATE
      .replace("{documents}", docsText)
      .replace("{entities}", entitiesText);
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
    const contextLines: string[] = [];
    const selectionText = editorContext.selectionText?.trim();
    const selectionContext = editorContext.selectionContext?.trim();
    const documentExcerpt = editorContext.documentExcerpt?.trim();

    if (selectionText) {
      contextLines.push(
        `**Selected text:** "${selectionText.slice(0, 200)}${selectionText.length > 200 ? "..." : ""}"`
      );
      if (selectionContext) {
        contextLines.push(
          `**Selection context:** "${selectionContext.slice(0, 400)}${selectionContext.length > 400 ? "..." : ""}"`
        );
      }
    } else if (documentExcerpt) {
      contextLines.push(
        `**Document excerpt:** "${documentExcerpt.slice(0, 400)}${documentExcerpt.length > 400 ? "..." : ""}"`
      );
    }

    if (contextLines.length > 0) {
      prompt +=
        "\n\n" +
        SAGA_EDITOR_CONTEXT_TEMPLATE.replace("{documentTitle}", editorContext.documentTitle).replace(
          "{contextLines}",
          contextLines.join("\n")
        );
    }
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

const graphMutationParameters = z.union([
  z.object({
    action: z.literal("create"),
    target: z.enum(["entity", "node"]),
    type: EntityTypeSchema.describe("Entity/node type"),
    name: z.string().describe("Entity/node name"),
    aliases: z.array(z.string()).optional().describe("Alternative names or nicknames"),
    notes: z.string().optional().describe("General notes about the entity/node"),
    properties: z.record(z.any()).optional().describe("Template-specific properties"),
    archetype: z.string().optional().describe("Character archetype"),
    backstory: z.string().optional().describe("Character backstory"),
    goals: z.array(z.string()).optional().describe("Character goals"),
    fears: z.array(z.string()).optional().describe("Character fears"),
  }),
  z.object({
    action: z.literal("update"),
    target: z.enum(["entity", "node"]),
    entityName: z.string().describe("Existing entity/node name"),
    entityType: EntityTypeSchema.optional().describe("Entity/node type (for disambiguation)"),
    updates: z.record(z.any()).describe("Fields to update"),
  }),
  z.object({
    action: z.literal("delete"),
    target: z.enum(["entity", "node"]),
    entityName: z.string().describe("Entity/node name to delete"),
    entityType: EntityTypeSchema.optional().describe("Entity/node type (for disambiguation)"),
    reason: z.string().optional().describe("Reason for deletion"),
  }),
  z.object({
    action: z.literal("create"),
    target: z.enum(["relationship", "edge"]),
    type: RelationTypeSchema.describe("Relationship/edge type"),
    sourceName: z.string().describe("Source entity/node name"),
    targetName: z.string().describe("Target entity/node name"),
    bidirectional: z.boolean().optional().describe("Whether the relationship is bidirectional"),
    strength: z.number().min(0).max(1).optional().describe("Relationship strength (0-1)"),
    notes: z.string().optional().describe("Notes about the relationship"),
    metadata: z.record(z.any()).optional().describe("Relationship metadata"),
  }),
  z.object({
    action: z.literal("update"),
    target: z.enum(["relationship", "edge"]),
    type: RelationTypeSchema.describe("Relationship/edge type"),
    sourceName: z.string().describe("Source entity/node name"),
    targetName: z.string().describe("Target entity/node name"),
    updates: z.record(z.any()).describe("Fields to update"),
  }),
  z.object({
    action: z.literal("delete"),
    target: z.enum(["relationship", "edge"]),
    type: RelationTypeSchema.describe("Relationship/edge type"),
    sourceName: z.string().describe("Source entity/node name"),
    targetName: z.string().describe("Target entity/node name"),
    reason: z.string().optional().describe("Reason for deletion"),
  }),
]);

export type GraphMutationArgs = z.infer<typeof graphMutationParameters>;

const analyzeContentParameters = z.object({
  mode: z.enum(["consistency", "entities", "logic", "clarity", "policy"]),
  text: z.string().describe("Text to analyze"),
  options: z
    .object({
      focus: z.array(z.string()).optional().describe("Focus labels for the analysis"),
      strictness: LogicStrictnessSchema.optional().describe("Strictness level for logic checks"),
      maxIssues: z.number().min(1).max(200).optional().describe("Maximum issues to return"),
      entityTypes: z.array(EntityTypeSchema).optional().describe("Entity type filters for detection"),
      minConfidence: z.number().min(0).max(1).optional().describe("Minimum confidence for detection"),
    })
    .optional(),
});

export type AnalyzeContentArgs = z.infer<typeof analyzeContentParameters>;

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

const projectManageBootstrapParameters = z.object({
  action: z.literal("bootstrap"),
  description: z.string().describe("High-level story or world description"),
  seed: z.boolean().default(true).describe("Whether to persist starter entities/relationships (default true)"),
  genre: z.string().optional().describe("Optional genre hint"),
  entityCount: z.number().min(3).max(50).optional().describe("Target number of entities (3-50)"),
  detailLevel: GenesisDetailLevelSchema.optional().describe("How detailed the generation should be"),
  includeOutline: z.boolean().optional().describe("Whether to include a story outline"),
  skipEntityTypes: z.array(z.string()).optional().describe("Entity types to skip during persistence"),
});

const projectManageRestructureParameters = z.object({
  action: z.literal("restructure"),
  changes: z
    .array(
      z.union([
        z.object({
          op: z.literal("rename_type"),
          from: z.string().describe("Existing entity type name"),
          to: z.string().describe("New entity type name"),
        }),
        z.object({
          op: z.literal("add_field"),
          type: z.string().describe("Entity type name"),
          field: z.string().describe("Field name to add"),
        }),
      ])
    )
    .min(1)
    .describe("Restructure operations to apply"),
});

const projectManagePivotParameters = z.object({
  action: z.literal("pivot"),
  toTemplate: z.string().describe("Target template id"),
  mappings: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .optional()
    .describe("Optional type mappings"),
  unmappedContent: z.enum(["archive", "discard"]).optional().describe("What to do with unmapped content"),
});

const projectManageParameters = z.discriminatedUnion("action", [
  projectManageBootstrapParameters,
  projectManageRestructureParameters,
  projectManagePivotParameters,
]);

export type ProjectManageArgs = z.infer<typeof projectManageParameters>;

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

function describeGraphMutation(args: GraphMutationArgs): string {
  const targetLabel = args.target === "edge" ? "relationship" : args.target;

  if (args.target === "relationship" || args.target === "edge") {
    const relation = `${args.sourceName} ${args.type} ${args.targetName}`;
    if (args.action === "create") {
      return `Proposed creating ${targetLabel}: ${relation}`;
    }
    if (args.action === "update") {
      return `Proposed updating ${targetLabel}: ${relation}`;
    }
    return `Proposed deleting ${targetLabel}: ${relation}`;
  }

  const name = args.action === "create" ? args.name : args.entityName;
  if (args.action === "create") {
    return `Proposed creating ${targetLabel}: "${name}"`;
  }
  if (args.action === "update") {
    return `Proposed updating ${targetLabel}: "${name}"`;
  }
  return `Proposed deleting ${targetLabel}: "${name}"`;
}

function describeAnalyzeContent(args: AnalyzeContentArgs): string {
  return `Proposed ${args.mode} analysis`;
}

/**
 * Core entity/relationship tools.
 * These create proposals for user confirmation.
 */
export const coreTools = {
  graph_mutation: tool({
    description: "Propose graph mutations for entities/nodes and relationships/edges",
    inputSchema: graphMutationParameters,
    execute: async (args): Promise<ToolProposal<GraphMutationArgs>> => ({
      toolName: "graph_mutation",
      proposal: args,
      message: describeGraphMutation(args),
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
  project_manage: tool({
    description: "Bootstrap or migrate a project (ask first: structure-only vs structure+starter content)",
    inputSchema: projectManageParameters,
    execute: async (args): Promise<ToolProposal<ProjectManageArgs>> => {
      let message = "Proposed project operation";
      if (args.action === "bootstrap") {
        const seed = args.seed ?? true;
        const mode = seed ? "structure + seed" : "structure only";
        message = `Proposed project bootstrap (${mode}): "${args.description.slice(0, 50)}..."`;
      } else if (args.action === "restructure") {
        message = `Proposed project restructure (${args.changes.length} changes)`;
      } else {
        message = `Proposed project pivot → ${args.toTemplate}`;
      }
      return {
        toolName: "project_manage",
        proposal: args,
        message,
      };
    },
  }),

  genesis_world: tool({
    description: "Generate a complete world scaffold from a story description",
    inputSchema: genesisWorldParameters,
    execute: async (args): Promise<ToolProposal<GenesisWorldArgs>> => ({
      toolName: "genesis_world",
      proposal: args,
      message: `Proposed world generation from: "${args.prompt.slice(0, 50)}..."`,
    }),
  }),

  analyze_content: tool({
    description: "Analyze content for entities, consistency, logic, clarity, or policy issues",
    inputSchema: analyzeContentParameters,
    execute: async (args): Promise<ToolProposal<AnalyzeContentArgs>> => ({
      toolName: "analyze_content",
      proposal: args,
      message: describeAnalyzeContent(args),
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
  | GraphMutationArgs
  | AnalyzeContentArgs
  | CreateEntityArgs
  | UpdateEntityArgs
  | DeleteEntityArgs
  | CreateRelationshipArgs
  | UpdateRelationshipArgs
  | DeleteRelationshipArgs
  | GenerateContentArgs
  | ProjectManageArgs
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
