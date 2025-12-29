/**
 * Saga Tool Executors
 *
 * Shared execution logic for expensive Saga operations.
 * Called from ai-saga endpoint when kind: "execute_tool".
 */

import { generateText } from "https://esm.sh/ai@4.0.0";
import { getOpenRouterModel } from "../providers.ts";
import {
  GENESIS_SYSTEM_PROMPT,
  buildGenesisUserPrompt,
} from "../prompts/mod.ts";
import { CLARITY_CHECK_SYSTEM, QUICK_CLARITY_PROMPT } from "../prompts/clarity.ts";

// =============================================================================
// Input Validation
// =============================================================================

const MAX_INPUT_LENGTH = 50000;

function truncateText(text: string): string {
  return text.length > MAX_INPUT_LENGTH
    ? text.slice(0, MAX_INPUT_LENGTH) + "...[truncated]"
    : text;
}
import {
  type EntityType,
  type RelationType,
} from "../tools/types.ts";

// =============================================================================
// Types (aligned with @mythos/agent-protocol)
// =============================================================================

export interface GenesisEntity {
  tempId: string;
  name: string;
  type: EntityType;
  description?: string;
  properties?: Record<string, unknown>;
}

export interface GenesisRelationship {
  sourceTempId: string;
  targetTempId: string;
  type: RelationType;
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
  type: EntityType;
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
// Shared JSON Parsing Utility
// =============================================================================

/**
 * Generic JSON parser for LLM responses.
 * Extracts JSON from text, parses it, and transforms the result.
 */
function parseJsonFromLLMResponse<T>(
  response: string,
  toolName: string,
  transformer: (parsed: Record<string, unknown>) => T,
  fallback: T
): T {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return transformer(parsed);
    }
  } catch (error) {
    console.error(`[saga/${toolName}] Parse error:`, error);
  }
  return fallback;
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
  const fallback: GenesisWorldResult = {
    worldSummary: "Failed to generate world. Please try again.",
    genre,
    entities: [],
    relationships: [],
  };

  return parseJsonFromLLMResponse(
    response,
    "genesis",
    (parsed) => {
      // Build relationships from entity relationships
      const relationships: GenesisRelationship[] = [];
      const entityMap = new Map<string, string>();

      // Validate and normalize entities
      const entities: GenesisEntity[] = (parsed.entities as unknown[] || [])
        .filter((e: unknown) => {
          const entity = e as Record<string, unknown>;
          return entity && typeof entity.name === "string" && typeof entity.type === "string";
        })
        .map((e: unknown, idx: number) => {
          const entity = e as Record<string, unknown>;
          const tempId = `temp_${idx}`;
          entityMap.set(entity.name as string, tempId);
          return {
            tempId,
            name: entity.name as string,
            type: entity.type as EntityType,
            description: (entity.description as string) ?? "",
            properties: (entity.properties as Record<string, unknown>) ?? {},
          };
        });

      // Extract relationships from entity definitions
      for (const rawEntity of (parsed.entities as unknown[]) || []) {
        const entity = rawEntity as Record<string, unknown>;
        if (entity.relationships && Array.isArray(entity.relationships)) {
          const sourceTempId = entityMap.get(entity.name as string);
          if (!sourceTempId) continue;

          for (const rel of entity.relationships as Record<string, unknown>[]) {
            const targetTempId = entityMap.get(rel.targetName as string);
            if (!targetTempId) continue;

            relationships.push({
              sourceTempId,
              targetTempId,
              type: (rel.type as RelationType) || "knows",
              notes: rel.description as string | undefined,
            });
          }
        }
      }

      // Parse outline
      const outline: GenesisOutlineItem[] = (parsed.outline as unknown[] || []).map(
        (o: unknown, idx: number) => {
          const item = o as Record<string, unknown>;
          return {
            title: (item.title as string) || `Part ${idx + 1}`,
            summary: (item.summary as string) || "",
            order: idx,
          };
        }
      );

      return {
        worldSummary: (parsed.worldSummary as string) || "A world waiting to be explored.",
        genre,
        entities,
        relationships,
        outline: outline.length > 0 ? outline : undefined,
      };
    },
    fallback
  );
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

  const truncatedText = truncateText(input.text);
  let userPrompt = `Analyze this text and extract entities:\n\n"${truncatedText}"`;
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
  return parseJsonFromLLMResponse(
    response,
    "detect",
    (parsed) => {
      const entities: DetectedEntity[] = (parsed.entities as unknown[] || [])
        .filter((e: unknown) => {
          const entity = e as Record<string, unknown>;
          const conf = (entity.confidence as number) ?? 0.5;
          return conf >= minConfidence;
        })
        .map((e: unknown, idx: number) => {
          const entity = e as Record<string, unknown>;
          return {
            tempId: `detected_${idx}`,
            name: entity.name as string,
            type: entity.type as EntityType,
            confidence: (entity.confidence as number) ?? 0.5,
            occurrences: Array.isArray(entity.occurrences) ? entity.occurrences : [],
            suggestedAliases: entity.suggestedAliases as string[] | undefined,
            suggestedProperties: entity.suggestedProperties as Record<string, unknown> | undefined,
          };
        });
      return {
        entities,
        warnings: parsed.warnings as DetectEntitiesResult["warnings"],
      };
    },
    { entities: [], warnings: undefined }
  );
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

  const truncatedText = truncateText(input.text);
  let userPrompt = `Analyze this text for consistency issues:\n\n"${truncatedText}"`;
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
  return parseJsonFromLLMResponse(
    response,
    "consistency",
    (parsed) => {
      const issues: ConsistencyIssue[] = (parsed.issues as unknown[] || []).map(
        (issue: unknown, idx: number) => {
          const i = issue as Record<string, unknown>;
          return {
            id: (i.id as string) || `issue_${idx}`,
            type: i.type as ConsistencyIssue["type"],
            severity: i.severity as ConsistencyIssue["severity"],
            message: (i.message as string) || "Unknown issue",
            suggestion: i.suggestion as string | undefined,
            locations: Array.isArray(i.locations) ? i.locations : [],
            entityIds: i.entityIds as string[] | undefined,
          };
        }
      );
      return {
        issues,
        summary: parsed.summary as string | undefined,
      };
    },
    { issues: [], summary: undefined }
  );
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

