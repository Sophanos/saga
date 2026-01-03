/**
 * @mythos/context - Types
 *
 * Types for client-side context assembly.
 */

import type {
  EditorContext,
  NameCulture,
  NameStyle,
  LogicStrictness,
  SmartModeConfig,
} from "@mythos/agent-protocol";

/**
 * Profile context extracted from user preferences.
 * Used for prompt personalization.
 */
export interface ProfileContext {
  /** Preferred story genre */
  preferredGenre?: string;
  /** Default naming culture */
  namingCulture?: NameCulture;
  /** Default name length style */
  namingStyle?: NameStyle;
  /** Logic checking strictness */
  logicStrictness?: LogicStrictness;
  /** Smart mode configuration for learned style usage */
  smartMode?: SmartModeConfig;
}

/**
 * Summary of an entity for world context.
 */
export interface EntitySummary {
  id: string;
  name: string;
  type: string;
  summary?: string;
}

/**
 * Summary of a relationship for world context.
 */
export interface RelationshipSummary {
  sourceId: string;
  targetId: string;
  type: string;
}

/**
 * World context summary for context hints.
 */
export interface WorldContextSummary {
  entities: EntitySummary[];
  relationships: RelationshipSummary[];
}

/**
 * Unified context hints that can be sent with requests.
 * Provides client-side context even when server RAG isn't updated yet.
 */
export interface ProjectPersonalizationContext {
  genre?: string;
  styleMode?: string;
  guardrails?: {
    plot?: "no_plot_generation" | "suggestions_only" | "allow_generation";
    edits?: "proofread_only" | "line_edits" | "rewrite";
    strictness?: "low" | "medium" | "high";
    no_judgement_mode?: boolean;
  };
  smartMode?: SmartModeConfig;
}

export interface UnifiedContextHints {
  /** User profile preferences */
  profile?: ProfileContext;
  /** World state summary */
  world?: WorldContextSummary;
  /** Current editor state */
  editor?: EditorContext;
  /** Conversation ID for session memory */
  conversationId?: string;
  /** Project-level personalization hints */
  project?: ProjectPersonalizationContext;
}

// Re-export relevant types
export type { ProfilePreferences, EditorContext } from "@mythos/agent-protocol";
