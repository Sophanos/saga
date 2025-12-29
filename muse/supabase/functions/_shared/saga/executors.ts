/**
 * Saga Tool Executors
 *
 * Shared execution logic for expensive Saga operations.
 * Called from ai-saga endpoint when kind: "execute_tool".
 */

import { generateText } from "https://esm.sh/ai@3.4.0";
import { getOpenRouterModel } from "../providers.ts";
import {
  GENESIS_SYSTEM_PROMPT,
  buildGenesisUserPrompt,
} from "../prompts/mod.ts";

// =============================================================================
// Types (aligned with @mythos/agent-protocol)
// =============================================================================

export interface GenesisEntity {
  tempId: string;
  name: string;
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
}

export interface GenesisRelationship {
  sourceTempId: string;
  targetTempId: string;
  type: string;
  notes?: string;
}

export interface GenesisOutlineItem {
  title: string;
  summary: string;
  order: number;
}

export interface GenesisWorldResult {
  worldSummary: string;
  genre?: string;
  entities: GenesisEntity[];
  relationships: GenesisRelationship[];
  outline?: GenesisOutlineItem[];
}

export interface DetectedEntity {
  tempId: string;
  name: string;
  type: string;
  confidence: number;
  occurrences: Array<{
    startOffset: number;
    endOffset: number;
    matchedText: string;
    context: string;
  }>;
  suggestedAliases?: string[];
  suggestedProperties?: Record<string, unknown>;
}

export interface DetectEntitiesResult {
  entities: DetectedEntity[];
  warnings?: Array<{
    type: "ambiguous" | "low_confidence" | "possible_duplicate";
    message: string;
    entityTempId?: string;
  }>;
}

export interface ConsistencyIssue {
  id: string;
  type: "contradiction" | "timeline" | "character" | "world" | "plot_hole";
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
  locations: Array<{
    documentId?: string;
    line?: number;
    startOffset?: number;
    endOffset?: number;
    text: string;
  }>;
  entityIds?: string[];
}

export interface CheckConsistencyResult {
  issues: ConsistencyIssue[];
  summary?: string;
}

export interface TemplateDraft {
  name: string;
  description: string;
  category: string;
  tags: string[];
  baseTemplateId?: string;
  entityKinds: Array<{
    kind: string;
    label: string;
    labelPlural: string;
    category: string;
    color: string;
    icon: string;
    fields: Array<{
      id: string;
      label: string;
      kind: string;
      description?: string;
    }>;
  }>;
  relationshipKinds: Array<{
    kind: string;
    label: string;
    category: string;
  }>;
  documentKinds: Array<{
    kind: string;
    label: string;
    allowChildren?: boolean;
  }>;
  uiModules: Array<{
    module: string;
    enabled: boolean;
    order?: number;
  }>;
  linterRules: Array<{
    id: string;
    label: string;
    description: string;
    defaultSeverity: string;
    category: string;
  }>;
}

export interface GenerateTemplateResult {
  template: TemplateDraft;
  suggestedStarterEntities?: GenesisEntity[];
}

// =============================================================================
// Genesis World Executor
// =============================================================================

export async function executeGenesisWorld(
  input: {
    prompt: string;
    genre?: string;
    entityCount?: number;
    detailLevel?: "minimal" | "standard" | "detailed";
    includeOutline?: boolean;
  },
  apiKey: string
): Promise<GenesisWorldResult> {
  const userPrompt = buildGenesisUserPrompt({
    prompt: input.prompt,
    genre: input.genre,
    entityCount: input.entityCount ?? 10,
    detailLevel: input.detailLevel ?? "standard",
    includeOutline: input.includeOutline ?? true,
  });

  const model = getOpenRouterModel(apiKey, "creative");

  console.log("[saga/genesis] Generating world from:", input.prompt.slice(0, 50) + "...");

  const { text } = await generateText({
    model,
    system: GENESIS_SYSTEM_PROMPT,
    prompt: userPrompt,
    maxTokens: 4096,
    temperature: 0.8,
  });

  return parseGenesisResponse(text, input.genre);
}