// =============================================================================
// Clarity Check Executor
// =============================================================================

// Clarity check types are defined inline for Deno edge function compatibility.
// Type inference is used where possible; explicit types enable proper exports.

/** Issue types detected by the clarity checker */
export type ClarityIssueType =
  | "ambiguous_pronoun"
  | "unclear_antecedent"
  | "cliche"
  | "filler_word"
  | "dangling_modifier";

/** Readability metrics computed deterministically (no LLM needed) */
export interface ReadabilityMetrics {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  sentenceCount: number;
  wordCount: number;
  avgWordsPerSentence: number;
  longSentencePct?: number;
}

/** Individual clarity issue found in text */
export interface ClarityCheckIssue {
  id: string;
  type: ClarityIssueType;
  text: string;
  line?: number;
  position?: { start: number; end: number };
  suggestion: string;
  fix?: { oldText: string; newText: string };
}

/** Result of clarity check analysis */
export interface ClarityCheckResult {
  metrics: ReadabilityMetrics;
  issues: ClarityCheckIssue[];
  summary?: string;
}

/**
 * Compute readability metrics deterministically (no LLM needed).
 */
function computeReadabilityMetrics(text: string): ReadabilityMetrics {
  // Split into sentences (simple regex approach)
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;

  // Split into words
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length || 1;

  // Count syllables (simple heuristic)
  const countSyllables = (word: string): number => {
    const w = word.toLowerCase().replace(/[^a-z]/g, "");
    if (w.length <= 3) return 1;
    // Count vowel groups
    const matches = w.match(/[aeiouy]+/g);
    let count = matches ? matches.length : 1;
    // Adjust for silent e
    if (w.endsWith("e") && count > 1) count--;
    // Ensure at least 1 syllable
    return Math.max(1, count);
  };

  const totalSyllables = words.reduce((sum, word) => sum + countSyllables(word), 0);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease = 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
  const fleschReadingEase = Math.max(
    0,
    Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord)
  );

  // Flesch-Kincaid Grade = 0.39*(words/sentences) + 11.8*(syllables/words) - 15.59
  const fleschKincaidGrade = Math.max(
    0,
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
  );

  // Calculate long sentence percentage (>25 words)
  const longSentences = sentences.filter((s) => {
    const sentenceWords = s.split(/\s+/).filter((w) => w.length > 0);
    return sentenceWords.length > 25;
  });
  const longSentencePct = (longSentences.length / sentenceCount) * 100;

  return {
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    sentenceCount,
    wordCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    longSentencePct: Math.round(longSentencePct * 10) / 10,
  };
}

