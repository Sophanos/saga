/**
 * @mythos/agent-protocol - Tool Types
 *
 * Tool definitions, invocation types, arguments, and results.
 */

import type {
  EntityType,
  RelationType,
  EntityOccurrence,
  TemplateComplexity,
  GenesisDetailLevel,
  AnalysisScope,
  LogicFocus,
  LogicStrictness,
  NameCulture,
  NameStyle,
  ToolDangerLevel,
} from "./types";

// =============================================================================
// Tool Names
// =============================================================================

/**
 * All supported tool names in the agent system.
 * Add new tools here when extending functionality.
 */
export type ToolName =
  | "create_entity"
  | "update_entity"
  | "delete_entity"
  | "create_relationship"
  | "update_relationship"
  | "delete_relationship"
  | "generate_content"
  | "generate_image"
  // Saga unified agent tools
  | "genesis_world"
  | "detect_entities"
  | "check_consistency"
  | "generate_template"
  | "clarity_check"
  | "check_logic"
  | "name_generator";

// =============================================================================
// Tool Invocation Lifecycle
// =============================================================================

/**
 * Status of a tool invocation throughout its lifecycle.
 */
export type ToolInvocationStatus =
  | "proposed"     // LLM suggested this action, awaiting user decision
  | "accepted"     // User accepted, execution starting
  | "executing"    // Long-running operation in progress
  | "executed"     // Successfully completed
  | "rejected"     // User declined the proposal
  | "failed"       // Execution failed
  | "canceled";    // User or system canceled during execution

// =============================================================================
// Tool Artifacts
// =============================================================================

/**
 * Artifact kinds that tools can produce.
 */
export type ToolArtifactKind =
  | "image"    // Generated images (portraits, scenes)
  | "link"     // URL references
  | "diff"     // Text diffs for content changes
  | "graph"    // Graph/relationship changes
  | "file";    // Generated files

/**
 * An artifact produced by a tool execution.
 */
export interface ToolArtifact {
  kind: ToolArtifactKind;
  title?: string;
  url?: string;           // Storage/signed URL
  previewUrl?: string;    // Thumbnail for images
  mimeType?: string;
  data?: unknown;         // Structured data (e.g., graph delta)
}

// =============================================================================
// Tool Invocation
// =============================================================================

/**
 * Progress information for long-running tools.
 */
export interface ToolProgress {
  /** Percentage complete (0-100) */
  pct?: number;
  /** Current stage description */
  stage?: string;
}

/**
 * Base interface for a tool invocation.
 * Each tool call has a stable ID throughout its lifecycle.
 */
export interface ToolInvocation {
  /** Stable identifier from the LLM tool call */
  toolCallId: string;
  /** Which tool is being invoked */
  toolName: ToolName;
  /** Current status in the lifecycle */
  status: ToolInvocationStatus;
  /** Tool-specific arguments */
  args: unknown;
  /** Execution result (tool-specific) */
  result?: unknown;
  /** Artifacts produced by the tool */
  artifacts?: ToolArtifact[];
  /** Progress for long-running operations */
  progress?: ToolProgress;
  /** Error message if failed */
  error?: string;
  /** Workflow grouping (for multi-tool operations) */
  workflowId?: string;
  /** Dependencies on other tool calls */
  dependsOn?: string[];
}

// =============================================================================
// Tool Arguments (per-tool typing)
// =============================================================================

/**
 * Arguments for create_entity tool.
 */
export interface CreateEntityArgs {
  type: EntityType;
  name: string;
  aliases?: string[];
  notes?: string;
  // Character-specific
  archetype?: string;
  backstory?: string;
  goals?: string[];
  fears?: string[];
  // Location-specific
  climate?: string;
  atmosphere?: string;
  // Item-specific
  category?: "weapon" | "armor" | "artifact" | "consumable" | "key" | "other";
  abilities?: string[];
  // Faction-specific
  leader?: string;
  headquarters?: string;
  factionGoals?: string[];
  // Magic System-specific
  rules?: string[];
  limitations?: string[];
}

