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
} from "../qdrant.ts";
import { parseMemoryFromPayload } from "./parsers.ts";
import {
  isMemoryExpired,
} from "../memoryPolicy.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import type {
  RetrievedMemoryContext,
  RetrievedMemoryRecord,
  RetrievalLimits,
  ProfileContext,
  MemoryCategory,
} from "./types.ts";
import {
  buildDecisionFilter,
  buildStyleFilter,
  buildPreferenceFilter,
  buildSessionFilter,
} from "./filters.ts";

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
 * Filter memories for visibility rules.
 */
function filterVisible(
  memories: RetrievedMemoryRecord[],
  options?: {
    includeExpired?: boolean;
    includeRedacted?: boolean;
    maxAgeMs?: number;
  }
): RetrievedMemoryRecord[] {
  const nowMs = Date.now();
  const includeExpired = options?.includeExpired === true;
  const includeRedacted = options?.includeRedacted === true;
  const maxAgeMs = options?.maxAgeMs;

  return memories.filter((m) => {
    if (!includeRedacted && m.redacted) {
      return false;
    }

    const createdAtTs = m.createdAtTs ?? new Date(m.createdAt ?? Date.now()).getTime();
    if (maxAgeMs !== undefined && nowMs - createdAtTs > maxAgeMs) {
      return false;
    }

    if (includeExpired) {
      return true;
    }

    const expiresAtTs = m.expiresAt ? new Date(m.expiresAt).getTime() : undefined;

    return !isMemoryExpired({
      category: m.category,
      createdAtTs,
      expiresAtTs,
      nowMs,
    });
  });
}

/**
 * Parse memory from Postgres search_memories result.
 */
function parseMemoryFromPostgres(row: {
  id: string;
  content: string;
  category: string;
  created_at: string;
  similarity: number;
}): RetrievedMemoryRecord {
  return {
    id: row.id,
    content: row.content,
    category: row.category,
    score: row.similarity,
    createdAt: row.created_at,
  };
}

// =============================================================================
// Postgres Fallback Retrieval
// =============================================================================

/**
 * Retrieve memories from Postgres using the search_memories RPC function.
 * Used as fallback when Qdrant is unavailable.
 */
