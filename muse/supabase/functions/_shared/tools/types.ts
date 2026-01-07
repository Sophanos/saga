/**
 * Server-side tool type definitions.
 * These are the canonical Zod schemas used by the AI SDK.
 */

import { z } from "../deps/zod.ts";

// =============================================================================
// Entity Types
// =============================================================================

/**
 * EntityType - INTENTIONAL DUPLICATION
 *
 * This duplicates @mythos/core EntityType for Deno edge function compatibility.
 * Edge functions cannot import npm packages, so we maintain Zod schemas here.
 *
 * IMPORTANT: Keep in sync with packages/core/src/entities/types.ts
 */
export const entityTypeSchema = z.enum([
  "character",
  "location",
  "item",
  "faction",
  "magic_system",
  "event",
  "concept",
]);

export type EntityType = z.infer<typeof entityTypeSchema>;

// =============================================================================
// Relationship Types
// =============================================================================

/**
 * RelationType - INTENTIONAL DUPLICATION
 *
 * This duplicates @mythos/core RelationType for Deno edge function compatibility.
 * Edge functions cannot import npm packages, so we maintain Zod schemas here.
 *
 * IMPORTANT: Keep in sync with packages/core/src/entities/types.ts
 */
export const relationTypeSchema = z.enum([
  "knows",
  "loves",
  "hates",
  "killed",
  "created",
  "owns",
  "guards",
  "weakness",
  "strength",
  "parent_of",
  "child_of",
  "sibling_of",
  "married_to",
  "allied_with",
  "enemy_of",
  "member_of",
  "rules",
  "serves",
]);

export type RelationType = z.infer<typeof relationTypeSchema>;

// =============================================================================
// Item Categories
// =============================================================================

export const itemCategorySchema = z.enum([
  "weapon",
  "armor",
  "artifact",
  "consumable",
  "key",
  "other",
]);

export type ItemCategory = z.infer<typeof itemCategorySchema>;

// =============================================================================
// Content Types
// =============================================================================

export const contentTypeSchema = z.enum([
  "description",
  "backstory",
  "dialogue",
  "scene",
]);

export type ContentType = z.infer<typeof contentTypeSchema>;

// =============================================================================
// Length Options
// =============================================================================

export const lengthSchema = z.enum(["short", "medium", "long"]);

export type Length = z.infer<typeof lengthSchema>;

// =============================================================================
// Saga Tool Schemas
// =============================================================================

export const genesisDetailLevelSchema = z.enum(["minimal", "standard", "detailed"]);
export type GenesisDetailLevel = z.infer<typeof genesisDetailLevelSchema>;

export const analysisScopeSchema = z.enum(["selection", "document", "project"]);
export type AnalysisScope = z.infer<typeof analysisScopeSchema>;

export const templateComplexitySchema = z.enum(["simple", "standard", "complex"]);
export type TemplateComplexity = z.infer<typeof templateComplexitySchema>;

export const consistencyFocusSchema = z.enum(["character", "world", "plot", "timeline"]);
export type ConsistencyFocus = z.infer<typeof consistencyFocusSchema>;

// =============================================================================
// check_logic Tool Schemas
// =============================================================================

export const logicFocusSchema = z.enum([
  "magic_rules",
  "causality",
  "knowledge_state",
  "power_scaling",
]);
export type LogicFocus = z.infer<typeof logicFocusSchema>;

export const logicStrictnessSchema = z.enum(["strict", "balanced", "lenient"]);
export type LogicStrictness = z.infer<typeof logicStrictnessSchema>;

export const logicViolationTypeSchema = z.enum([
  "magic_rule_violation",
  "causality_break",
  "knowledge_violation",
  "power_scaling_violation",
]);
export type LogicViolationType = z.infer<typeof logicViolationTypeSchema>;

// =============================================================================
// name_generator Tool Schemas
// =============================================================================

export const nameCultureSchema = z.enum([
  "western",
  "norse",
  "japanese",
  "chinese",
  "arabic",
  "slavic",
  "celtic",
  "latin",
  "indian",
  "african",
  "custom",
]);
export type NameCulture = z.infer<typeof nameCultureSchema>;

export const nameStyleSchema = z.enum(["short", "standard", "long"]);
export type NameStyle = z.infer<typeof nameStyleSchema>;

// =============================================================================
// Image Generation Schemas
// =============================================================================

/**
 * ImageStyle - Style presets for AI image generation.
 * Covers a wide range of artistic styles for different creative genres.
 */