/**
 * Pre-computed line offset data for efficient position lookups.
 * Computed once per document, reused for all issues.
 */
interface LineOffsetData {
  lines: string[];
  offsets: number[]; // Character offset where each line starts
}

/**
 * Pre-compute line offsets for a document.
 * This is O(n) but only runs once per clarity check.
 */
function computeLineOffsets(text: string): LineOffsetData {
  const lines = text.split("\n");
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1; // +1 for newline
  }
  return { lines, offsets };
}

/**
 * Compute character offset positions for an issue using pre-computed line data.
 * This avoids O(n) split per issue, making it O(1) per issue after pre-computation.
 */
function computePosition(
  text: string,
  issueText: string,
  line: number | undefined,
  lineData: LineOffsetData
): { start: number; end: number } | undefined {
  if (!issueText) return undefined;

  // If we have a line number, try to find within that line first
  if (line !== undefined && line > 0 && line <= lineData.lines.length) {
    const lineText = lineData.lines[line - 1];
    const charOffset = lineData.offsets[line - 1];
    const localIndex = lineText.indexOf(issueText);
    if (localIndex !== -1) {
      return {
        start: charOffset + localIndex,
        end: charOffset + localIndex + issueText.length,
      };
    }
  }

  // Fallback to global search
  const globalIndex = text.indexOf(issueText);
  if (globalIndex !== -1) {
    return {
      start: globalIndex,
      end: globalIndex + issueText.length,
    };
  }

  return undefined;
}

/**
 * Generate a stable issue ID.
 */
function generateIssueId(type: string, line: number | undefined, text: string, index: number): string {
  const hash = `${type}-${line ?? 0}-${text.slice(0, 20)}-${index}`;
  // Simple hash
  let h = 0;
  for (let i = 0; i < hash.length; i++) {
    h = ((h << 5) - h + hash.charCodeAt(i)) | 0;
  }
  return `clarity_${Math.abs(h).toString(16)}`;
}

export async function executeClarityCheck(
  input: {
    text: string;
    maxIssues?: number;
  },
  apiKey: string
): Promise<ClarityCheckResult> {
  const model = getOpenRouterModel(apiKey, "analysis");
  const maxIssues = input.maxIssues ?? 25;

  // Compute readability metrics deterministically
  const metrics = computeReadabilityMetrics(input.text);

  const truncatedText = truncateText(input.text);
  const userPrompt = `${QUICK_CLARITY_PROMPT}\n\nAnalyze this text (max ${maxIssues} issues):\n\n"${truncatedText}"`;

  console.log("[saga/clarity] Checking clarity of text length:", input.text.length);

  const { text: responseText } = await generateText({
    model,
    system: CLARITY_CHECK_SYSTEM,
    prompt: userPrompt,
    maxTokens: 2048,
    temperature: 0.2,
  });

  // Parse response and normalize issues
  const parsed = parseClarityResponse(responseText, input.text, maxIssues);

  return {
    metrics,
    issues: parsed.issues,
    summary: parsed.summary,
  };
}

function parseClarityResponse(
  response: string,
  originalText: string,
  maxIssues: number
): { issues: ClarityCheckIssue[]; summary?: string } {
  // Pre-compute line offsets once for all issues (O(n) once vs O(n*issues) before)
  const lineData = computeLineOffsets(originalText);

  return parseJsonFromLLMResponse(
    response,
    "clarity",
    (parsed) => {
      const rawIssues = (parsed.issues as unknown[]) || [];
      const issues: ClarityCheckIssue[] = rawIssues
        .slice(0, maxIssues)
        .map((issue: unknown, idx: number) => {
          const i = issue as Record<string, unknown>;
          const issueText = (i.text as string) || "";
          const line = typeof i.line === "number" ? i.line : undefined;
          const position = computePosition(originalText, issueText, line, lineData);

          return {
            id: generateIssueId(i.type as string, line, issueText, idx),
            type: i.type as ClarityIssueType,
            text: issueText,
            line,
            position,
            suggestion: (i.suggestion as string) || "Consider revising for clarity.",
            fix: i.fix as { oldText: string; newText: string } | undefined,
          };
        });

      return {
        issues,
        summary: parsed.summary as string | undefined,
      };
    },
    { issues: [], summary: undefined }
  );
}

