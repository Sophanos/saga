/**
 * Saga MCP Server Type Definitions
 *
 * Types shared across the MCP server implementation.
 * Aligned with Saga's edge function tool schemas.
 */

// =============================================================================
// Entity Types (aligned with @mythos/core)
// =============================================================================

export type EntityType =
  | "character"
  | "location"
  | "item"
  | "faction"
  | "magic_system"
  | "event"
  | "concept";

export type RelationType =
  | "knows"
  | "loves"
  | "hates"
  | "killed"
  | "created"
  | "owns"
  | "guards"
  | "weakness"
  | "strength"
  | "parent_of"
  | "child_of"
  | "sibling_of"
  | "married_to"
  | "allied_with"
  | "enemy_of"
  | "member_of"
  | "rules"
  | "serves";

export type ItemCategory =
  | "weapon"
  | "armor"
  | "artifact"
  | "consumable"
  | "key"
  | "other";

// =============================================================================
// Tool Input/Output Types
// =============================================================================

export type GenesisDetailLevel = "minimal" | "standard" | "detailed";
export type AnalysisScope = "selection" | "document" | "project";
export type ConsistencyFocus = "character" | "world" | "plot" | "timeline";
export type LogicFocus = "magic_rules" | "causality" | "knowledge_state" | "power_scaling";
export type LogicStrictness = "strict" | "balanced" | "lenient";
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
export type NameStyle = "short" | "standard" | "long";

// =============================================================================
// Canon / Policy Decision Types
// =============================================================================

export type DecisionCategory = "decision" | "policy";

export interface CommitDecisionInput {
  decision: string;
  rationale?: string;
  entityIds?: string[];
  documentId?: string;
  confidence?: number;
  pinned?: boolean;
  category?: DecisionCategory;
}

export interface CommitDecisionResult {
  memoryId: string;
  content: string;
}

// =============================================================================
// Genesis World Types
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

// =============================================================================
// Entity Detection Types
// =============================================================================

export interface EntityOccurrence {
  startOffset: number;
  endOffset: number;
  matchedText: string;
  context: string;
}

export interface DetectedEntity {
  tempId: string;
  name: string;
  type: EntityType;
  confidence: number;
  occurrences: EntityOccurrence[];
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

// =============================================================================
// Consistency Check Types
// =============================================================================

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

// =============================================================================
// Clarity Check Types
// =============================================================================

export type ClarityIssueType =
  | "ambiguous_pronoun"
  | "unclear_antecedent"
  | "cliche"
  | "filler_word"
  | "dangling_modifier";

export interface ReadabilityMetrics {
  fleschKincaidGrade: number;
  fleschReadingEase: number;
  sentenceCount: number;
  wordCount: number;
  avgWordsPerSentence: number;
  longSentencePct?: number;
}

export interface ClarityIssue {
  id: string;
  type: ClarityIssueType;
  text: string;
  line?: number;
  position?: { start: number; end: number };
  suggestion: string;
  fix?: { oldText: string; newText: string };
}

export interface ClarityCheckResult {
  metrics: ReadabilityMetrics;
  issues: ClarityIssue[];
  summary?: string;
}

// =============================================================================
// Logic Check Types
// =============================================================================

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

// =============================================================================
// Name Generator Types
// =============================================================================

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

// =============================================================================
// Image Search Types
// =============================================================================

export type AssetType = "portrait" | "scene" | "location" | "item" | "reference" | "other";

export interface SearchImagesInput {
  query: string;
  limit?: number;
  assetType?: AssetType;
  entityId?: string;
  entityType?: EntityType;
  style?: string;
}

export interface ImageSearchHit {
  id: string;
  url: string;
  thumbnailUrl?: string;
  description?: string;
  entityId?: string;
  entityName?: string;
  assetType?: string;
  style?: string;
  score: number;
}

export interface SearchImagesResult {
  query: string;
  results: ImageSearchHit[];
}

export interface FindSimilarImagesInput {
  assetId?: string;
  entityName?: string;
  entityType?: EntityType;
  limit?: number;
  assetType?: AssetType;
}

export interface FindSimilarImagesResult {
  referenceAssetId: string;
  results: ImageSearchHit[];
}

// =============================================================================
// Template Types
// =============================================================================

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
// API Types
// =============================================================================

export interface SagaApiConfig {
  supabaseUrl: string;
  apiKey: string;
  defaultProjectId?: string;
}

export interface ToolExecuteResult<T = unknown> {
  toolName: string;
  result: T;
}

export interface SagaExecuteToolRequest {
  kind: "execute_tool";
  toolName: string;
  input: unknown;
  projectId?: string;
}
