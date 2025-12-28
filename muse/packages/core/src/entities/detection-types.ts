import type { EntityType } from "./types";

/**
 * Represents a single occurrence of an entity within text
 * Contains exact character offsets for editor highlighting
 */
export interface EntityOccurrence {
  /** Starting character offset in the source text (0-indexed) */
  startOffset: number;
  /** Ending character offset in the source text (exclusive) */
  endOffset: number;
  /** The exact text that was matched at this position */
  matchedText: string;
  /** Surrounding context snippet for disambiguation */
  context: string;
}

/**
 * Warning generated during entity detection
 */
export interface DetectionWarning {
  /** Type of warning */
  type: "ambiguous_reference" | "low_confidence" | "possible_alias" | "conflicting_type";
  /** Human-readable message describing the warning */
  message: string;
  /** Entity tempId this warning relates to (if applicable) */
  entityTempId?: string;
  /** Character offset where the issue was detected */
  offset?: number;
}

/**
 * A detected entity from text analysis
 * Used before the entity is persisted to the database
 */
export interface DetectedEntity {
  /** Temporary ID for tracking before persistence (e.g., "temp_1", "temp_2") */
  tempId: string;
  /** Primary name of the entity as detected */
  name: string;
  /** Normalized/canonical form of the name for matching */
  canonicalName: string;
  /** Detected entity type */
  type: EntityType;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** All occurrences of this entity in the text */
  occurrences: EntityOccurrence[];
  /** Potential aliases detected for this entity */
  suggestedAliases: string[];
  /** Properties inferred from context (e.g., gender, role, description) */
  inferredProperties?: Record<string, unknown>;
  /** ID of existing entity if this matches one */
  matchedExistingId?: string;
}

/**
 * Result of entity detection analysis
 */
export interface DetectionResult {
  /** All detected entities grouped by canonical identity */
  entities: DetectedEntity[];
  /** Any warnings generated during detection */
  warnings?: DetectionWarning[];
  /** Statistics about the detection run */
  stats?: DetectionStats;
}

/**
 * Statistics from a detection run
 */
export interface DetectionStats {
  /** Total characters analyzed */
  charactersAnalyzed: number;
  /** Total entities detected */
  totalEntities: number;
  /** Breakdown by entity type */
  byType: Record<EntityType, number>;
  /** Number of entities matched to existing */
  matchedToExisting: number;
  /** Number of new entities detected */
  newEntities: number;
  /** Processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * Options for entity detection
 */
export interface DetectionOptions {
  /** Minimum confidence threshold (0.0-1.0, default 0.5) */
  minConfidence?: number;
  /** Entity types to detect (default: all) */
  entityTypes?: EntityType[];
  /** Whether to attempt alias detection (default: true) */
  detectAliases?: boolean;
  /** Whether to match against existing entities (default: true) */
  matchExisting?: boolean;
  /** Maximum number of entities to return (default: unlimited) */
  maxEntities?: number;
  /** Include surrounding context in occurrences (default: true) */
  includeContext?: boolean;
  /** Number of characters for context snippets (default: 50) */
  contextLength?: number;
}

/**
 * Input for entity detection
 */
export interface DetectionInput {
  /** The text to analyze for entities */
  text: string;
  /** Optional existing entities to match against */
  existingEntities?: Array<{
    id: string;
    name: string;
    aliases: string[];
    type: EntityType;
  }>;
  /** Detection options */
  options?: DetectionOptions;
}