// =============================================================================
// Parse Template Response
// =============================================================================

function parseTemplateResponse(response: string): GenerateTemplateResult {
  const fallback: GenerateTemplateResult = {
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

  return parseJsonFromLLMResponse(
    response,
    "template",
    (parsed) => {
      const t = parsed.template as Record<string, unknown> | undefined;
      const template: TemplateDraft = {
        name: (t?.name as string) || "Custom Template",
        description: (t?.description as string) || "",
        category: (t?.category as string) || "custom",
        tags: (t?.tags as string[]) || [],
        entityKinds: (t?.entityKinds as TemplateDraft["entityKinds"]) || [],
        relationshipKinds: (t?.relationshipKinds as TemplateDraft["relationshipKinds"]) || [],
        documentKinds: (t?.documentKinds as TemplateDraft["documentKinds"]) || [
          { kind: "chapter", label: "Chapter", allowChildren: true },
          { kind: "scene", label: "Scene", allowChildren: false },
        ],
        uiModules: (t?.uiModules as TemplateDraft["uiModules"]) || [
          { module: "entity_panel", enabled: true, order: 1 },
          { module: "world_graph", enabled: true, order: 2 },
        ],
        linterRules: (t?.linterRules as TemplateDraft["linterRules"]) || [],
      };
      return {
        template,
        suggestedStarterEntities: parsed.suggestedStarterEntities as GenesisEntity[] | undefined,
      };
    },
    fallback
  );
}

// =============================================================================
// Check Logic Executor
// =============================================================================

import { LOGIC_CHECK_SYSTEM, LOGIC_CHECK_PROMPT } from "../prompts/logic.ts";

export type LogicViolationType =
  | "magic_rule_violation"
  | "causality_break"
  | "knowledge_violation"
  | "power_scaling_violation";

export interface ViolatedRule {
  source: "magic_system" | "power_scaling" | "knowledge_state" | "causality";
  ruleText: string;
  sourceEntityId?: string;
  sourceEntityName?: string;
}

export interface LogicIssue {
  id: string;
  type: LogicViolationType;
  severity: "error" | "warning" | "info";
  message: string;
  violatedRule?: ViolatedRule;
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

export interface CheckLogicResult {
  issues: LogicIssue[];
  summary?: string;
}

export async function executeCheckLogic(
  input: {
    text: string;
    focus?: string[];
    strictness?: "strict" | "balanced" | "lenient";
    magicSystems?: Array<{
      id: string;
      name: string;
      rules: string[];
      limitations: string[];
      costs?: string[];
    }>;
    characters?: Array<{
      id: string;
      name: string;
      powerLevel?: number;
      knowledge?: string[];
    }>;
    preferences?: Record<string, unknown>;
  },
  apiKey: string
): Promise<CheckLogicResult> {
  const model = getOpenRouterModel(apiKey, "analysis");
  const strictness = input.strictness ?? "balanced";

  // Build magic systems context
  let magicSystemsContext = "No magic systems defined.";
  if (input.magicSystems?.length) {
    magicSystemsContext = input.magicSystems
      .map((ms) => {
        const parts = [`**${ms.name}**:`];
        if (ms.rules.length) parts.push(`  Rules: ${ms.rules.join("; ")}`);
        if (ms.limitations.length) parts.push(`  Limitations: ${ms.limitations.join("; ")}`);
        if (ms.costs?.length) parts.push(`  Costs: ${ms.costs.join("; ")}`);
        return parts.join("\n");
      })
      .join("\n\n");
  }

  // Build characters context
  let charactersContext = "No character data provided.";
  if (input.characters?.length) {
    charactersContext = input.characters
      .map((c) => {
        const parts = [`**${c.name}**:`];
        if (c.powerLevel !== undefined) parts.push(`  Power Level: ${c.powerLevel}`);
        if (c.knowledge?.length) parts.push(`  Known Facts: ${c.knowledge.join("; ")}`);
        return parts.join("\n");
      })
      .join("\n\n");
  }

  const truncatedText = truncateText(input.text);
  const userPrompt = LOGIC_CHECK_PROMPT
    .replace("{strictness}", strictness)
    .replace("{magicSystems}", magicSystemsContext)
    .replace("{characters}", charactersContext)
    .replace("{text}", truncatedText);

  console.log("[saga/logic] Checking logic of text length:", input.text.length);

  const { text: responseText } = await generateText({
    model,
    system: LOGIC_CHECK_SYSTEM,
    prompt: userPrompt,
    maxTokens: 2048,
    temperature: 0.3,
  });

  return parseLogicResponse(responseText);
}

function parseLogicResponse(response: string): CheckLogicResult {
  return parseJsonFromLLMResponse(
    response,
    "logic",
    (parsed) => {
      const issues: LogicIssue[] = (parsed.issues as unknown[] || []).map(
        (issue: unknown, idx: number) => {
          const i = issue as Record<string, unknown>;
          return {
            id: (i.id as string) || `logic_${idx}`,
            type: i.type as LogicViolationType,
            severity: i.severity as LogicIssue["severity"],
            message: (i.message as string) || "Unknown logic issue",
            violatedRule: i.violatedRule as ViolatedRule | undefined,
            suggestion: i.suggestion as string | undefined,
            locations: Array.isArray(i.locations) ? i.locations : [],
            entityIds: i.entityIds as string[] | undefined,
          };
        }
      );
      return {
        issues,
        summary: parsed.summary as string | undefined,
      };
    },
    { issues: [], summary: undefined }
  );
}

// =============================================================================
// Name Generator Executor
// =============================================================================

import { NAME_GENERATOR_SYSTEM, NAME_GENERATOR_PROMPT } from "../prompts/names.ts";

export type NameCulture =
  | "western"
  | "norse"
  | "japanese"
  | "chinese"
  | "arabic"
  | "slavic"
  | "celtic"
  | "latin"
  | "indian"
  | "african"
  | "custom";

export interface GeneratedName {
  name: string;
  meaning?: string;
  pronunciation?: string;
  notes?: string;
}

export interface NameGeneratorResult {
  names: GeneratedName[];
  genre?: string;
  culture?: NameCulture;
}

export async function executeNameGenerator(
  input: {
    entityType: string;
    genre?: string;
    culture?: string;
    count?: number;
    seed?: string;
    avoid?: string[];
    tone?: string;
    style?: string;
    preferences?: Record<string, unknown>;
  },
  apiKey: string
): Promise<NameGeneratorResult> {
  const model = getOpenRouterModel(apiKey, "creative");
  const count = input.count ?? 10;
  const culture = input.culture ?? "any";
  const genre = input.genre ?? "fantasy";
  const style = input.style ?? "standard";
  const tone = input.tone ?? "neutral";
  const seed = input.seed ?? "";
  const avoid = input.avoid?.join(", ") ?? "";

  const userPrompt = NAME_GENERATOR_PROMPT
    .replace("{count}", String(count))
    .replace("{entityType}", input.entityType)
    .replace("{genre}", genre)
    .replace("{culture}", culture)
    .replace("{style}", style)
    .replace("{tone}", tone)
    .replace("{seed}", seed || "No specific context")
    .replace("{avoid}", avoid || "None");

  console.log("[saga/names] Generating", count, culture, input.entityType, "names");

  const { text: responseText } = await generateText({
    model,
    system: NAME_GENERATOR_SYSTEM,
    prompt: userPrompt,
    maxTokens: 2048,
    temperature: 0.8,
  });

  return parseNameGeneratorResponse(responseText, genre, culture);
}

function parseNameGeneratorResponse(
  response: string,
  genre?: string,
  culture?: string
): NameGeneratorResult {
  return parseJsonFromLLMResponse(
    response,
    "names",
    (parsed) => {
      const names: GeneratedName[] = (parsed.names as unknown[] || []).map(
        (name: unknown) => {
          const n = name as Record<string, unknown>;
          return {
            name: (n.name as string) || "Unknown",
            meaning: n.meaning as string | undefined,
            pronunciation: n.pronunciation as string | undefined,
            notes: n.notes as string | undefined,
          };
        }
      );
      return {
        names,
        genre: (parsed.genre as string) ?? genre,
        culture: (parsed.culture as NameCulture) ?? culture,
      };
    },
    { names: [], genre: genre ?? "", culture: (culture ?? "custom") as NameCulture }
  );
}