/**
 * Arguments for update_entity tool.
 */
export interface UpdateEntityArgs {
  /** Entity name to find (LLM doesn't know IDs) */
  entityName: string;
  /** Optional type for disambiguation */
  entityType?: EntityType;
  /** Fields to update */
  updates: Partial<Omit<CreateEntityArgs, "type">>;
}

/**
 * Arguments for delete_entity tool.
 */
export interface DeleteEntityArgs {
  entityName: string;
  entityType?: EntityType;
  reason?: string;
}

/**
 * Arguments for create_relationship tool.
 */
export interface CreateRelationshipArgs {
  sourceName: string;
  targetName: string;
  type: RelationType;
  bidirectional?: boolean;
  notes?: string;
  strength?: number; // 0-1
}

/**
 * Arguments for update_relationship tool.
 */
export interface UpdateRelationshipArgs {
  sourceName: string;
  targetName: string;
  type: RelationType;
  updates: {
    notes?: string;
    strength?: number;
    bidirectional?: boolean;
  };
}

/**
 * Arguments for delete_relationship tool.
 */
export interface DeleteRelationshipArgs {
  sourceName: string;
  targetName: string;
  type: RelationType;
  reason?: string;
}

/**
 * Arguments for generate_content tool.
 */
export interface GenerateContentArgs {
  contentType: "description" | "backstory" | "dialogue" | "scene";
  subject: string;
  tone?: string;
  length?: "short" | "medium" | "long";
}

/**
 * Arguments for generate_image tool (future).
 */
export interface GenerateImageArgs {
  subject: string;
  style?: string;
  aspectRatio?: "square" | "portrait" | "landscape";
  entityId?: string; // Link result to an entity
}

// =============================================================================
// Saga Tool Arguments
// =============================================================================

/**
 * Arguments for genesis_world tool.
 * Generates a complete world scaffold from a story description.
 */
export interface GenesisWorldArgs {
  /** Story/world description from user */
  prompt: string;
  /** Optional genre hint */
  genre?: string;
  /** Target number of entities to generate (3-50) */
  entityCount?: number;
  /** How detailed the generation should be */
  detailLevel?: GenesisDetailLevel;
  /** Whether to include a story outline */
  includeOutline?: boolean;
}

/**
 * Arguments for detect_entities tool.
 * Extracts entities from narrative text.
 */
export interface DetectEntitiesArgs {
  /** Scope of detection */
  scope?: AnalysisScope;
  /** Text to analyze (optional - client can supply at execution) */
  text?: string;
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  /** Maximum entities to return */
  maxEntities?: number;
  /** Filter to specific entity types */
  entityTypes?: EntityType[];
}

/**
 * Arguments for check_consistency tool.
 * Checks narrative for contradictions and plot holes.
 */
export interface CheckConsistencyArgs {
  /** Scope of consistency check */
  scope?: AnalysisScope;
  /** Text to analyze (optional - client can supply at execution) */
  text?: string;
  /** Focus areas for the check */
  focus?: ("character" | "world" | "plot" | "timeline")[];
}

/**
 * Arguments for generate_template tool.
 * Creates a custom project template from story description.
 */
export interface GenerateTemplateArgs {
  /** Story/world description */
  storyDescription: string;
  /** Genre hints to guide template generation */
  genreHints?: string[];
  /** Complexity level */
  complexity?: TemplateComplexity;
  /** Base template to inherit from */
  baseTemplateId?: string;
}

/**
 * Arguments for clarity_check tool.
 * Checks prose for word/phrase-level clarity issues.
 */
export interface ClarityCheckArgs {
  /** Scope of clarity check */
  scope?: AnalysisScope;
  /** Text to analyze (optional - client supplies at execution if scope-based) */
  text?: string;
  /** Maximum number of issues to return (default 25) */
  maxIssues?: number;
}

/**
 * Arguments for check_logic tool.
 * Validates story logic against explicit rules and world state.
 */
