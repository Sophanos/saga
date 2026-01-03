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

type MemoryCategoryKey = "decisions" | "style" | "preferences" | "session";

export interface MemoryRetrievalControls {
  recencyWeight?: number;
  maxAgeDays?: Partial<Record<MemoryCategoryKey, number>>;
}

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

    const createdAtTs = getCreatedAtTs(m);
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

function getCreatedAtTs(memory: RetrievedMemoryRecord): number {
  if (typeof memory.createdAtTs === "number") {
    return memory.createdAtTs;
  }
  if (memory.createdAt) {
    return new Date(memory.createdAt).getTime();
  }
  return 0;
}

function maxAgeMsForCategory(
  category: MemoryCategoryKey,
  controls?: MemoryRetrievalControls
): number | undefined {
  const maxAgeDays = controls?.maxAgeDays?.[category];
  if (typeof maxAgeDays !== "number") {
    return undefined;
  }
  return maxAgeDays * 24 * 60 * 60 * 1000;
}

function sourceRank(source?: string): number {
  if (source === "user") return 0;
  if (source === "ai") return 1;
  return 2;
}

function scoreWithRecency(
  memory: RetrievedMemoryRecord,
  nowMs: number,
  recencyWeight?: number
): number {
  const similarityScore = memory.score ?? 0;
  if (recencyWeight === undefined) {
    return similarityScore;
  }

  const createdAtTs = getCreatedAtTs(memory);
  const ageMs = createdAtTs > 0 ? nowMs - createdAtTs : Number.POSITIVE_INFINITY;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const recencyScore = Number.isFinite(ageDays) ? 1 / (1 + Math.max(0, ageDays)) : 0;

  return similarityScore * (1 - recencyWeight) + recencyScore * recencyWeight;
}

