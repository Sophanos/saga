/**
 * Tool Approval Configuration
 *
 * Centralized configuration for AI tool approval logic.
 * Determines which entity/relationship operations require user approval.
 *
 * High-impact operations (characters, magic systems, family relationships)
 * require approval to prevent unintended story changes.
 *
 * Low-impact operations (items, locations, simple relationships) auto-execute
 * for faster workflow.
 */

// =============================================================================
// Entity Types
// =============================================================================

/**
 * All supported entity types in the World Graph.
 */
export const ENTITY_TYPES = [
  "character",
  "location",
  "item",
  "faction",
  "magic_system",
  "event",
  "concept",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/**
 * Entity types that require approval when created.
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
// Relationship Types
// =============================================================================

/**
 * All supported relationship types in the World Graph.
 */
export const RELATION_TYPES = [
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
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

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
 *
 * @example
 * isHighImpactEntityType("character") // true
 * isHighImpactEntityType("item")      // false
 */
export function isHighImpactEntityType(type: string): boolean {
  return (HIGH_IMPACT_ENTITY_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an entity type requires approval for any update.
 */
export function isSensitiveEntityType(type: string | undefined): boolean {
  return !!type && (SENSITIVE_ENTITY_TYPES as readonly string[]).includes(type);
}

/**
 * Check if an update contains identity-changing fields.
 *
 * @example
 * hasIdentityChange({ name: "New Name" })  // true
 * hasIdentityChange({ notes: "..." })      // false
 */
export function hasIdentityChange(updates: Record<string, unknown>): boolean {
  return IDENTITY_SENSITIVE_FIELDS.some(
    (field) => updates[field] !== undefined
  );
}

/**
 * Check if a relationship type requires approval when created.
 *
 * @example
 * isHighImpactRelationshipType("parent_of") // true
 * isHighImpactRelationshipType("knows")     // false
 */
export function isHighImpactRelationshipType(type: string): boolean {
  return (HIGH_IMPACT_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

/**
 * Check if a relationship type requires approval for any update.
 */
export function isCoreRelationshipType(type: string): boolean {
  return (CORE_RELATIONSHIP_TYPES as readonly string[]).includes(type);
}

/**
 * Check if a relationship strength change is significant enough to require approval.
 * Weakening below threshold (0.3) is considered significant.
 */
export function isSignificantStrengthChange(
  strength: number | undefined
): boolean {
  return strength !== undefined && strength < RELATIONSHIP_STRENGTH_THRESHOLD;
}

/**
 * Determine if a tool call needs user approval based on tool name and arguments.
 * Used by agentRuntime to decide between auto-execute and approval flow.
 *
 * @example
 * needsToolApproval("create_entity", { type: "character" })     // true
 * needsToolApproval("create_entity", { type: "item" })          // false
 * needsToolApproval("create_relationship", { type: "knows" })   // false
 * needsToolApproval("create_relationship", { type: "parent_of" }) // true
 */
export function needsToolApproval(
  toolName: string,
  args: Record<string, unknown>
): boolean {
  switch (toolName) {
    case "create_entity":
      return isHighImpactEntityType(args["type"] as string);

    case "update_entity":
      // Always require approval for entity updates (safety first)
      return true;

    case "create_relationship":
      return isHighImpactRelationshipType(args["type"] as string);

    case "update_relationship":
      // Require approval if updating core relationships or significant strength change
      return (
        isCoreRelationshipType(args["type"] as string) ||
        isSignificantStrengthChange(args["strength"] as number | undefined)
      );

    // These always require approval (write operations)
    case "write_content":
    case "ask_question":
      return true;

    // Default: no approval needed (read operations, etc.)
    default:
      return false;
  }
}
