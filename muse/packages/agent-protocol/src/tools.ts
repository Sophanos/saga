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
  CanonCitation,
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
  | "create_node"
  | "update_node"
  | "create_edge"
  | "update_edge"
  | "graph_mutation"
  | "generate_content"
  | "generate_image"
  | "edit_image"
  // Saga unified agent tools
  | "project_manage"
  | "genesis_world"
  | "detect_entities"
  | "check_consistency"
  | "generate_template"
  | "clarity_check"
  | "policy_check"
  | "check_logic"
  | "analyze_content"
  | "name_generator"
  | "commit_decision"
  | "write_todos"
  | "spawn_task"
  // Human-in-the-loop editor tools
  | "ask_question"
  | "write_content"
  | "view_version_history"
  | "delete_document"
  | "search_users"
  | "view_comments"
  | "add_comment"
  // Web research tools
  | "web_search"
  | "web_extract"
  // Image search tools
  | "search_images"
  | "find_similar_images"
  // Phase 3+4: Reference image & scene composition
  | "analyze_image"
  | "create_entity_from_image"
  | "illustrate_scene";

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

export type GraphMutationAction = "create" | "update" | "delete";
export type GraphMutationTarget = "entity" | "node" | "relationship" | "edge";

export type GraphMutationArgs =
  | {
      action: "create";
      target: "entity" | "node";
      type: string;
      name: string;
      aliases?: string[];
      notes?: string;
      properties?: Record<string, unknown>;
      archetype?: string;
      backstory?: string;
      goals?: string[];
      fears?: string[];
      citations?: CanonCitation[];
    }
  | {
      action: "update";
      target: "entity" | "node";
      entityName: string;
      entityType?: string;
      updates: Record<string, unknown>;
      citations?: CanonCitation[];
    }
  | {
      action: "delete";
      target: "entity" | "node";
      entityName: string;
      entityType?: string;
      reason?: string;
    }
  | {
      action: "create";
      target: "relationship" | "edge";
      type: string;
      sourceName: string;
      targetName: string;
      bidirectional?: boolean;
      strength?: number;
      notes?: string;
      metadata?: Record<string, unknown>;
      citations?: CanonCitation[];
    }
  | {
      action: "update";
      target: "relationship" | "edge";
      type: string;
      sourceName: string;
      targetName: string;
      updates: Record<string, unknown>;
      citations?: CanonCitation[];
    }
  | {
      action: "delete";
      target: "relationship" | "edge";
      type: string;
      sourceName: string;
      targetName: string;
      reason?: string;
    };

export type GraphMutationResult =
  | { success: true; targetId: string; message: string; kind: "entity" | "relationship" }
  | { success: false; code: string; message: string; details?: unknown };

export type AnalyzeContentMode = "consistency" | "entities" | "logic" | "clarity" | "policy";

export interface AnalyzeContentArgs {
  mode: AnalyzeContentMode;
  text: string;
  options?: {
    focus?: string[];
    strictness?: "strict" | "balanced" | "lenient";
    maxIssues?: number;
    entityTypes?: EntityType[];
    minConfidence?: number;
  };
}

export type AnalyzeContentIssue = {
  id: string;
  type: string;
  severity: string;
  message: string;
  suggestion?: string;
  locations?: unknown[];
};

export type AnalyzeContentResult =
  | {
      mode: "entities";
      summary: string;
      entities: DetectedEntity[];
      stats?: unknown;
    }
  | {
      mode: Exclude<AnalyzeContentMode, "entities">;
      summary: string;
      issues: AnalyzeContentIssue[];
      stats?: unknown;
    };

/**
 * Arguments for create_entity tool.
 */
export interface CreateEntityArgs {
  type: EntityType;
  name: string;
  aliases?: string[];
  notes?: string;
  properties?: Record<string, unknown>;
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
  citations?: CanonCitation[];
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
  updates: Partial<Omit<CreateEntityArgs, "type" | "citations">>;
  citations?: CanonCitation[];
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
  metadata?: Record<string, unknown>;
  citations?: CanonCitation[];
}

/**
 * Arguments for create_node tool (Project Graph).
 */
export interface CreateNodeArgs {
  type: string;
  name: string;
  aliases?: string[];
  notes?: string;
  properties?: Record<string, unknown>;
  citations?: CanonCitation[];
}

