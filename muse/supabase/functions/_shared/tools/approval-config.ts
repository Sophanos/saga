/**
 * Tool Approval Configuration
 *
 * Centralized configuration for AI SDK 6 needsApproval logic.
 * Consolidates duplicate high-impact type arrays across tool definitions.
 *
 * @module tools/approval-config
 */

import type { EntityType, RelationType } from "./types.ts";

// =============================================================================
// Entity Approval Configuration
// =============================================================================

/**
 * Entity types that always require approval when created.
 * These are core world elements that significantly impact the story.
 */
export const HIGH_IMPACT_ENTITY_TYPES: readonly EntityType[] = [
  "character",
  "magic_system",
  "faction",
] as const;

/**
 * Entity types that require approval for any update.
 * Updates to these types can fundamentally change the story.
 */
export const SENSITIVE_ENTITY_TYPES: readonly EntityType[] = [
  "character",
  "faction",
  "magic_system",
] as const;

/**
 * Entity fields that affect identity and require approval to modify.
 * Changes to these fields can break narrative consistency.
 */
export const IDENTITY_SENSITIVE_FIELDS: readonly string[] = [
  "name",
  "archetype",
  "backstory",
  "goals",
] as const;

// =============================================================================
// Relationship Approval Configuration
// =============================================================================

/**
 * Relationship types that require approval when created.
 * Includes familial, power dynamics, and story-critical relationships.
 */
export const HIGH_IMPACT_RELATIONSHIP_TYPES: readonly RelationType[] = [
  // Familial relationships
  "parent_of",
  "child_of",
  "sibling_of",
  "married_to",
  // Power dynamics
  "rules",
  "serves",
  "member_of",
  // Story-critical
  "killed",
  "created",
] as const;

/**
 * Core relationship types that require approval for any update.
 * Subset of high-impact types - the most story-critical ones.
 */
export const CORE_RELATIONSHIP_TYPES: readonly RelationType[] = [
  "parent_of",
  "child_of",
  "sibling_of",
  "married_to",
  "killed",
  "created",
] as const;

/**
 * Threshold below which relationship strength changes require approval.
 * Weakening a relationship significantly can impact story dynamics.
 */
export const RELATIONSHIP_STRENGTH_THRESHOLD = 0.3;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if an entity type requires approval when created.
 */
export function isHighImpactEntityType(type: EntityType): boolean {
  return (HIGH_IMPACT_ENTITY_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an entity type requires approval for any update.
 */
export function isSensitiveEntityType(type: EntityType | undefined): boolean {
  return !!type && (SENSITIVE_ENTITY_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an update contains identity-changing fields.
 */
export function hasIdentityChange(updates: Record<string, unknown>): boolean {
  return IDENTITY_SENSITIVE_FIELDS.some(
    (field) => updates[field] !== undefined
  );
}

/**
 * Check if a relationship type requires approval when created.
 */
export function isHighImpactRelationshipType(type: RelationType): boolean {
  return (HIGH_IMPACT_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

/**
 * Check if a relationship type requires approval for any update.
 */
export function isCoreRelationshipType(type: RelationType): boolean {
  return (CORE_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

/**
 * Check if a relationship strength change is significant enough to require approval.
 */
export function isSignificantStrengthChange(strength: number | undefined): boolean {
  return strength !== undefined && strength < RELATIONSHIP_STRENGTH_THRESHOLD;
}