export interface CheckLogicArgs {
  /** Scope of logic check */
  scope?: AnalysisScope;
  /** Text to analyze (optional - client supplies at execution if scope-based) */
  text?: string;
  /** Focus areas for the check (default: all) */
  focus?: LogicFocus[];
  /** How strict the validation should be (default: balanced) */
  strictness?: LogicStrictness;
}

/**
 * Arguments for name_generator tool.
 * Generates culturally-aware, genre-appropriate names.
 */
export interface NameGeneratorArgs {
  /** Type of entity to name */
  entityType: EntityType;
  /** Genre context for name style */
  genre?: string;
  /** Cultural inspiration for names */
  culture?: NameCulture;
  /** Number of names to generate (default: 10) */
  count?: number;
  /** Seed text for context (entity notes, description) */
  seed?: string;
  /** Names to avoid (existing entities) */
  avoid?: string[];
  /** Optional tone for the names */
  tone?: string;
  /** Style preference for name length */
  style?: NameStyle;
}

/**
 * Map of tool names to their argument types.
 */
export interface ToolArgsMap {
  create_entity: CreateEntityArgs;
  update_entity: UpdateEntityArgs;
  delete_entity: DeleteEntityArgs;
  create_relationship: CreateRelationshipArgs;
  update_relationship: UpdateRelationshipArgs;
  delete_relationship: DeleteRelationshipArgs;
  generate_content: GenerateContentArgs;
  generate_image: GenerateImageArgs;
  // Saga tools
  genesis_world: GenesisWorldArgs;
  detect_entities: DetectEntitiesArgs;
  check_consistency: CheckConsistencyArgs;
  generate_template: GenerateTemplateArgs;
  clarity_check: ClarityCheckArgs;
  check_logic: CheckLogicArgs;
  name_generator: NameGeneratorArgs;
}

// =============================================================================
// Tool Results (per-tool typing)
// =============================================================================

/**
 * Result of create_entity tool.
 */
export interface CreateEntityResult {
  entityId: string;
  name: string;
  type: EntityType;
}

/**
 * Result of update_entity tool.
 */
export interface UpdateEntityResult {
  entityId: string;
  name: string;
  updatedFields: string[];
}

/**
 * Result of delete_entity tool.
 */
export interface DeleteEntityResult {
  entityId: string;
  name: string;
}

/**
 * Result of create_relationship tool.
 */
export interface CreateRelationshipResult {
  relationshipId: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
}

/**
 * Result of generate_content tool.
 */
export interface GenerateContentResult {
  content: string;
  contentType: string;
}

/**
 * Result of generate_image tool.
 */
export interface GenerateImageResult {
  imageUrl: string;
  previewUrl?: string;
  entityId?: string;
}

// =============================================================================
// Saga Tool Results
// =============================================================================

/**
 * A generated entity from genesis_world.
 */
export interface GenesisEntity {
  tempId: string;
  name: string;
  type: EntityType;
  description?: string;
  properties?: Record<string, unknown>;
}

/**
 * A generated relationship from genesis_world.
 */
export interface GenesisRelationship {
  sourceTempId: string;
  targetTempId: string;
  type: RelationType;
  notes?: string;
}

/**
 * An outline item from genesis_world.
 */
export interface GenesisOutlineItem {
  title: string;
  summary: string;
  order: number;
}

/**
 * Result of genesis_world tool.
 */
export interface GenesisWorldResult {
  worldSummary: string;
  genre?: string;
  entities: GenesisEntity[];
  relationships: GenesisRelationship[];
  outline?: GenesisOutlineItem[];
}

/**
 * A detected entity from detect_entities.
 */
export interface DetectedEntity {
  tempId: string;
  name: string;
  type: EntityType;
  confidence: number;
  occurrences: EntityOccurrence[];
  suggestedAliases?: string[];
  suggestedProperties?: Record<string, unknown>;
}

/**
 * A warning from entity detection.
 */