/**
 * Arguments for update_node tool (Project Graph).
 */
export interface UpdateNodeArgs {
  nodeName: string;
  nodeType?: string;
  updates: {
    name?: string;
    aliases?: string[];
    notes?: string;
    properties?: Record<string, unknown>;
  };
  citations?: CanonCitation[];
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
    metadata?: Record<string, unknown>;
  };
  citations?: CanonCitation[];
}

/**
 * Arguments for create_edge tool (Project Graph).
 */
export interface CreateEdgeArgs {
  sourceName: string;
  targetName: string;
  type: string;
  bidirectional?: boolean;
  notes?: string;
  strength?: number; // 0-1
  metadata?: Record<string, unknown>;
  citations?: CanonCitation[];
}

/**
 * Arguments for update_edge tool (Project Graph).
 */
export interface UpdateEdgeArgs {
  sourceName: string;
  targetName: string;
  type: string;
  updates: {
    notes?: string;
    strength?: number;
    bidirectional?: boolean;
    metadata?: Record<string, unknown>;
  };
  citations?: CanonCitation[];
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
 * Image style presets for AI generation.
 */
export type ImageStyle =
  | "fantasy_art" | "dark_fantasy" | "high_fantasy"
  | "manga" | "anime" | "light_novel" | "visual_novel"
  | "realistic" | "oil_painting" | "watercolor" | "concept_art" | "portrait_photo"
  | "sci_fi" | "horror" | "romance" | "noir"
  | "comic_book" | "pixel_art" | "chibi";

/**
 * Aspect ratios for image generation.
 */
export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "2:3" | "3:2";

/**
 * Asset type classification.
 */
export type AssetType = "portrait" | "scene" | "location" | "item" | "reference" | "other";

/**
 * Image edit modes.
 */
export type EditMode = "inpaint" | "outpaint" | "remix" | "style_transfer";

/**
 * Arguments for generate_image tool.
 */
export interface GenerateImageArgs {
  /** Main subject description */
  subject: string;
  /** Entity name for linking the result */
  entityName?: string;
  /** Entity type for context */
  entityType?: EntityType;
  /** Entity ID if known (for direct linking) */
  entityId?: string;
  /** Visual description from entity data */
  visualDescription?: string;
  /** Art style preset */
  style?: ImageStyle;
  /** Image aspect ratio */
  aspectRatio?: AspectRatio;
  /** Asset type classification */
  assetType?: AssetType;
  /** Whether to set as entity portrait */
  setAsPortrait?: boolean;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
}

/**
 * Arguments for edit_image tool.
 */
export interface EditImageArgs {
  /** ID of the existing asset to edit */
  assetId: string;
  /** What to change */
  editInstruction: string;
  /** How to interpret the change */
  editMode?: EditMode;
  /** Optional target style */
  style?: ImageStyle;
  /** Optional target aspect ratio */
  aspectRatio?: AspectRatio;
  /** Preserve original aspect ratio if possible (default true) */
  preserveAspectRatio?: boolean;
  /** Optional output asset type */
  assetType?: AssetType;
  /** If linked to an entity, set as portrait (default true) */
  setAsPortrait?: boolean;
  /** Negative prompt */
  negativePrompt?: string;
}

// =============================================================================
// Saga Tool Arguments
// =============================================================================

/**
 * Arguments for project_manage tool.
 * Unified entry point for project setup and migration workflows.
 */
export type ProjectManageAction = "bootstrap" | "restructure" | "pivot";

export interface ProjectManageBootstrapArgs {
  action: "bootstrap";
  /** High-level story or world description */
  description: string;
  /** Whether to persist starter entities/relationships (default true) */
  seed?: boolean;
  /** Optional genre hint */
  genre?: string;
  /** Target number of entities to generate (3-50) */
  entityCount?: number;
  /** How detailed the generation should be */
  detailLevel?: GenesisDetailLevel;
  /** Whether to include a story outline */
  includeOutline?: boolean;
  /** Entity types to skip during persistence */
  skipEntityTypes?: string[];
}

export type ProjectManageRestructureChange =
  | { op: "rename_type"; from: string; to: string }
  | { op: "add_field"; type: string; field: string };

export interface ProjectManageRestructureArgs {
  action: "restructure";
  changes: ProjectManageRestructureChange[];
}

export interface ProjectManagePivotArgs {
  action: "pivot";
  toTemplate: string;
  mappings?: Array<{ from: string; to: string }>;
  unmappedContent?: "archive" | "discard";
}

export type ProjectManageArgs =
  | ProjectManageBootstrapArgs
  | ProjectManageRestructureArgs
  | ProjectManagePivotArgs;

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
 * Arguments for policy_check tool.
 * Checks prose against pinned style rules and policies.
 */
export interface PolicyCheckArgs {
  /** Text to analyze */
  text: string;
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

// =============================================================================
// Human-in-the-loop Editor Tools
// =============================================================================

/**
 * Rich option with label and description for ask_question tool.
 */
export interface QuestionOption {
  /** Unique identifier for this option */
  id: string;
  /** Display label */
  label: string;
  /** Optional description shown below label */
  description?: string;
}

/**
 * Individual question in an ask_question flow.
 */
export interface ResearchQuestion {
  /** Unique identifier for this question */
  id: string;
  /** Short tab label (used when 2+ questions) */
  tabLabel?: string;
  /** The full question text */
  question: string;
  /** Optional context or detail */
  detail?: string;
  /** Rich options with label + description */
  options?: QuestionOption[];
  /** Whether this question is required (default true) */
  required?: boolean;
}

/**
 * Answer to a single question.
 */
export interface QuestionAnswer {
  /** The answer text (either option label or freeform) */
  answer: string;
  /** Option ID if an option was selected */
  optionId?: string;
  /** Whether this question was skipped */
  skipped?: boolean;
}

/**
 * Arguments for ask_question tool.
 * Unified schema - UI adapts based on question count:
 * - 1 question: simple inline display
 * - 2+ questions: tabbed navigation with progress
 */
export interface AskQuestionArgs {
  /** Optional title (shown when 2+ questions) */
  title?: string;
  /** Optional description */
  description?: string;
  /** Array of questions (1 or more) */
  questions: ResearchQuestion[];
  /** Allow submitting without answering all required questions */
  allowPartialSubmit?: boolean;
  /** Custom submit button label */
  submitLabel?: string;
}

/**
 * Result of ask_question tool.
 */
export interface AskQuestionResult {
  /** Answers keyed by question ID */
  answers: Record<string, QuestionAnswer>;
  /** Whether all required questions were answered */
  complete: boolean;
}

export type WriteContentOperation =
  | "replace_selection"
  | "insert_at_cursor"
  | "append_document";

export interface WriteContentArgs {
  operation: WriteContentOperation;
  content: string;
  format?: "plain" | "markdown";
  rationale?: string;
  citations?: CanonCitation[];
}

export interface WriteContentResult {
  applied: boolean;
  appliedOperation: WriteContentOperation;
  summary?: string;
  insertedTextPreview?: string;
}

// =============================================================================
// Document + Collaboration Tool Arguments
// =============================================================================

export interface ViewVersionHistoryArgs {
  documentId: string;
  limit?: number;
  cursor?: string;
}

export interface VersionHistoryEntry {
  versionId: string;
  createdAt: number;
  createdBy?: string;
  summary?: string;
}

export interface ViewVersionHistoryResult {
  versions: VersionHistoryEntry[];
  nextCursor?: string;
}

export interface DeleteDocumentArgs {
  documentId: string;
  reason?: string;
}

export interface DeleteDocumentResult {
  documentId: string;
  status: "deleted";
}

export interface SearchUsersArgs {
  query: string;
  limit?: number;
}

export interface UserSearchHit {
  id: string;
  name: string;
  email?: string;
}

export interface SearchUsersResult {
  users: UserSearchHit[];
}

export interface ViewCommentsArgs {
  documentId: string;
  limit?: number;
  cursor?: string;
}

export interface CommentEntry {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  selectionRange?: { from: number; to: number };
}

export interface ViewCommentsResult {
  comments: CommentEntry[];
  nextCursor?: string;
}

export interface AddCommentArgs {
  documentId: string;
  content: string;
  selectionRange?: { from: number; to: number };
}

export interface AddCommentResult {
  commentId: string;
  documentId: string;
}

// =============================================================================
// Web Research Tool Arguments (Parallel Web SDK)
// =============================================================================

/**
 * Arguments for web_search tool.
 * Searches the web for real-world information using Parallel Web.
 */
export interface WebSearchArgs {
  /** The search query */
  query: string;
}

/**
 * A single web search result.
 */
export interface WebSearchHit {
  /** URL of the result */
  url: string;
  /** Title of the page */
  title?: string;
  /** Summary or snippet of the content */
  summary?: string;
  /** Extracted text content */
  text?: string;
}

/**
 * Result of web_search tool.
 */
export interface WebSearchResult {
  /** The original query */
  query: string;
  /** Search results */
  results: WebSearchHit[];
}

/**
 * Arguments for web_extract tool.
 * Extracts full content from a URL using Parallel Web.
 */
export interface WebExtractArgs {
  /** The URL to extract content from */
  url: string;
}

/**
 * Result of web_extract tool.
 */
export interface WebExtractResult {
  /** The URL that was extracted */
  url: string;
  /** Title of the page */
  title?: string;
  /** Full extracted text content */
  content: string;
}

// =============================================================================
// Image Search Tool Arguments
// =============================================================================

/**
 * A single image search result hit.
 */
export interface ImageSearchHit {
  assetId: string;
  imageUrl: string;
  score: number;
  storagePath?: string;
  entityId?: string;
  entityType?: EntityType;
  assetType?: AssetType;
  style?: ImageStyle;
  createdAt?: string;
}

/**
 * Arguments for search_images tool.
 * Text→image search using CLIP embeddings.
 */
export interface SearchImagesArgs {
  /** Text query describing the visual content to find */
  query: string;
  /** Maximum number of results (1-20) */
  limit?: number;
  /** Filter by asset type */
  assetType?: AssetType;
  /** Filter by entity name */
  entityName?: string;
  /** Filter by entity type */
  entityType?: EntityType;
  /** Filter by art style */
  style?: ImageStyle;
}

/**
 * Arguments for find_similar_images tool.
 * Image→image similarity search using CLIP embeddings.
 */
export interface FindSimilarImagesArgs {
  /** UUID of the reference image */
  assetId?: string;
  /** Entity name to use their portrait as reference */
  entityName?: string;
  /** Entity type for disambiguation */
  entityType?: EntityType;
  /** Maximum number of results (1-20) */
  limit?: number;
  /** Filter by asset type */
  assetType?: AssetType;
}

// =============================================================================
// Canon Decision Tool Arguments
// =============================================================================

/**
 * Arguments for commit_decision tool.
 * Stores a canon decision in project memory.
 */
export interface CommitDecisionArgs {
  /** Canonical decision statement */
  decision: string;
  /** Decision category (canon vs house style) */
  category?: "decision" | "policy";
  /** Optional rationale/evidence */
  rationale?: string;
  /** Related entities */
  entityIds?: string[];
  /** Source document ID */
  documentId?: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Pin decision as canon (default true on server) */
  pinned?: boolean;
  citations?: CanonCitation[];
}

// =============================================================================
// Planning Tools
// =============================================================================

/** Todo item status (Claude Code style - agent manages full state) */
export type TodoStatus = "pending" | "in_progress" | "completed";

/** A single todo item */
export interface TodoItem {
  id: string;
  label: string;
  description?: string;
  status: TodoStatus;
  priority?: "low" | "medium" | "high";
  dependsOn?: string[];
}

export interface WriteTodosArgs {
  title?: string;
  /** Full list of todos - each call replaces previous state */
  todos: TodoItem[];
  target?: { documentId?: string; selectionRange?: { from: number; to: number } };
}

export interface WriteTodosResult {
  todoCount: number;
  stored?: boolean;
  todoIds?: string[];
}

/** Sub-agent type */
export type SubAgentType = "research" | "analysis" | "writing";

export interface SpawnTaskArgs {
  agent: SubAgentType;
  title: string;
  instructions: string;
  maxSteps?: number;
  requireCitations?: boolean;
}

export interface SpawnTaskResult {
  agent: SubAgentType;
  output: string;
  artifacts?: ToolArtifact[];
}

// =============================================================================
// Phase 3: Reference Image → Entity
// =============================================================================

/**
 * Focus area for image analysis extraction.
 */
export type ExtractionFocus = "full" | "appearance" | "environment" | "object";

/**
 * Scene focus for illustration composition.
 */
export type SceneFocus = "action" | "dialogue" | "establishing" | "dramatic";

// =============================================================================
// Unified analyze_image Tool (Phase 3+4 consolidated)
// =============================================================================

/**
 * Mode discriminator for unified analyze_image tool.
 */
export type AnalyzeImageMode = "vision" | "search" | "similar";

/**
 * Shared options for search/similar modes.
 */
export interface AnalyzeImageSearchOptions {
  /** Maximum number of results (1-20) */
  limit?: number;
  /** Filter by asset type */
  assetType?: AssetType;
  /** Filter by entity type */
  entityType?: EntityType;
  /** Filter by art style */
  style?: ImageStyle;
}

/**
 * Arguments for unified analyze_image tool.
 * Consolidates vision analysis, text→image search, and image→image similarity.
 */
export interface AnalyzeImageArgs {
  /** Operation mode */
  mode: AnalyzeImageMode;