function parseGenesisResponse(response: string, genre?: string): GenesisWorldResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Build relationships from entity relationships
      const relationships: GenesisRelationship[] = [];
      const entityMap = new Map<string, string>();

      // Validate and normalize entities
      const entities: GenesisEntity[] = (parsed.entities || [])
        .filter((e: Record<string, unknown>) => e && typeof e.name === "string" && typeof e.type === "string")
        .map((e: Record<string, unknown>, idx: number) => {
          const tempId = `temp_${idx}`;
          entityMap.set(e.name as string, tempId);
          return {
            tempId,
            name: e.name as string,
            type: e.type as string,
            description: (e.description as string) ?? "",
            properties: (e.properties as Record<string, unknown>) ?? {},
          };
        });

      // Extract relationships from entity definitions
      for (const rawEntity of parsed.entities || []) {
        if (rawEntity.relationships && Array.isArray(rawEntity.relationships)) {
          const sourceTempId = entityMap.get(rawEntity.name);
          if (!sourceTempId) continue;

          for (const rel of rawEntity.relationships) {
            const targetTempId = entityMap.get(rel.targetName);
            if (!targetTempId) continue;

            relationships.push({
              sourceTempId,
              targetTempId,
              type: rel.type || "knows",
              notes: rel.description,
            });
          }
        }
      }

      // Parse outline
      const outline: GenesisOutlineItem[] = (parsed.outline || []).map(
        (o: Record<string, unknown>, idx: number) => ({
          title: (o.title as string) || `Part ${idx + 1}`,
          summary: (o.summary as string) || "",
          order: idx,
        })
      );

      return {
        worldSummary: parsed.worldSummary || "A world waiting to be explored.",
        genre,
        entities,
        relationships,
        outline: outline.length > 0 ? outline : undefined,
      };
    }
  } catch (error) {
    console.error("[saga/genesis] Parse error:", error);
  }

  return {
    worldSummary: "Failed to generate world. Please try again.",
    genre,
    entities: [],
    relationships: [],
  };
}

// =============================================================================
// Detect Entities Executor
// =============================================================================

const DETECT_SYSTEM = `You are an entity detector for fiction writing. Given narrative text, identify and extract characters, locations, items, factions, magic systems, and events.

For each entity, provide:
- name: The entity's primary name as it appears
- type: One of "character", "location", "item", "faction", "magic_system", "event", "concept"
- confidence: 0.0-1.0 based on how certain you are
- occurrences: Array of positions where this entity appears

Output valid JSON:
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "character",
      "confidence": 0.95,
      "occurrences": [
        { "startOffset": 0, "endOffset": 10, "matchedText": "the text", "context": "surrounding context" }
      ],
      "suggestedAliases": ["nickname"],
      "suggestedProperties": { "trait": "value" }
    }
  ],
  "warnings": [
    { "type": "ambiguous", "message": "Description of issue" }
  ]
}`;

export async function executeDetectEntities(
  input: {
    text: string;
    minConfidence?: number;
    maxEntities?: number;
    entityTypes?: string[];
  },
  apiKey: string
): Promise<DetectEntitiesResult> {
  const model = getOpenRouterModel(apiKey, "analysis");

  let userPrompt = `Analyze this text and extract entities:\n\n"${input.text}"`;
  if (input.entityTypes?.length) {
    userPrompt += `\n\nFocus on these entity types: ${input.entityTypes.join(", ")}`;
  }
  if (input.maxEntities) {
    userPrompt += `\n\nReturn at most ${input.maxEntities} entities.`;
  }

  console.log("[saga/detect] Detecting entities in text of length:", input.text.length);

  const { text } = await generateText({
    model,
    system: DETECT_SYSTEM,
    prompt: userPrompt,
    maxTokens: 2048,
    temperature: 0.3,
  });

  return parseDetectResponse(text, input.minConfidence ?? 0.7);
}