export interface DetectionWarning {
  type: "ambiguous" | "low_confidence" | "possible_duplicate";
  message: string;
  entityTempId?: string;
}

/**
 * Result of detect_entities tool.
 */
export interface DetectEntitiesResult {
  entities: DetectedEntity[];
  warnings?: DetectionWarning[];
}

/**
 * A consistency issue location.
 */
export interface IssueLocation {
  documentId?: string;
  line?: number;
  startOffset?: number;
  endOffset?: number;
  text: string;
}

/**
 * A consistency issue from check_consistency.
 */
export interface ConsistencyIssue {
  id: string;
  type: "contradiction" | "timeline" | "character" | "world" | "plot_hole";
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
  locations: IssueLocation[];
  entityIds?: string[];
}

/**
 * Result of check_consistency tool.
 */
export interface CheckConsistencyResult {
  issues: ConsistencyIssue[];
  summary?: string;
}

/**
 * A custom entity kind definition for templates.
 */
export interface TemplateEntityKind {
  kind: string;
  label: string;
  labelPlural: string;
  category: "agent" | "place" | "object" | "system" | "organization" | "temporal" | "abstract";
  color: string;
  icon: string;
  fields: Array<{
    id: string;
    label: string;
    kind: "string" | "text" | "number" | "boolean" | "enum" | "tags" | "entity_ref";
    description?: string;
  }>;
}

/**
 * A custom relationship kind definition for templates.
 */
export interface TemplateRelationshipKind {
  kind: string;
  label: string;
  category: "interpersonal" | "familial" | "power" | "ability" | "custom";
}

/**
 * A document kind definition for templates.
 */
export interface TemplateDocumentKind {
  kind: string;
  label: string;
  allowChildren?: boolean;
}

/**
 * A linter rule definition for templates.
 */
export interface TemplateLinterRule {
  id: string;
  label: string;
  description: string;
  defaultSeverity: "error" | "warning" | "info";
  category: "character" | "world" | "plot" | "timeline" | "style";
}

/**
 * A UI module configuration for templates.
 */
export interface TemplateUIModule {
  module: string;
  enabled: boolean;
  order?: number;
}

/**
 * The generated template draft from generate_template.
 */
export interface TemplateDraft {
  name: string;
  description: string;
  category: string;
  tags: string[];
  baseTemplateId?: string;
  entityKinds: TemplateEntityKind[];
  relationshipKinds: TemplateRelationshipKind[];
  documentKinds: TemplateDocumentKind[];
  uiModules: TemplateUIModule[];
  linterRules: TemplateLinterRule[];
}

/**
 * Result of generate_template tool.
 */
export interface GenerateTemplateResult {
  template: TemplateDraft;
  suggestedStarterEntities?: GenesisEntity[];
}

/**
 * Readability metrics from clarity analysis.
 */
export interface ReadabilityMetrics {
  /** Flesch-Kincaid grade level (e.g., 8.6 = 8th grade) */
  fleschKincaidGrade: number;
  /** Flesch Reading Ease score (0-100, higher = easier) */
  fleschReadingEase: number;
  /** Total number of sentences */
  sentenceCount: number;
  /** Total number of words */
  wordCount: number;
  /** Average words per sentence */
  avgWordsPerSentence: number;
  /** Percentage of sentences considered "long" (>25 words) */
  longSentencePct?: number;
}

/**
 * Clarity issue type for word/phrase-level problems.
 */
export type ClarityIssueType =
  | "ambiguous_pronoun"
  | "unclear_antecedent"
  | "cliche"
  | "filler_word"
  | "dangling_modifier";

/**
 * A clarity issue detected in the text.
 */
export interface ClarityCheckIssue {
  /** Unique identifier */
  id: string;
  /** Type of clarity issue */
  type: ClarityIssueType;
  /** The problematic text snippet */
  text: string;
  /** Line number where the issue occurs */
  line?: number;
  /** Character position range */
  position?: { start: number; end: number };
  /** Suggested improvement */
  suggestion: string;
  /** Optional fix that can be applied */
  fix?: { oldText: string; newText: string };
}

