/**
 * @mythos/agent-protocol - Core Types
 *
 * Base domain types, re-exports from @mythos/core, and foundational enums.
 */

// =============================================================================
// Imports from @mythos/core (Single Source of Truth)
// =============================================================================

// Import types for internal use in this file
import type {
  EntityType as CoreEntityType,
  RelationType as CoreRelationType,
  EntityOccurrence as CoreEntityOccurrence,
} from "@mythos/core";

// =============================================================================
// Re-exports from @mythos/core
// =============================================================================

// Re-export core types for consumers
export type EntityType = CoreEntityType;
export type RelationType = CoreRelationType;
export type EntityOccurrence = CoreEntityOccurrence;

// Also export with Core prefix for disambiguation if needed
export type {
  DetectedEntity as CoreDetectedEntity,
  DetectionWarning as CoreDetectionWarning,
  DetectionResult as CoreDetectionResult,
  DetectionStats as CoreDetectionStats,
  DetectionOptions as CoreDetectionOptions,
  DetectionInput as CoreDetectionInput,
} from "@mythos/core";

// =============================================================================
// Saga Modes and Context
// =============================================================================

/**
 * Mode context for Saga AI interactions.
 * Determines which system prompt addendum is applied.
 */
export type SagaMode = "onboarding" | "creation" | "editing" | "analysis";

/**
 * Editor context sent with Saga requests.
 * Provides information about the user's current editing state.
 */
export interface EditorContext {
  /** Title of the currently open document */
  documentTitle?: string;
  /** Currently selected text in the editor */
  selectionText?: string;
}

// =============================================================================
// Analysis and Generation Types
// =============================================================================

/**
 * Complexity level for template generation.
 */
export type TemplateComplexity = "simple" | "standard" | "complex";

/**
 * Detail level for world generation.
 */
export type GenesisDetailLevel = "minimal" | "standard" | "detailed";

/**
 * Scope for entity detection or consistency checking.
 */
export type AnalysisScope = "selection" | "document" | "project";

/**
 * Focus areas for logic checking.
 */
export type LogicFocus =
  | "magic_rules"
  | "causality"
  | "knowledge_state"
  | "power_scaling";

/**
 * Strictness level for logic checking.
 */
export type LogicStrictness = "strict" | "balanced" | "lenient";

/**
 * Cultural inspiration for name generation.
 */
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

/**
 * Style preference for generated names.
 */
export type NameStyle = "short" | "standard" | "long";

// =============================================================================
// Preferences
// =============================================================================

export type SmartModeLevel = "off" | "balanced" | "adaptive";

export interface SmartModeConfig {
  level: SmartModeLevel;
  learnedStyleMaxItems?: number;
  learnedStyleWeight?: number;
}

/**
 * User preferences for writing/AI behavior.
 * Stored in profile.preferences.writing
 */
export interface WritingPreferences {
  /** Preferred genre for suggestions and generation */
  preferredGenre?: string;
  /** Default naming culture for name generation */
  namingCulture?: NameCulture;
  /** Default name length style */
  namingStyle?: NameStyle;
  /** Default strictness for logic checking */
  logicStrictness?: LogicStrictness;
  /** Smart mode configuration for learned style usage */
  smartMode?: SmartModeConfig;
  /** Default style mode for new projects */
  defaultStyleMode?: string;
}

/**
 * Full profile preferences object (namespaced).
 */
export interface ProfilePreferences {
  writing?: WritingPreferences;
}

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

// =============================================================================
// Tool Metadata Types
// =============================================================================

/**
 * Danger level for tool execution.
 */
export type ToolDangerLevel = "safe" | "destructive" | "costly";