function parseDetectResponse(response: string, minConfidence: number): DetectEntitiesResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const entities: DetectedEntity[] = (parsed.entities || [])
        .filter((e: Record<string, unknown>) => {
          const conf = (e.confidence as number) ?? 0.5;
          return conf >= minConfidence;
        })
        .map((e: Record<string, unknown>, idx: number) => ({
          tempId: `detected_${idx}`,
          name: e.name as string,
          type: e.type as string,
          confidence: (e.confidence as number) ?? 0.5,
          occurrences: Array.isArray(e.occurrences) ? e.occurrences : [],
          suggestedAliases: e.suggestedAliases as string[] | undefined,
          suggestedProperties: e.suggestedProperties as Record<string, unknown> | undefined,
        }));

      return {
        entities,
        warnings: parsed.warnings,
      };
    }
  } catch (error) {
    console.error("[saga/detect] Parse error:", error);
  }

  return { entities: [] };
}

// =============================================================================
// Check Consistency Executor
// =============================================================================

const CONSISTENCY_SYSTEM = `You are a story consistency checker. Analyze narrative text for contradictions, plot holes, timeline errors, and logical inconsistencies.

For each issue found, provide:
- type: "contradiction", "timeline", "character", "world", or "plot_hole"
- severity: "error" (definite problem), "warning" (potential issue), "info" (minor note)
- message: Clear description of the issue
- suggestion: How to fix it
- locations: Where in the text the issue occurs

Output valid JSON:
{
  "issues": [
    {
      "id": "issue_1",
      "type": "contradiction",
      "severity": "error",
      "message": "Marcus is described as having blue eyes in paragraph 1, but brown eyes in paragraph 5",
      "suggestion": "Choose one eye color and update the inconsistent reference",
      "locations": [
        { "text": "his blue eyes sparkled", "line": 3 },
        { "text": "brown eyes narrowed", "line": 15 }
      ],
      "entityIds": []
    }
  ],
  "summary": "Found 2 issues: 1 error, 1 warning"
}`;

export async function executeCheckConsistency(
  input: {
    text: string;
    focus?: string[];
    entities?: Array<{ id: string; name: string; type: string; properties?: Record<string, unknown> }>;
  },
  apiKey: string
): Promise<CheckConsistencyResult> {
  const model = getOpenRouterModel(apiKey, "analysis");

  let userPrompt = `Analyze this text for consistency issues:\n\n"${input.text}"`;
  if (input.focus?.length) {
    userPrompt += `\n\nFocus on: ${input.focus.join(", ")}`;
  }
  if (input.entities?.length) {
    userPrompt += "\n\nKnown entities to check against:\n";
    for (const e of input.entities.slice(0, 20)) {
      userPrompt += `- ${e.name} (${e.type})`;
      if (e.properties) {
        const props = Object.entries(e.properties)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        if (props) userPrompt += `: ${props}`;
      }
      userPrompt += "\n";
    }
  }

  console.log("[saga/consistency] Checking consistency of text length:", input.text.length);

  const { text } = await generateText({
    model,
    system: CONSISTENCY_SYSTEM,
    prompt: userPrompt,
    maxTokens: 2048,
    temperature: 0.3,
  });

  return parseConsistencyResponse(text);
}

function parseConsistencyResponse(response: string): CheckConsistencyResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      const issues: ConsistencyIssue[] = (parsed.issues || []).map(
        (issue: Record<string, unknown>, idx: number) => ({
          id: (issue.id as string) || `issue_${idx}`,
          type: issue.type as ConsistencyIssue["type"],
          severity: issue.severity as ConsistencyIssue["severity"],
          message: (issue.message as string) || "Unknown issue",
          suggestion: issue.suggestion as string | undefined,
          locations: Array.isArray(issue.locations) ? issue.locations : [],
          entityIds: issue.entityIds as string[] | undefined,
        })
      );

      return {
        issues,
        summary: parsed.summary as string | undefined,
      };
    }
  } catch (error) {
    console.error("[saga/consistency] Parse error:", error);
  }

  return { issues: [] };
}

// =============================================================================
// Generate Template Executor
// =============================================================================