function sortMemories(
  memories: RetrievedMemoryRecord[],
  options?: { useScore?: boolean; recencyWeight?: number }
): RetrievedMemoryRecord[] {
  const nowMs = Date.now();
  const useScore = options?.useScore === true;
  const recencyWeight = options?.recencyWeight;

  return [...memories].sort((a, b) => {
    const pinnedDiff = Number(b.pinned) - Number(a.pinned);
    if (pinnedDiff !== 0) return pinnedDiff;

    const sourceDiff = sourceRank(a.source) - sourceRank(b.source);
    if (sourceDiff !== 0) return sourceDiff;

    if (useScore) {
      const scoreDiff = scoreWithRecency(b, nowMs, recencyWeight) - scoreWithRecency(a, nowMs, recencyWeight);
      if (scoreDiff !== 0) return scoreDiff;
    }

    return getCreatedAtTs(b) - getCreatedAtTs(a);
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
    createdAtTs: new Date(row.created_at).getTime(),
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
  logPrefix: string,
  maxAgeMs?: number
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
    return filterVisible(memories, { maxAgeMs });
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
  logPrefix: string,
  controls?: MemoryRetrievalControls
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
    const decisionRecords = await retrieveMemoriesFromPostgres(
      supabaseClient,
      embedding,
      projectId,
      ['decision'],
      'project',
      null, // decisions don't require owner filter
      null,
      limits.decisions,
      logPrefix,
      maxAgeMsForCategory("decisions", controls)
    );
    result.decisions = sortMemories(decisionRecords, {
      useScore: true,
      recencyWeight: controls?.recencyWeight,
    }).slice(0, limits.decisions);
  }

  // Only retrieve user-scoped memories if we have a valid owner ID
  if (ownerId && ownerId.length > 0) {
    // Retrieve style preferences
    if (limits.style > 0) {
      const styleRecords = await retrieveMemoriesFromPostgres(
        supabaseClient,
        embedding,
        projectId,
        ['style'],
        'user',
        ownerId,
        null,
        limits.style,
        logPrefix,
        maxAgeMsForCategory("style", controls)
      );
      result.style = sortMemories(styleRecords, {
        useScore: true,
        recencyWeight: controls?.recencyWeight,
      }).slice(0, limits.style);
    }

    // Retrieve preference memories
    if (limits.preferences > 0) {
      const preferenceRecords = await retrieveMemoriesFromPostgres(
        supabaseClient,
        embedding,
        projectId,
        ['preference'],
        'user',
        ownerId,
        null,
        limits.preferences,
        logPrefix,
        maxAgeMsForCategory("preferences", controls)
      );
      result.preferences = sortMemories(preferenceRecords, {
        useScore: true,
        recencyWeight: controls?.recencyWeight,
      }).slice(0, limits.preferences);
    }

    // Retrieve session memories
    if (conversationId && limits.session > 0) {
      const sessionRecords = await retrieveMemoriesFromPostgres(
        supabaseClient,
        embedding,
        projectId,
        ['session'],
        'conversation',
        ownerId,
        conversationId ?? null,
        limits.session,
        logPrefix,
        maxAgeMsForCategory("session", controls)
      );
      result.session = sortMemories(sessionRecords, {
        useScore: true,
        recencyWeight: controls?.recencyWeight,
      }).slice(0, limits.session);
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
  supabaseClient?: SupabaseClient<any, any, any>,
  controls?: MemoryRetrievalControls
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
        logPrefix,
        controls
      );
    }
    console.log(`${logPrefix} No Supabase client provided, memory context unavailable`);
    return result;
  }

  try {
    let embedding: number[] | null = null;
    if (query && isDeepInfraConfigured()) {
      try {
        embedding = await generateEmbedding(query);
      } catch (error) {
        console.warn(`${logPrefix} Failed to generate embedding: ${error}`);
      }
    }

    const useSemantic = Boolean(embedding);
    const sortOptions = { useScore: useSemantic, recencyWeight: controls?.recencyWeight };

    // Retrieve project-scoped decisions (shared canon) - visible to all with project access
    if (limits.decisions > 0) {
      const decisionFilter = buildDecisionFilter(projectId);

      if (useSemantic && embedding) {
        const decisions = await searchPoints(embedding, limits.decisions * 2, decisionFilter);
        const decisionRecords = decisions.map((p) =>
          parseMemoryFromPayload(String(p.id), p.payload, p.score)
        );
        result.decisions = sortMemories(
          filterVisible(decisionRecords, { maxAgeMs: maxAgeMsForCategory("decisions", controls) }),
          sortOptions
        ).slice(0, limits.decisions);
      } else {
        const decisions = await scrollPoints(decisionFilter, limits.decisions * 2, {
          orderBy: { key: "created_at_ts", direction: "desc" },
        });
        const decisionRecords = decisions.map((p) => parseMemoryFromPayload(p.id, p.payload));
        result.decisions = sortMemories(
          filterVisible(decisionRecords, { maxAgeMs: maxAgeMsForCategory("decisions", controls) })
        ).slice(0, limits.decisions);
      }
    }

    // Only retrieve user-scoped memories if we have a valid owner ID
    // This enforces proper isolation - anonymous users without device ID cannot see user-scoped memories
    if (ownerId && ownerId.length > 0) {
      // Retrieve style preferences (user scope)
      if (limits.style > 0) {
        const styleFilter = buildStyleFilter(projectId, ownerId);
        if (useSemantic && embedding) {
          const styleResults = await searchPoints(embedding, limits.style * 2, styleFilter);
          const styleRecords = styleResults.map((p) =>
            parseMemoryFromPayload(String(p.id), p.payload, p.score)
          );
          result.style = sortMemories(
            filterVisible(styleRecords, { maxAgeMs: maxAgeMsForCategory("style", controls) }),
            sortOptions
          ).slice(0, limits.style);
        } else {
          const styleResults = await scrollPoints(styleFilter, limits.style * 2, {
            orderBy: { key: "created_at_ts", direction: "desc" },
          });
          const styleRecords = styleResults.map((p) => parseMemoryFromPayload(p.id, p.payload));
          result.style = sortMemories(
            filterVisible(styleRecords, { maxAgeMs: maxAgeMsForCategory("style", controls) })
          ).slice(0, limits.style);
        }
      }

      // Retrieve preference memories (user scope)
      if (limits.preferences > 0) {
        const prefFilter = buildPreferenceFilter(projectId, ownerId);
        if (useSemantic && embedding) {
          const prefResults = await searchPoints(embedding, limits.preferences * 2, prefFilter);
          const prefRecords = prefResults.map((p) =>
            parseMemoryFromPayload(String(p.id), p.payload, p.score)
          );
          result.preferences = sortMemories(
            filterVisible(prefRecords, { maxAgeMs: maxAgeMsForCategory("preferences", controls) }),
            sortOptions
          ).slice(0, limits.preferences);
        } else {
          const prefResults = await scrollPoints(prefFilter, limits.preferences * 2, {
            orderBy: { key: "created_at_ts", direction: "desc" },
          });
          const prefRecords = prefResults.map((p) => parseMemoryFromPayload(p.id, p.payload));
          result.preferences = sortMemories(
            filterVisible(prefRecords, { maxAgeMs: maxAgeMsForCategory("preferences", controls) })
          ).slice(0, limits.preferences);
        }
      }

      // Retrieve session memories - MUST include all isolation fields
      // Filter: (projectId, ownerId, conversationId, category=session, scope=conversation)
      if (conversationId && limits.session > 0) {
        const sessionFilter = buildSessionFilter(projectId, ownerId, conversationId);
        if (useSemantic && embedding) {
          const sessionResults = await searchPoints(embedding, limits.session * 2, sessionFilter);
          const sessionRecords = sessionResults.map((p) =>
            parseMemoryFromPayload(String(p.id), p.payload, p.score)
          );
          result.session = sortMemories(
            filterVisible(sessionRecords, { maxAgeMs: maxAgeMsForCategory("session", controls) }),
            sortOptions
          ).slice(0, limits.session);
        } else {
          const sessionResults = await scrollPoints(sessionFilter, limits.session * 2, {
            orderBy: { key: "created_at_ts", direction: "desc" },
          });
          const sessionRecords = sessionResults.map((p) => parseMemoryFromPayload(p.id, p.payload));
          result.session = sortMemories(
            filterVisible(sessionRecords, { maxAgeMs: maxAgeMsForCategory("session", controls) })
          ).slice(0, limits.session);
        }
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
        logPrefix,
        controls
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
      smartMode: writing.smartMode as ProfileContext["smartMode"] | undefined,
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