async function retrieveMemoriesFromPostgres(
  // deno-lint-ignore no-explicit-any
  supabaseClient: SupabaseClient<any, any, any>,
  embedding: number[] | null,
  projectId: string,
  categories: MemoryCategory[],
  scope: string | null,
  ownerId: string | null,
  conversationId: string | null,
  limit: number,
  logPrefix: string
): Promise<RetrievedMemoryRecord[]> {
  // If no embedding available, we can't do semantic search in Postgres
  if (!embedding) {
    console.log(`${logPrefix} No embedding available for Postgres fallback search`);
    return [];
  }

  try {
    const { data, error } = await supabaseClient.rpc('search_memories', {
      query_embedding: embedding,
      match_count: limit * 2, // Fetch extra to account for filtering
      project_filter: projectId,
      category_filter: categories,
      scope_filter: scope,
      owner_filter: ownerId,
      conversation_filter: conversationId,
    });

    if (error) {
      console.warn(`${logPrefix} Postgres search_memories error: ${error.message}`);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    // Map results to RetrievedMemoryRecord format
    const memories = data.map(parseMemoryFromPostgres);

    // Filter expired and limit results
    return filterVisible(memories).slice(0, limit);
  } catch (error) {
    console.warn(`${logPrefix} Postgres fallback error:`, error);
    return [];
  }
}

/**
 * Retrieve all memory context from Postgres as fallback.
 */
async function retrieveMemoryContextFromPostgres(
  // deno-lint-ignore no-explicit-any
  supabaseClient: SupabaseClient<any, any, any>,
  query: string,
  projectId: string,
  ownerId: string | null,
  conversationId: string | undefined,
  limits: RetrievalLimits,
  logPrefix: string
): Promise<RetrievedMemoryContext> {
  const result: RetrievedMemoryContext = {
    decisions: [],
    style: [],
    preferences: [],
    session: [],
  };

  // Generate embedding for semantic search if we have a query
  let embedding: number[] | null = null;
  if (query && isDeepInfraConfigured()) {
    try {
      embedding = await generateEmbedding(query);
    } catch (error) {
      console.warn(`${logPrefix} Failed to generate embedding for Postgres fallback: ${error}`);
    }
  }

  // If no embedding, we can't search
  if (!embedding) {
    console.log(`${logPrefix} No embedding available, Postgres fallback unavailable`);
    return result;
  }

  console.log(`${logPrefix} Using Postgres fallback for memory retrieval`);

  // Retrieve project-scoped decisions
  if (limits.decisions > 0) {
    result.decisions = await retrieveMemoriesFromPostgres(
      supabaseClient,
      embedding,
      projectId,
      ['decision'],
      'project',
      null, // decisions don't require owner filter
      null,
      limits.decisions,
      logPrefix
    );
  }

  // Only retrieve user-scoped memories if we have a valid owner ID
  if (ownerId && ownerId.length > 0) {
    // Retrieve style preferences
    if (limits.style > 0) {
      result.style = await retrieveMemoriesFromPostgres(
        supabaseClient,
        embedding,
        projectId,
        ['style'],
        'user',
        ownerId,
        null,
        limits.style,
        logPrefix
      );
    }

    // Retrieve preference memories
    if (limits.preferences > 0) {
      result.preferences = await retrieveMemoriesFromPostgres(
        supabaseClient,
        embedding,
        projectId,
        ['preference'],
        'user',
        ownerId,
        null,
        limits.preferences,
        logPrefix
      );
    }

    // Retrieve session memories
    if (conversationId && limits.session > 0) {
      result.session = await retrieveMemoriesFromPostgres(
        supabaseClient,
        embedding,
        projectId,
        ['session'],
        'conversation',
        ownerId,
        conversationId,
        limits.session,
        logPrefix
      );
    }
  } else {
    console.log(`${logPrefix} No owner ID, skipping user/conversation-scoped memories (Postgres fallback)`);
  }

  return result;
}

// =============================================================================
// Memory Context Retrieval
// =============================================================================

/**
 * Retrieve memory context from Qdrant for the given project/user/conversation.
 * Falls back to Postgres when Qdrant is unavailable.
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
 * @param supabaseClient - Optional Supabase client for Postgres fallback
 */
export async function retrieveMemoryContext(
  query: string,
  projectId: string,
  ownerId: string | null,
  conversationId?: string,
  limits: RetrievalLimits = DEFAULT_SAGA_LIMITS,
  logPrefix: string = "[memory]",
  // deno-lint-ignore no-explicit-any
  supabaseClient?: SupabaseClient<any, any, any>
): Promise<RetrievedMemoryContext> {
  const result: RetrievedMemoryContext = {
    decisions: [],
    style: [],
    preferences: [],
    session: [],
  };

  // If Qdrant is not configured, try Postgres fallback first
  if (!isQdrantConfigured()) {
    console.log(`${logPrefix} Qdrant not configured, trying Postgres fallback`);
    if (supabaseClient) {
      return await retrieveMemoryContextFromPostgres(
        supabaseClient,
        query,
        projectId,
        ownerId,
        conversationId,
        limits,
        logPrefix
      );
    }
    console.log(`${logPrefix} No Supabase client provided, memory context unavailable`);
    return result;
  }

  try {
    // Retrieve project-scoped decisions (shared canon) - visible to all with project access
    if (limits.decisions > 0) {
      const decisionFilter = buildDecisionFilter(projectId);

      // If we have a query, do semantic search; otherwise scroll recent
      if (query && isDeepInfraConfigured()) {
        const embedding = await generateEmbedding(query);
        const decisions = await searchPoints(embedding, limits.decisions * 2, decisionFilter);
        result.decisions = filterVisible(
          decisions.map((p) => parseMemoryFromPayload(String(p.id), p.payload, p.score))
        ).slice(0, limits.decisions);
      } else {
        const decisions = await scrollPoints(decisionFilter, limits.decisions * 2);
        result.decisions = filterVisible(
          decisions.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.decisions);
      }
    }

    // Only retrieve user-scoped memories if we have a valid owner ID
    // This enforces proper isolation - anonymous users without device ID cannot see user-scoped memories
    if (ownerId && ownerId.length > 0) {
      // Retrieve style preferences (user scope)
      if (limits.style > 0) {
        const styleFilter = buildStyleFilter(projectId, ownerId);
        const styleResults = await scrollPoints(styleFilter, limits.style * 2);
        result.style = filterVisible(
          styleResults.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.style);
      }

      // Retrieve preference memories (user scope)
      if (limits.preferences > 0) {
        const prefFilter = buildPreferenceFilter(projectId, ownerId);
        const prefResults = await scrollPoints(prefFilter, limits.preferences * 2);
        result.preferences = filterVisible(
          prefResults.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.preferences);
      }

      // Retrieve session memories - MUST include all isolation fields
      // Filter: (projectId, ownerId, conversationId, category=session, scope=conversation)
      if (conversationId && limits.session > 0) {
        const sessionFilter = buildSessionFilter(projectId, ownerId, conversationId);
        const sessionResults = await scrollPoints(sessionFilter, limits.session * 2);
        result.session = filterVisible(
          sessionResults.map((p) => parseMemoryFromPayload(p.id, p.payload))
        ).slice(0, limits.session);
      }
    } else {
      console.log(`${logPrefix} No owner ID, skipping user/conversation-scoped memories`);
    }
  } catch (error) {
    // On Qdrant failure, try Postgres fallback
    if (error instanceof QdrantError) {
      console.warn(`${logPrefix} Qdrant error, trying Postgres fallback: ${error.message}`);
    } else {
      console.error(`${logPrefix} Memory retrieval error, trying Postgres fallback:`, error);
    }

    // Attempt Postgres fallback if client is available
    if (supabaseClient) {
      return await retrieveMemoryContextFromPostgres(
        supabaseClient,
        query,
        projectId,
        ownerId,
        conversationId,
        limits,
        logPrefix
      );
    }
    console.warn(`${logPrefix} No Supabase client provided, memory context unavailable`);
  }

  return result;
}

// =============================================================================
// Profile Context Retrieval
// =============================================================================

/**
 * Retrieve profile context from user preferences in Supabase.
 *
 * @param supabase - Supabase client instance
 * @param userId - The user ID (null returns undefined)
 * @param logPrefix - Prefix for error logging
 */
export async function retrieveProfileContext(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
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
