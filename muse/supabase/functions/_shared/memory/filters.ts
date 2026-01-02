/**
 * Shared Qdrant filter builders for memory queries.
 *
 * Provides unified filter construction to reduce duplication
 * across retrieval.ts, ai-memory-read, and other memory functions.
 */
import type { QdrantFilter, QdrantCondition } from "../qdrant.ts";
import type { MemoryCategory, MemoryScope } from "./types.ts";

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for building a memory filter.
 */
export interface MemoryFilterParams {
  projectId: string;
  category?: MemoryCategory;
  categories?: MemoryCategory[];
  scope?: MemoryScope;
  ownerId?: string;
  conversationId?: string;
}

// =============================================================================
// Filter Builder
// =============================================================================

/**
 * Build a Qdrant filter for memory queries.
 *
 * @param params - Filter parameters
 * @returns QdrantFilter with must conditions
 *
 * @example
 * // Simple filter for project decisions
 * const filter = buildMemoryFilter({
 *   projectId: "proj-123",
 *   category: "decision",
 *   scope: "project",
 * });
 *
 * @example
 * // User-scoped style preferences
 * const filter = buildMemoryFilter({
 *   projectId: "proj-123",
 *   category: "style",
 *   scope: "user",
 *   ownerId: "user-456",
 * });
 *
 * @example
 * // Session memories for a conversation
 * const filter = buildMemoryFilter({
 *   projectId: "proj-123",
 *   category: "session",
 *   scope: "conversation",
 *   ownerId: "user-456",
 *   conversationId: "conv-789",
 * });
 */
export function buildMemoryFilter(params: MemoryFilterParams): QdrantFilter {
  const must: QdrantCondition[] = [
    { key: "type", match: { value: "memory" } },
    { key: "project_id", match: { value: params.projectId } },
  ];

  // Handle single category or multiple categories
  if (params.category) {
    must.push({ key: "category", match: { value: params.category } });
  } else if (params.categories && params.categories.length > 0) {
    if (params.categories.length === 1) {
      must.push({ key: "category", match: { value: params.categories[0] } });
    } else {
      must.push({ key: "category", match: { any: params.categories } });
    }
  }

  if (params.scope) {
    must.push({ key: "scope", match: { value: params.scope } });
  }

  // Owner ID filtering with scope-aware logic
  // For non-project scopes, we MUST filter by owner to prevent privacy leaks
  if (params.ownerId && params.scope && params.scope !== "project") {
    must.push({ key: "owner_id", match: { value: params.ownerId } });
  }

  // Conversation ID for conversation-scoped queries
  if (params.conversationId) {
    must.push({ key: "conversation_id", match: { value: params.conversationId } });
  }

  return { must };
}

/**
 * Build a filter for project-scoped decisions (shared canon).
 * Convenience wrapper for common decision retrieval pattern.
 */
export function buildDecisionFilter(projectId: string): QdrantFilter {
  return buildMemoryFilter({
    projectId,
    category: "decision",
    scope: "project",
  });
}

/**
 * Build a filter for user-scoped style preferences.
 * Convenience wrapper for common style retrieval pattern.
 */
export function buildStyleFilter(projectId: string, ownerId: string): QdrantFilter {
  return buildMemoryFilter({
    projectId,
    category: "style",
    scope: "user",
    ownerId,
  });
}

/**
 * Build a filter for user-scoped preferences.
 * Convenience wrapper for common preference retrieval pattern.
 */
export function buildPreferenceFilter(projectId: string, ownerId: string): QdrantFilter {
  return buildMemoryFilter({
    projectId,
    category: "preference",
    scope: "user",
    ownerId,
  });
}

/**
 * Build a filter for conversation-scoped session memories.
 * Convenience wrapper for common session retrieval pattern.
 */
export function buildSessionFilter(
  projectId: string,
  ownerId: string,
  conversationId: string
): QdrantFilter {
  return buildMemoryFilter({
    projectId,
    category: "session",
    scope: "conversation",
    ownerId,
    conversationId,
  });
}
