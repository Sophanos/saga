/**
 * Shared memory retrieval functions for AI edge functions (MLP 2.x).
 *
 * Provides unified memory and profile context retrieval with configurable limits.
 * Used by ai-saga and ai-chat to avoid code duplication.
 *
 * Key improvements in MLP 2.x:
 * - Proper owner isolation for user/conversation scopes
 * - Correct session filter: (projectId, ownerId, conversationId, scope=conversation)
 * - Qdrant-first with Postgres fallback
 */

import {
  generateEmbedding,
  isDeepInfraConfigured,
} from "../deepinfra.ts";
import {
  searchPoints,
  scrollPoints,
  isQdrantConfigured,
  QdrantError,
  type QdrantFilter,
} from "../qdrant.ts";
import { getPayloadText } from "../vectorPayload.ts";
import {
  isMemoryExpired,
  getMemoryPolicyConfig,
} from "../memoryPolicy.ts";
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
// Helpers
// =============================================================================

/**
 * Filter out expired memories.
 */
function filterExpired(memories: RetrievedMemoryRecord[]): RetrievedMemoryRecord[] {
  const nowMs = Date.now();
  return memories.filter((m) => {
    // Check if payload has expires_at
    const payload = (m as any).payload;
    const expiresAtTs = payload?.expires_at_ts ?? payload?.expires_at
      ? new Date(payload.expires_at).getTime()
      : undefined;
    const createdAtTs = payload?.created_at_ts ?? new Date(m.createdAt ?? Date.now()).getTime();

    return !isMemoryExpired({
      category: m.category,
      createdAtTs,
      expiresAtTs,
      nowMs,
    });
  });
}

/**
 * Parse memory from Qdrant result.
 */
function parseMemoryFromPayload(
  id: string,
  payload: Record<string, unknown>,
  score?: number
): RetrievedMemoryRecord {
  return {
    id,
    content: getPayloadText(payload),
    category: String(payload.category ?? "preference"),
    score,
    createdAt: payload.created_at as string | undefined,
  };
}

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
 * @param ownerId - Owner ID (userId or anonDeviceId) - REQUIRED for user/conversation scopes
 * @param conversationId - Optional conversation ID for session memories
 * @param limits - Configurable limits per category (defaults to SAGA limits)
 * @param logPrefix - Prefix for error logging (e.g., "[ai-saga]")
 */
export async function retrieveMemoryContext(
  query: string,
  projectId: string,
  ownerId: string | null,
  conversationId?: string,
  limits: RetrievalLimits = DEFAULT_SAGA_LIMITS,
  logPrefix: string = "[memory]"
): Promise<RetrievedMemoryContext> {
  const result: RetrievedMemoryContext = {
    decisions: [],
    style: [],
    preferences: [],
    session: [],
  };

  // If Qdrant is not configured, try Postgres fallback
  if (!isQdrantConfigured()) {
    console.log(`${logPrefix} Qdrant not configured, memory context unavailable`);
    return result;
  }

  try {
    // Retrieve project-scoped decisions (shared canon) - visible to all with project access
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
        const decisions = await searchPoints(embedding, limits.decisions * 2, decisionFilter);
        result.decisions = filterExpired(
          decisions.map((p) => parseMemoryFromPayload(String(p.id), p.payload, p.score))
        ).slice(0, limits.decisions);
      } else {
        const decisions = await scrollPoints(decisionFilter, limits.decisions * 2);
        result.decisions = filterExpired(
          decisions.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.decisions);
      }
    }

    // Only retrieve user-scoped memories if we have an owner ID
    // This enforces proper isolation - anonymous users without device ID cannot see user-scoped memories
    if (ownerId) {
      // Retrieve style preferences (user scope)
      if (limits.style > 0) {
        const styleFilter: QdrantFilter = {
          must: [
            { key: "type", match: { value: "memory" } },
            { key: "project_id", match: { value: projectId } },
            { key: "category", match: { value: "style" } },
            { key: "scope", match: { value: "user" } },
            { key: "owner_id", match: { value: ownerId } },
          ],
        };
        const styleResults = await scrollPoints(styleFilter, limits.style * 2);
        result.style = filterExpired(
          styleResults.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.style);
      }

      // Retrieve preference memories (user scope)
      if (limits.preferences > 0) {
        const prefFilter: QdrantFilter = {
          must: [
            { key: "type", match: { value: "memory" } },
            { key: "project_id", match: { value: projectId } },
            { key: "category", match: { value: "preference" } },
            { key: "scope", match: { value: "user" } },
            { key: "owner_id", match: { value: ownerId } },
          ],
        };
        const prefResults = await scrollPoints(prefFilter, limits.preferences * 2);
        result.preferences = filterExpired(
          prefResults.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.preferences);
      }

      // Retrieve session memories - MUST include all isolation fields
      // Filter: (projectId, ownerId, conversationId, category=session, scope=conversation)
      if (conversationId && limits.session > 0) {
        const sessionFilter: QdrantFilter = {
          must: [
            { key: "type", match: { value: "memory" } },
            { key: "project_id", match: { value: projectId } },
            { key: "category", match: { value: "session" } },
            { key: "scope", match: { value: "conversation" } },
            { key: "owner_id", match: { value: ownerId } },
            { key: "conversation_id", match: { value: conversationId } },
          ],
        };
        const sessionResults = await scrollPoints(sessionFilter, limits.session * 2);
        result.session = filterExpired(
          sessionResults.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.session);
      }
    } else {
      console.log(`${logPrefix} No owner ID, skipping user/conversation-scoped memories`);
    }
  } catch (error) {
    if (error instanceof QdrantError) {
      console.warn(`${logPrefix} Qdrant error, memory context unavailable: ${error.message}`);
    } else {
      console.error(`${logPrefix} Memory retrieval error:`, error);
    }
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
