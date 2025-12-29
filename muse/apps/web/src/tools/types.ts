/**
 * Client-side tool types and interfaces.
 */

import type { Entity, Relationship, EntityType, RelationType } from "@mythos/core";
import type { ToolName, ToolArtifact, ToolDangerLevel, AnalysisScope } from "@mythos/agent-protocol";

// Re-export for backwards compatibility
export type { ToolDangerLevel };

// =============================================================================
// Execution Context
// =============================================================================

/**
 * Context provided to tool executors.
 * Contains all dependencies needed for tool execution.
 */
export interface ToolExecutionContext {
  /** Current project ID */
  projectId: string;
  /** Abort signal for cancellation support */
  signal?: AbortSignal;
  /** All entities in the project (by ID) */
  entities: Map<string, Entity>;
  /** All relationships in the project */
  relationships: Relationship[];
  /** Entity persistence functions */
  createEntity: (entity: Entity, projectId: string) => Promise<{ data?: Entity; error?: string }>;
  updateEntity: (id: string, updates: Partial<Entity>) => Promise<{ data?: Entity; error?: string }>;
  deleteEntity: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Relationship persistence functions */
  createRelationship: (rel: Relationship, projectId: string) => Promise<{ data?: Relationship; error?: string }>;
  updateRelationship: (id: string, updates: Partial<Relationship>) => Promise<{ data?: Relationship; error?: string }>;
  deleteRelationship: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Store actions */
  addEntity: (entity: Entity) => void;
  addRelationship: (relationship: Relationship) => void;
  removeEntity: (id: string) => void;
  removeRelationship: (id: string) => void;

  // ==========================================================================
  // Saga Tool Extensions (optional - for genesis, detect, lint, template)
  // ==========================================================================

  /** API key for AI operations (BYOK) */
  apiKey?: string;
  /** Get the current document's text content */
  getDocumentText?: () => string;
  /** Get the current selection text */
  getSelectionText?: () => string | undefined;
  /** Set linter issues in the store */
  setLinterIssues?: (issues: unknown[]) => void;
  /** Set the active console tab */
  setActiveTab?: (tab: "chat" | "linter" | "search" | "dynamics" | "coach") => void;
  /** Set detected entities for review */
  setDetectedEntities?: (entities: unknown[]) => void;
  /** Show entity suggestion modal */
  showEntitySuggestionModal?: (entities: unknown[]) => void;
  /** Set template draft for review */
  setTemplateDraft?: (draft: unknown) => void;
  /** Progress callback for long-running operations */
  onProgress?: (progress: { pct?: number; stage?: string }) => void;
}

// =============================================================================
// Tool Execution Result
// =============================================================================

/**
 * Result of a tool execution.
 */
export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  result?: T;
  artifacts?: ToolArtifact[];
  error?: string;
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Definition for a single tool in the client registry.
 */
export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  /** Tool name matching server-side */
  toolName: ToolName;
  /** Human-readable label */
  label: string;
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  /** Danger level for UI styling */
  danger: ToolDangerLevel;
  /** Render a short summary of the tool args */
  renderSummary: (args: TArgs) => string;
  /** Execute the tool */
  execute: (args: TArgs, ctx: ToolExecutionContext) => Promise<ToolExecutionResult<TResult>>;
  /** Validate args before execution (optional) */
  validate?: (args: TArgs) => { valid: boolean; error?: string };
}

// =============================================================================
// Entity Resolution
// =============================================================================

/**
 * Result of resolving an entity by name.
 */
export interface EntityResolution {
  found: boolean;
  entity?: Entity;
  candidates?: Entity[];
  error?: string;
}

/**
 * Resolve an entity by name, optionally filtering by type.
 */
export function resolveEntityByName(
  name: string,
  entities: Map<string, Entity>,
  type?: EntityType
): EntityResolution {
  const matches: Entity[] = [];
  const nameLower = name.toLowerCase();

  entities.forEach((entity) => {
    const nameMatch = entity.name.toLowerCase() === nameLower;
    const aliasMatch = entity.aliases?.some(
      (a) => a.toLowerCase() === nameLower
    );

    if (nameMatch || aliasMatch) {
      if (!type || entity.type === type) {
        matches.push(entity);
      }
    }
  });

  if (matches.length === 0) {
    return { found: false, error: `Entity "${name}" not found` };
  }

  if (matches.length === 1) {
    return { found: true, entity: matches[0] };
  }

  // Multiple matches - ambiguous
  return {
    found: false,
    candidates: matches,
    error: `Multiple entities found matching "${name}". Please specify the type.`,
  };
}

/**
 * Resolve a relationship by source name, target name, and type.
 */
export function resolveRelationship(
  sourceName: string,
  targetName: string,
  type: RelationType,
  entities: Map<string, Entity>,
  relationships: Relationship[]
): { found: boolean; relationship?: Relationship; sourceId?: string; targetId?: string; error?: string } {
  const sourceRes = resolveEntityByName(sourceName, entities);
  if (!sourceRes.found || !sourceRes.entity) {
    return { found: false, error: `Source entity "${sourceName}" not found` };
  }

  const targetRes = resolveEntityByName(targetName, entities);
  if (!targetRes.found || !targetRes.entity) {
    return { found: false, error: `Target entity "${targetName}" not found` };
  }

  const sourceId = sourceRes.entity.id;
  const targetId = targetRes.entity.id;

  const rel = relationships.find(
    (r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type
  );

  if (!rel) {
    return {
      found: false,
      sourceId,
      targetId,
      error: `Relationship "${sourceName} → ${type} → ${targetName}" not found`,
    };
  }

  return { found: true, relationship: rel, sourceId, targetId };
}

// =============================================================================
// Text Resolution
// =============================================================================

/**
 * Result of text resolution - either success with text or failure with error.
 */
export type TextResolutionResult =
  | { success: true; text: string }
  | { success: false; error: string };

/**
 * Resolve text from context based on scope.
 * Falls back to document text if no explicit text or selection.
 */
export function resolveTextFromContext(
  args: { text?: string; scope?: AnalysisScope },
  ctx: ToolExecutionContext,
  operationName: string
): TextResolutionResult {
  let text = args.text;
  if (!text) {
    if (args.scope === "selection") {
      text = ctx.getSelectionText?.();
    } else {
      text = ctx.getDocumentText?.();
    }
  }
  if (!text) {
    return { success: false, error: `No text available for ${operationName}` };
  }
  return { success: true, text };
}
