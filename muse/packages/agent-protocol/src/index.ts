/**
 * @mythos/agent-protocol
 *
 * Shared types and contracts for the AI agent tool system.
 * Used by both server (Edge Functions) and client (Web/Mobile).
 */

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
  | "generate_image"; // future

/**
 * Entity types that can be created/updated
 */
export type EntityType =
  | "character"
  | "location"
  | "item"
  | "faction"
  | "magic_system"
  | "event"
  | "concept";

/**
 * Relationship types between entities
 */
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
// SSE Stream Events
// =============================================================================

/**
 * Context data sent at the start of a response.
 */
export interface RAGContext {
  documents: Array<{
    id: string;
    title: string;
    preview: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    type: string;
    preview: string;
  }>;
}

/**
 * SSE event types for agent streaming.
 */
export type AgentStreamEventType =
  | "context"  // RAG context metadata
  | "delta"    // Text chunk
  | "tool"     // Tool call proposal
  | "progress" // Tool progress update
  | "done"     // Stream complete
  | "error";   // Error occurred

/**
 * SSE event payload for context.
 */
export interface ContextEvent {
  type: "context";
  data: RAGContext;
}

/**
 * SSE event payload for text delta.
 */
export interface DeltaEvent {
  type: "delta";
  content: string;
}

/**
 * SSE event payload for tool call.
 */
export interface ToolEvent {
  type: "tool";
  toolCallId: string;
  toolName: ToolName;
  args: unknown;
}

/**
 * SSE event payload for tool progress.
 */
export interface ProgressEvent {
  type: "progress";
  toolCallId: string;
  progress: ToolProgress;
}

/**
 * SSE event payload for stream completion.
 */
export interface DoneEvent {
  type: "done";
}

/**
 * SSE event payload for errors.
 */
export interface ErrorEvent {
  type: "error";
  message: string;
  code?: string;
}

/**
 * Union of all possible SSE stream events.
 */
export type AgentStreamEvent =
  | ContextEvent
  | DeltaEvent
  | ToolEvent
  | ProgressEvent
  | DoneEvent
  | ErrorEvent;

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
 * Danger level for tool execution.
 */
export type ToolDangerLevel = "safe" | "destructive" | "costly";

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
