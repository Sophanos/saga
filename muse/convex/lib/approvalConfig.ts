/**
 * Tool Approval Configuration
 *
 * Centralized configuration for AI tool approval logic.
 * Provides defaults for registry seeding and non-world-graph approvals.
 *
 * World graph approvals are driven by registry riskLevel.
 * These lists define the default registry seed values only.
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
 * Default entity types that should be marked high impact in the registry.
 */
export const HIGH_IMPACT_ENTITY_TYPES: readonly EntityType[] = [
  "character",
  "magic_system",
  "faction",
] as const;

/**
 * Default entity types that should be marked as core in the registry.
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
 * Default relationship types that should be marked high impact in the registry.
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
 * Default relationship types that should be marked as core in the registry.
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
 * Used by agentRuntime only for non-world-graph tools.
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
    // These always require approval (write operations)
    case "write_content":
    case "ask_question":
    case "commit_decision":
      return true;

    // Default: no approval needed (read operations, etc.)
    default:
      return false;
  }
}