const TEMPLATE_SYSTEM = `You are a project template generator for Mythos IDE, a creative writing tool.

Generate a custom project template based on the story description. The template defines:
- entityKinds: Custom entity types for this story (e.g., "dragon" for fantasy, "starship" for sci-fi)
- relationshipKinds: How entities relate (e.g., "commands", "rivals", "blood_bound")
- documentKinds: Types of documents (chapters, scenes, notes)
- linterRules: Consistency rules specific to this genre
- uiModules: Which UI panels to enable

Output valid JSON matching this structure:
{
  "template": {
    "name": "Template Name",
    "description": "What this template is for",
    "category": "fantasy" | "scifi" | "horror" | "literary" | "ttrpg" | "manga" | "visual" | "screenplay" | "serial" | "custom",
    "tags": ["tag1", "tag2"],
    "entityKinds": [
      {
        "kind": "dragon",
        "label": "Dragon",
        "labelPlural": "Dragons",
        "category": "agent",
        "color": "#FF5733",
        "icon": "Flame",
        "fields": [
          { "id": "element", "label": "Element", "kind": "enum", "description": "The dragon's elemental affinity" }
        ]
      }
    ],
    "relationshipKinds": [
      { "kind": "rider_of", "label": "Rider of", "category": "power" }
    ],
    "documentKinds": [
      { "kind": "chapter", "label": "Chapter", "allowChildren": true }
    ],
    "linterRules": [
      { "id": "dragon_consistency", "label": "Dragon Element Consistency", "description": "Ensure dragon elements don't contradict", "defaultSeverity": "warning", "category": "world" }
    ],
    "uiModules": [
      { "module": "world_graph", "enabled": true, "order": 1 }
    ]
  },
  "suggestedStarterEntities": [
    { "tempId": "temp_0", "name": "Example Character", "type": "character" }
  ]
}`;

export async function executeGenerateTemplate(
  input: {
    storyDescription: string;
    genreHints?: string[];
    complexity?: "simple" | "standard" | "complex";
    baseTemplateId?: string;
  },
  apiKey: string
): Promise<GenerateTemplateResult> {
  const model = getOpenRouterModel(apiKey, "creative");

  let userPrompt = `Generate a project template for this story:\n\n"${input.storyDescription}"`;
  if (input.genreHints?.length) {
    userPrompt += `\n\nGenre hints: ${input.genreHints.join(", ")}`;
  }
  if (input.complexity) {
    const complexityGuide = {
      simple: "Keep it simple: 2-3 custom entity types, basic relationships",
      standard: "Standard complexity: 4-6 entity types, moderate customization",
      complex: "Full complexity: 6+ entity types, many custom fields and rules",
    };
    userPrompt += `\n\n${complexityGuide[input.complexity]}`;
  }
  if (input.baseTemplateId) {
    userPrompt += `\n\nBase this on the "${input.baseTemplateId}" template, customizing for the specific story.`;
  }

  console.log("[saga/template] Generating template for:", input.storyDescription.slice(0, 50) + "...");

  const { text } = await generateText({
    model,
    system: TEMPLATE_SYSTEM,
    prompt: userPrompt,
    maxTokens: 3000,
    temperature: 0.7,
  });

  return parseTemplateResponse(text);
}

function parseTemplateResponse(response: string): GenerateTemplateResult {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Ensure template has required fields
      const template: TemplateDraft = {
        name: parsed.template?.name || "Custom Template",
        description: parsed.template?.description || "",
        category: parsed.template?.category || "custom",
        tags: parsed.template?.tags || [],
        entityKinds: parsed.template?.entityKinds || [],
        relationshipKinds: parsed.template?.relationshipKinds || [],
        documentKinds: parsed.template?.documentKinds || [
          { kind: "chapter", label: "Chapter", allowChildren: true },
          { kind: "scene", label: "Scene", allowChildren: false },
        ],
        uiModules: parsed.template?.uiModules || [
          { module: "entity_panel", enabled: true, order: 1 },
          { module: "world_graph", enabled: true, order: 2 },
        ],
        linterRules: parsed.template?.linterRules || [],
      };

      return {
        template,
        suggestedStarterEntities: parsed.suggestedStarterEntities,
      };
    }
  } catch (error) {
    console.error("[saga/template] Parse error:", error);
  }

  // Return minimal template
  return {
    template: {
      name: "Custom Template",
      description: "Failed to generate. Using defaults.",
      category: "custom",
      tags: [],
      entityKinds: [],
      relationshipKinds: [],
      documentKinds: [{ kind: "chapter", label: "Chapter", allowChildren: true }],
      uiModules: [{ module: "entity_panel", enabled: true, order: 1 }],
      linterRules: [],
    },
  };
}