export const imageStyleSchema = z.enum([
  // Fantasy
  "fantasy_art",        // Epic fantasy book cover style
  "dark_fantasy",       // Grimdark, gothic
  "high_fantasy",       // Bright, magical, Tolkien-esque
  // Manga/Anime
  "manga",              // B&W manga panel style
  "anime",              // Color anime style
  "light_novel",        // Light novel illustration
  "visual_novel",       // VN character sprite style
  // Realistic/Artistic
  "realistic",          // Photorealistic
  "oil_painting",       // Classical oil painting
  "watercolor",         // Soft watercolor
  "concept_art",        // Game/film concept art
  "portrait_photo",     // Studio portrait style
  // Genre-specific
  "sci_fi",             // Science fiction
  "horror",             // Dark, unsettling
  "romance",            // Soft, romantic lighting
  "noir",               // High contrast, moody
  // Stylized
  "comic_book",         // Western comic style
  "pixel_art",          // Retro pixel art
  "chibi",              // Cute chibi style
]);
export type ImageStyle = z.infer<typeof imageStyleSchema>;

/**
 * AspectRatio - Standard aspect ratios for AI image generation.
 */
export const aspectRatioSchema = z.enum([
  "1:1",      // Square - avatars, icons
  "3:4",      // Portrait - character cards
  "4:3",      // Landscape - scenes
  "9:16",     // Tall portrait - full body, mobile
  "16:9",     // Wide landscape - panoramas, banners
  "2:3",      // Book cover ratio
  "3:2",      // Photo ratio
]);
export type AspectRatio = z.infer<typeof aspectRatioSchema>;

/**
 * AssetType - Classification for generated or uploaded assets.
 */
export const assetTypeSchema = z.enum([
  "portrait",     // Face/bust character portraits
  "scene",        // Narrative scene illustrations
  "location",     // Location/environment art
  "item",         // Item icons and detail views
  "reference",    // Uploaded reference images
  "other",        // Miscellaneous assets
]);
export type AssetType = z.infer<typeof assetTypeSchema>;

// =============================================================================
// Image Editing Schemas
// =============================================================================

/**
 * EditMode - How the model should interpret the edit request.
 */
export const editModeSchema = z.enum([
  "inpaint",         // Modify specific elements while keeping the rest
  "outpaint",        // Extend/expand the image beyond its frame
  "remix",           // General variation/edit using the reference as guidance
  "style_transfer",  // Re-render in a target style while preserving subject
]);

export type EditMode = z.infer<typeof editModeSchema>;

// =============================================================================
// Saga Mode and Editor Context
// (Aligned with @mythos/agent-protocol)
// =============================================================================

/**
 * Mode context for Saga AI interactions.
 * Determines which system prompt addendum is applied.
 */
export const sagaModeSchema = z.enum(["onboarding", "creation", "editing", "analysis"]);
export type SagaMode = z.infer<typeof sagaModeSchema>;

/**
 * Editor context sent with Saga requests.
 * Provides information about the user's current editing state.
 */
export interface EditorContext {
  /** Title of the currently open document */
  documentTitle?: string;
  /** Clipped excerpt of the current document (when available) */
  documentExcerpt?: string;
  /** Currently selected text in the editor */
  selectionText?: string;
  /** Surrounding context around the selection (when available) */
  selectionContext?: string;
}

// =============================================================================
// Entity Detection Types
// (Aligned with @mythos/core/entities/detection-types.ts)
// =============================================================================

/**
 * Represents a single occurrence of an entity within text.
 * Contains exact character offsets for editor highlighting.
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
 * Warning generated during entity detection.
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
 * A detected entity from text analysis.
 * Used before the entity is persisted to the database.
 */
export interface DetectedEntity {
  /** Temporary ID for tracking before persistence */
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
  /** Properties inferred from context */
  inferredProperties?: Record<string, unknown>;
  /** ID of existing entity if this matches one */
  matchedExistingId?: string;
}

/**
 * Statistics from a detection run.
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
 * Options for entity detection.
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
  /** Maximum number of entities to return */
  maxEntities?: number;
  /** Include surrounding context in occurrences (default: true) */
  includeContext?: boolean;
  /** Number of characters for context snippets (default: 50) */
  contextLength?: number;
}

/**
 * Result of entity detection analysis.
 */
export interface DetectionResult {
  /** All detected entities */
  entities: DetectedEntity[];
  /** Any warnings generated during detection */
  warnings?: DetectionWarning[];
  /** Statistics about the detection run */
  stats?: DetectionStats;
}

/**
 * Existing entity for matching during detection.
 */
export interface ExistingEntity {
  id: string;
  name: string;
  aliases: string[];
  type: EntityType;
}

// =============================================================================
// Tool Result Interface
// =============================================================================

export interface ToolExecuteResult {
  toolName: string;
  proposal?: unknown;
  message: string;
}