/**
 * Result of clarity_check tool.
 */
export interface ClarityCheckResult {
  /** Readability metrics */
  metrics: ReadabilityMetrics;
  /** Detected clarity issues */
  issues: ClarityCheckIssue[];
  /** Summary of the analysis */
  summary?: string;
}

// =============================================================================
// check_logic Tool Results
// =============================================================================

/**
 * Type of logic violation detected.
 */
export type LogicViolationType =
  | "magic_rule_violation"
  | "causality_break"
  | "knowledge_violation"
  | "power_scaling_violation";

/**
 * Source of a violated rule.
 */
export interface ViolatedRule {
  /** Type of rule source */
  source: "magic_system" | "power_scaling" | "knowledge_state" | "causality";
  /** The rule text that was violated */
  ruleText: string;
  /** ID of the entity defining the rule */
  sourceEntityId?: string;
  /** Name of the entity defining the rule */
  sourceEntityName?: string;
}

/**
 * A logic issue detected in the narrative.
 */
export interface LogicIssue {
  /** Unique identifier */
  id: string;
  /** Type of logic violation */
  type: LogicViolationType;
  /** Issue severity */
  severity: "error" | "warning" | "info";
  /** Human-readable message */
  message: string;
  /** The rule that was violated (if applicable) */
  violatedRule?: ViolatedRule;
  /** Suggested fix */
  suggestion?: string;
  /** Locations in the text where the issue occurs */
  locations: IssueLocation[];
  /** Entity IDs involved in the issue */
  entityIds?: string[];
}

/**
 * Result of check_logic tool.
 */
export interface CheckLogicResult {
  /** Detected logic issues */
  issues: LogicIssue[];
  /** Summary of the analysis */
  summary?: string;
}

// =============================================================================
// name_generator Tool Results
// =============================================================================

/**
 * A generated name with metadata.
 */
export interface GeneratedName {
  /** The generated name */
  name: string;
  /** Meaning or etymology of the name */
  meaning?: string;
  /** Pronunciation guide */
  pronunciation?: string;
  /** Additional notes about the name */
  notes?: string;
}

/**
 * Result of name_generator tool.
 */
export interface NameGeneratorResult {
  /** Generated names */
  names: GeneratedName[];
  /** Genre used for generation */
  genre?: string;
  /** Culture used for generation */
  culture?: NameCulture;
}

/**
 * Map of tool names to their result types.
 */
export interface ToolResultsMap {
  create_entity: CreateEntityResult;
  update_entity: UpdateEntityResult;
  delete_entity: DeleteEntityResult;
  create_relationship: CreateRelationshipResult;
  update_relationship: UpdateEntityResult; // Same shape
  delete_relationship: DeleteEntityResult; // Same shape
  generate_content: GenerateContentResult;
  generate_image: GenerateImageResult;
  // Saga tools
  genesis_world: GenesisWorldResult;
  detect_entities: DetectEntitiesResult;
  check_consistency: CheckConsistencyResult;
  generate_template: GenerateTemplateResult;
  clarity_check: ClarityCheckResult;
  check_logic: CheckLogicResult;
  name_generator: NameGeneratorResult;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Type-safe tool invocation with specific args and result.
 */
export type TypedToolInvocation<T extends ToolName> = Omit<
  ToolInvocation,
  "toolName" | "args" | "result"
> & {
  toolName: T;
  args: ToolArgsMap[T];
  result?: ToolResultsMap[T];
};

/**
 * Helper to narrow a ToolInvocation to a specific tool type.
 */
export function isToolInvocation<T extends ToolName>(
  invocation: ToolInvocation,
  toolName: T
): invocation is TypedToolInvocation<T> {
  return invocation.toolName === toolName;
}

/**
 * Metadata about a tool (used in registries).
 */
export interface ToolMetadata {
  toolName: ToolName;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  danger: ToolDangerLevel;
}