  // Mode: "vision" - extract visual details via LLM
  /** Base64 data URL or storage path of the image (required for vision mode) */
  imageSource?: string;
  /** Optional entity type hint for better extraction */
  entityTypeHint?: EntityType;
  /** What aspect to focus extraction on */
  extractionFocus?: ExtractionFocus;
  /** Custom analysis prompt for vision mode */
  analysisPrompt?: string;

  // Mode: "search" - text → image via Qdrant
  /** Text query describing the visual content to find (required for search mode) */
  query?: string;

  // Mode: "similar" - image → image via Qdrant
  /** UUID of the reference image (for similar mode) */
  assetId?: string;
  /** Entity name to use their portrait as reference (for similar mode) */
  entityName?: string;

  // Shared options (for search/similar modes)
  /** Search/filter options */
  options?: AnalyzeImageSearchOptions;
}

/**
 * Structured visual description extracted from an image.
 */
export interface VisualDescription {
  // Character-specific
  height?: string;
  build?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  distinguishingFeatures?: string[];
  clothing?: string;
  accessories?: string[];
  // Location-specific
  climate?: string;
  atmosphere?: string;
  // Item-specific
  category?: string;
  material?: string;
  // General
  artStyle?: string;
  mood?: string;
}

/**
 * Vision mode result from analyze_image.
 */
export interface AnalyzeImageVisionResult {
  mode: "vision";
  /** Suggested entity type based on image content */
  suggestedEntityType: EntityType;
  /** Optional suggested name if discernible */
  suggestedName?: string;
  /** Structured visual description */
  visualDescription: VisualDescription;
  /** Natural language description of the image */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Asset ID if image was stored */
  assetId?: string;
  /** Public URL to the stored image */
  imageUrl?: string;
}

/**
 * Search mode result from analyze_image.
 */
export interface AnalyzeImageSearchResult {
  mode: "search";
  /** The original query */
  query: string;
  /** Matching images */
  results: ImageSearchHit[];
}

/**
 * Similar mode result from analyze_image.
 */
export interface AnalyzeImageSimilarResult {
  mode: "similar";
  /** ID of the reference image used */
  referenceAssetId: string;
  /** Similar images found */
  results: ImageSearchHit[];
}

/**
 * Discriminated union result of analyze_image tool.
 */
export type AnalyzeImageResult =
  | AnalyzeImageVisionResult
  | AnalyzeImageSearchResult
  | AnalyzeImageSimilarResult;

/**
 * Arguments for create_entity_from_image tool.
 * Composite operation: upload → analyze → create entity + set portrait.
 */
export interface CreateEntityFromImageArgs {
  /** Base64 encoded image data (data URL) */
  imageData: string;
  /** Optional name for the entity */
  name?: string;
  /** Optional entity type (defaults to character) */
  entityType?: EntityType;
  /** Whether to set the image as entity portrait (default true) */
  setAsPortrait?: boolean;
}

/**
 * Result of create_entity_from_image tool.
 */
export interface CreateEntityFromImageResult {
  /** ID of the created entity */
  entityId: string;
  /** Type of the created entity */
  entityType: EntityType;
  /** Name of the created entity */
  name: string;
  /** Asset ID of the stored image */
  assetId?: string;
  /** Public URL to the image */
  imageUrl?: string;
  /** Analysis result for reference */
  analysis?: AnalyzeImageResult;
}

// =============================================================================
// Phase 4: Scene Composition
// =============================================================================

/**
 * Arguments for illustrate_scene tool.
 * Generates a scene illustration from narrative text.
 */
export interface IllustrateSceneArgs {
  /** The narrative text describing the scene */
  sceneText: string;
  /** Names of characters to include (will use their portraits for consistency) */
  characterNames?: string[];
  /** Art style for the illustration */
  style?: ImageStyle;
  /** Aspect ratio (default 16:9 for scenes) */
  aspectRatio?: AspectRatio;
  /** Composition focus */
  sceneFocus?: SceneFocus;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
}

/**
 * Character included in an illustrated scene.
 */
export interface SceneCharacter {
  /** Character name */
  name: string;
  /** Entity ID if resolved */
  entityId?: string;
  /** Whether a portrait reference was available */
  hadPortraitReference: boolean;
}

/**
 * Result of illustrate_scene tool.
 */
export interface IllustrateSceneResult {
  /** Public URL to the generated image */
  imageUrl: string;
  /** Asset ID of the stored image */
  assetId: string;
  /** Description/caption of the scene */
  sceneDescription: string;
  /** Characters included in the illustration */
  charactersIncluded: SceneCharacter[];
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
  create_node: CreateNodeArgs;
  update_node: UpdateNodeArgs;
  create_edge: CreateEdgeArgs;
  update_edge: UpdateEdgeArgs;
  graph_mutation: GraphMutationArgs;
  generate_content: GenerateContentArgs;
  generate_image: GenerateImageArgs;
  edit_image: EditImageArgs;
  // Saga tools
  project_manage: ProjectManageArgs;
  genesis_world: GenesisWorldArgs;
  detect_entities: DetectEntitiesArgs;
  check_consistency: CheckConsistencyArgs;
  generate_template: GenerateTemplateArgs;
  clarity_check: ClarityCheckArgs;
  policy_check: PolicyCheckArgs;
  check_logic: CheckLogicArgs;
  analyze_content: AnalyzeContentArgs;
  name_generator: NameGeneratorArgs;
  commit_decision: CommitDecisionArgs;
  write_todos: WriteTodosArgs;
  spawn_task: SpawnTaskArgs;
  // Human-in-the-loop editor tools
  ask_question: AskQuestionArgs;
  write_content: WriteContentArgs;
  view_version_history: ViewVersionHistoryArgs;
  delete_document: DeleteDocumentArgs;
  search_users: SearchUsersArgs;
  view_comments: ViewCommentsArgs;
  add_comment: AddCommentArgs;
  // Web research tools
  web_search: WebSearchArgs;
  web_extract: WebExtractArgs;
  // Image search tools
  search_images: SearchImagesArgs;
  find_similar_images: FindSimilarImagesArgs;
  // Phase 3+4 tools
  analyze_image: AnalyzeImageArgs;
  create_entity_from_image: CreateEntityFromImageArgs;
  illustrate_scene: IllustrateSceneArgs;
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
 * Result of create_node tool.
 */
export interface CreateNodeResult {
  entityId: string;
  name: string;
  type: string;
}

/**
 * Result of update_node tool.
 */
export interface UpdateNodeResult {
  entityId: string;
  name: string;
  updatedFields: string[];
}

/**
 * Result of create_edge tool.
 */
export interface CreateEdgeResult {
  relationshipId: string;
  sourceId: string;
  targetId: string;
  type: string;
}

/**
 * Result of update_edge tool.
 */
export interface UpdateEdgeResult {
  relationshipId: string;
  sourceId: string;
  targetId: string;
  updatedFields: string[];
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
  assetId?: string;
  storagePath?: string;
  /** Whether this was a cache hit (existing identical generation) */
  cached?: boolean;
}

/**
 * Result of edit_image tool.
 */
export interface EditImageResult {
  imageUrl: string;
  previewUrl?: string;
  entityId?: string;
  assetId?: string;
  storagePath?: string;
  parentAssetId: string;
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

export interface ProjectManageBootstrapEntity {
  name: string;
  type: string;
  description: string;
  properties?: Record<string, unknown>;
}

export interface ProjectManageBootstrapRelationship {
  source: string;
  target: string;
  type: string;
  description?: string;
}

export interface ProjectManageBootstrapResult {
  action: "bootstrap";
  status: "ok";
  persisted: boolean;
  /** Optional template draft generated for the project structure */
  template?: TemplateDraft;
  /** Optional starter entities suggested by the template generator */
  suggestedStarterEntities?: GenesisEntity[];
  worldSummary: string;
  suggestedTitle?: string;
  outline?: Array<{ title: string; summary: string }>;
  entities: ProjectManageBootstrapEntity[];
  relationships: ProjectManageBootstrapRelationship[];
  persistence?: {
    success: boolean;
    entitiesCreated: number;
    relationshipsCreated: number;
    errors: string[];
  };
}

export interface ProjectManageNotImplementedResult {
  action: "restructure" | "pivot";
  status: "not_implemented";
  message: string;
  supportedActions: ["bootstrap"];
}

export type ProjectManageResult = ProjectManageBootstrapResult | ProjectManageNotImplementedResult;

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
// policy_check Tool Results
// =============================================================================

/**
 * Policy issue type for policy_check tool.
 */
export type PolicyIssueType =
  | "policy_conflict"
  | "unverifiable"
  | "not_testable"
  | "policy_gap";

/**
 * A policy issue detected in the text.
 */
export interface PolicyCheckIssue {
  /** Unique identifier */
  id: string;
  /** Type of policy issue */
  type: PolicyIssueType;
  /** The problematic text snippet */
  text: string;
  /** Line number where the issue occurs */
  line?: number;
  /** Suggested improvement */
  suggestion: string;
  /** Canon citations for the policy violation */
  canonCitations?: CanonCitation[];
}

/**
 * Policy compliance metrics.
 */
export interface PolicyComplianceMetrics {
  /** Compliance score (0-100) */
  score: number;
  /** Number of policies checked */
  policiesChecked: number;
  /** Number of conflicts found */
  conflictsFound: number;
}

/**
 * Result of policy_check tool.
 */
export interface PolicyCheckResult {
  /** Detected policy issues */
  issues: PolicyCheckIssue[];
  /** Summary of the analysis */
  summary: string;
  /** Compliance metrics */
  compliance?: PolicyComplianceMetrics;
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

// =============================================================================
// Image Search Tool Results
// =============================================================================

/**
 * Result of search_images tool.
 */
export interface SearchImagesResult {
  /** The original query */
  query: string;
  /** Matching images */
  results: ImageSearchHit[];
}

/**
 * Result of find_similar_images tool.
 */
export interface FindSimilarImagesResult {
  /** ID of the reference image used */
  referenceAssetId: string;
  /** Similar images found */
  results: ImageSearchHit[];
}

/**
 * Result of commit_decision tool.
 */
export interface CommitDecisionResult {
  memoryId: string;
  content: string;
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
  create_node: CreateNodeResult;
  update_node: UpdateNodeResult;
  create_edge: CreateEdgeResult;
  update_edge: UpdateEdgeResult;
  graph_mutation: GraphMutationResult;
  generate_content: GenerateContentResult;
  generate_image: GenerateImageResult;
  edit_image: EditImageResult;
  // Saga tools
  project_manage: ProjectManageResult;
  genesis_world: GenesisWorldResult;
  detect_entities: DetectEntitiesResult;
  check_consistency: CheckConsistencyResult;
  generate_template: GenerateTemplateResult;
  clarity_check: ClarityCheckResult;
  policy_check: PolicyCheckResult;
  check_logic: CheckLogicResult;
  analyze_content: AnalyzeContentResult;
  name_generator: NameGeneratorResult;
  commit_decision: CommitDecisionResult;
  write_todos: WriteTodosResult;
  spawn_task: SpawnTaskResult;
  // Human-in-the-loop editor tools
  ask_question: AskQuestionResult;
  write_content: WriteContentResult;
  view_version_history: ViewVersionHistoryResult;
  delete_document: DeleteDocumentResult;
  search_users: SearchUsersResult;
  view_comments: ViewCommentsResult;
  add_comment: AddCommentResult;
  // Web research tools
  web_search: WebSearchResult;
  web_extract: WebExtractResult;
  // Image search tools
  search_images: SearchImagesResult;
  find_similar_images: FindSimilarImagesResult;
  // Phase 3+4 tools
  analyze_image: AnalyzeImageResult;
  create_entity_from_image: CreateEntityFromImageResult;
  illustrate_scene: IllustrateSceneResult;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Type-safe tool invocation with specific args and result.
 */
export type TypedToolInvocation<T extends ToolName & keyof ToolArgsMap & keyof ToolResultsMap> = Omit<
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
