/**
 * Shared memory retrieval functions for AI edge functions.
 *
 * Provides unified memory and profile context retrieval with configurable limits.
 * Used by ai-saga and ai-chat to avoid code duplication.
 */

import {
  generateEmbedding,
  isDeepInfraConfigured,
} from "../deepinfra.ts";
import {
  searchPoints,
  scrollPoints,
  isQdrantConfigured,
  type QdrantFilter,
} from "../qdrant.ts";
import { getPayloadText } from "../vectorPayload.ts";
import type {
  RetrievedMemoryContext,
  RetrievedMemoryRecord,
  RetrievalLimits,
  ProfileContext,
} from "./types.ts";

// =============================================================================
// Default Limits
// =============================================================================

/**
 * Default limits for ai-saga (full context)
 */
export const DEFAULT_SAGA_LIMITS: RetrievalLimits = {
  decisions: 8,
  style: 6,
  preferences: 6,
  session: 3,
};

/**
 * Default limits for ai-chat (lighter context)
 */
export const DEFAULT_CHAT_LIMITS: RetrievalLimits = {
  decisions: 5,
  style: 4,
  preferences: 0,
  session: 0,
};

// =============================================================================
// Memory Context Retrieval
// =============================================================================

/**
 * Retrieve memory context from Qdrant for the given project/user/conversation.
 *
 * Fetches:
 * - Project-scoped decisions (shared canon)
 * - User-scoped style preferences
 * - User-scoped preferences
 * - Conversation-scoped session memories
 *
 * @param query - Optional query for semantic search on decisions
 * @param projectId - The project ID
 * @param userId - The user ID (null for anonymous)
 * @param conversationId - Optional conversation ID for session memories
 * @param limits - Configurable limits per category (defaults to SAGA limits)
 * @param logPrefix - Prefix for error logging (e.g., "[ai-saga]")
 */
export async function retrieveMemoryContext(
  query: string,
  projectId: string,
  userId: string | null,
  conversationId?: string,
  limits: RetrievalLimits = DEFAULT_SAGA_LIMITS,
  logPrefix: string = "[memory]"
): Promise<RetrievedMemoryContext> {
  if (!isQdrantConfigured()) {
    return { decisions: [], style: [], preferences: [], session: [] };
  }

  const result: RetrievedMemoryContext = {
    decisions: [],
    style: [],
    preferences: [],
    session: [],
  };

  try {
    // Retrieve project-scoped decisions (shared canon)
    if (limits.decisions > 0) {
      const decisionFilter: QdrantFilter = {
        must: [
          { key: "type", match: { value: "memory" } },
          { key: "project_id", match: { value: projectId } },
          { key: "category", match: { value: "decision" } },
          { key: "scope", match: { value: "project" } },
        ],
      };

      // If we have a query, do semantic search; otherwise scroll recent
      if (query && isDeepInfraConfigured()) {
        const embedding = await generateEmbedding(query);
        const decisions = await searchPoints(embedding, limits.decisions, decisionFilter);
        result.decisions = decisions.map((p) => ({
          id: String(p.id),
          content: getPayloadText(p.payload),
          category: "decision",
          score: p.score,
        }));
      } else {
        const decisions = await scrollPoints(decisionFilter, limits.decisions);
        result.decisions = decisions.map((p) => ({
          id: p.id,
          content: getPayloadText(p.payload),
          category: "decision",
        }));
      }
    }

    // Only retrieve user-scoped memories if we have a user
    if (userId) {
      // Retrieve style preferences
      if (limits.style > 0) {
        const styleFilter: QdrantFilter = {
          must: [
            { key: "type", match: { value: "memory" } },
            { key: "project_id", match: { value: projectId } },
            { key: "category", match: { value: "style" } },
            { key: "owner_id", match: { value: userId } },
          ],
        };
        const styleResults = await scrollPoints(styleFilter, limits.style);
        result.style = styleResults.map((p) => ({
          id: p.id,
          content: getPayloadText(p.payload),
          category: "style",
        }));
      }

      // Retrieve preference memories
      if (limits.preferences > 0) {
        const prefFilter: QdrantFilter = {
          must: [
            { key: "type", match: { value: "memory" } },
            { key: "project_id", match: { value: projectId } },
            { key: "category", match: { value: "preference" } },
            { key: "owner_id", match: { value: userId } },
          ],
        };
        const prefResults = await scrollPoints(prefFilter, limits.preferences);
        result.preferences = prefResults.map((p) => ({
          id: p.id,
          content: getPayloadText(p.payload),
          category: "preference",
        }));
      }
    }

    // Retrieve session memories if we have a conversation ID
    if (conversationId && userId && limits.session > 0) {
      const sessionFilter: QdrantFilter = {
        must: [
          { key: "type", match: { value: "memory" } },
          { key: "project_id", match: { value: projectId } },
          { key: "category", match: { value: "session" } },
          { key: "conversation_id", match: { value: conversationId } },
        ],
      };
      const sessionResults = await scrollPoints(sessionFilter, limits.session);
      result.session = sessionResults.map((p) => ({
        id: p.id,
        content: getPayloadText(p.payload),
        category: "session",
      }));
    }
  } catch (error) {
    console.error(`${logPrefix} Memory retrieval error:`, error);
  }

  return result;
}

// =============================================================================
// Profile Context Retrieval
// =============================================================================

/**
 * Supabase client interface for profile retrieval
 */
interface SupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        single(): Promise<{
          data: { preferences: Record<string, unknown> | null } | null;
          error: Error | null;
        }>;
      };
    };
  };
}

/**
 * Retrieve profile context from user preferences in Supabase.
 *
 * @param supabase - Supabase client instance
 * @param userId - The user ID (null returns undefined)
 * @param logPrefix - Prefix for error logging
 */
export async function retrieveProfileContext(
  supabase: SupabaseClient,
  userId: string | null,
  logPrefix: string = "[memory]"
): Promise<ProfileContext | undefined> {
  if (!userId) {
    return undefined;
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return undefined;
    }

    const prefs = data.preferences as Record<string, unknown> | null;
    const writing = prefs?.writing as Record<string, unknown> | undefined;

    if (!writing) {
      return undefined;
    }

    return {
      preferredGenre: writing.preferredGenre as string | undefined,
      namingCulture: writing.namingCulture as string | undefined,
      namingStyle: writing.namingStyle as string | undefined,
      logicStrictness: writing.logicStrictness as string | undefined,
    };
  } catch (error) {
    console.error(`${logPrefix} Profile retrieval error:`, error);
    return undefined;
  }
}

// =============================================================================
// Re-exports
// =============================================================================

export type {
  RetrievedMemoryContext,
  RetrievedMemoryRecord,
  RetrievalLimits,
  ProfileContext,
} from "./types.ts";
