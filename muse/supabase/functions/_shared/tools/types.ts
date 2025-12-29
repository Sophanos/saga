/**
 * Server-side tool type definitions.
 * These are the canonical Zod schemas used by the AI SDK.
 */

import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// =============================================================================
// Entity Types
// =============================================================================

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
  /** Currently selected text in the editor */
  selectionText?: string;
}

// =============================================================================
// Tool Result Interface
// =============================================================================

export interface ToolExecuteResult {
  toolName: string;
  proposal?: unknown;
  message: string;
}
