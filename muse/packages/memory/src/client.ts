/**
 * @mythos/memory - Memory Client
 *
 * Client for interacting with memory system.
 * Supports both Convex (recommended) and legacy HTTP endpoints.
 */

import type {
  MemoryRecord,
  MemoryWriteRequest,
  MemoryWriteResponse,
  MemoryReadRequest,
  MemoryReadResponse,
  MemoryDeleteRequest,
  MemoryDeleteResponse,
  LearnStyleRequest,
  LearnStyleResponse,
  MemoryWriteBatchRequest,
  MemoryWriteBatchResponse,
  MemoryCategory,
} from "./types";

// =============================================================================
// Error Types
// =============================================================================

export class MemoryApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "MemoryApiError";
  }
}

// =============================================================================
// Client Interface
// =============================================================================

export interface MemoryClient {
  write(
    req: MemoryWriteRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<MemoryRecord>;

  writeBatch(
    req: MemoryWriteBatchRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<MemoryRecord[]>;

  read(
    req: MemoryReadRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<MemoryRecord[]>;

  delete(
    req: MemoryDeleteRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<number>;

  learnStyle(
    req: LearnStyleRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<Array<{ id: string; content: string }>>;
}

// =============================================================================
// Convex Memory Client (Recommended)
// =============================================================================

/**
 * Convex memory API adapter interface.
 * Implement this with your Convex client to use the memory system.
 */
export interface ConvexMemoryAdapter {
  create(args: {
    projectId: string;
    text: string;
    type: string;
    confidence?: number;
    source?: string;
    entityIds?: string[];
    documentId?: string;
    pinned?: boolean;
    expiresAt?: number;
  }): Promise<string>;

  list(args: {
    projectId: string;
    type?: string;
    limit?: number;
    pinnedOnly?: boolean;
  }): Promise<ConvexMemory[]>;

  search(args: {
    projectId: string;
    searchQuery: string;
    limit?: number;
  }): Promise<ConvexMemory[]>;

  remove(args: { id: string }): Promise<string>;
}

interface ConvexMemory {
  _id: string;
  projectId: string;
  userId?: string;
  text: string;
  type: string;
  confidence: number;
  source: string;
  entityIds?: string[];
  documentId?: string;
  pinned: boolean;
  expiresAt?: number;
  vectorId?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Map Convex memory category to agent-protocol category.
 */
function mapCategory(type: string): MemoryCategory {
  const map: Record<string, MemoryCategory> = {
    decision: "decision",
    fact: "decision",
    preference: "preference",
    style: "style",
    session: "session",
    context: "session",
  };
  return map[type] ?? "decision";
}

/**
 * Convert Convex memory to MemoryRecord.
 */
function toMemoryRecord(mem: ConvexMemory): MemoryRecord {
  return {
    id: mem._id,
    projectId: mem.projectId,
    category: mapCategory(mem.type),
    scope: mem.type === "session" ? "conversation" : "project",
    ownerId: mem.userId,
    content: mem.text,
    metadata: {
      source: mem.source as "user" | "ai" | "system",
      confidence: mem.confidence,
      entityIds: mem.entityIds,
      documentId: mem.documentId,
      pinned: mem.pinned,
      expiresAt: mem.expiresAt ? new Date(mem.expiresAt).toISOString() : undefined,
    },
    createdAt: new Date(mem.createdAt).toISOString(),
    updatedAt: new Date(mem.updatedAt).toISOString(),
  };
}

/**
 * Create a memory client backed by Convex.
 */
export function createConvexMemoryClient(adapter: ConvexMemoryAdapter): MemoryClient {
  return {
    async write(req) {
      const id = await adapter.create({
        projectId: req.projectId,
        text: req.content,
        type: req.category,
        confidence: req.metadata?.confidence,
        source: req.metadata?.source,
        entityIds: req.metadata?.entityIds,
        documentId: req.metadata?.documentId,
        pinned: req.metadata?.pinned,
        expiresAt: req.metadata?.expiresAt
          ? new Date(req.metadata.expiresAt).getTime()
          : undefined,
      });

      return {
        id,
        projectId: req.projectId,
        category: req.category,
        scope: req.scope ?? "project",
        content: req.content,
        metadata: req.metadata,
        createdAt: new Date().toISOString(),
      };
    },

    async writeBatch(req) {
      const results: MemoryRecord[] = [];
      for (const item of req.memories) {
        const id = await adapter.create({
          projectId: req.projectId,
          text: item.content,
          type: item.category,
          confidence: item.metadata?.confidence,
          source: item.metadata?.source,
          entityIds: item.metadata?.entityIds,
          documentId: item.metadata?.documentId,
          pinned: item.metadata?.pinned,
          expiresAt: item.metadata?.expiresAt
            ? new Date(item.metadata.expiresAt).getTime()
            : undefined,
        });

        results.push({
          id,
          projectId: req.projectId,
          category: item.category,
          scope: item.scope ?? "project",
          content: item.content,
          metadata: item.metadata,
          createdAt: new Date().toISOString(),
        });
      }
      return results;
    },

    async read(req) {
      let memories: ConvexMemory[];

      if (req.query) {
        memories = await adapter.search({
          projectId: req.projectId,
          searchQuery: req.query,
          limit: req.limit,
        });
      } else {
        memories = await adapter.list({
          projectId: req.projectId,
          type: req.categories?.[0],
          limit: req.limit,
          pinnedOnly: req.pinnedOnly,
        });
      }

      return memories.map(toMemoryRecord);
    },

    async delete(req) {
      if (req.memoryIds?.length) {
        for (const id of req.memoryIds) {
          await adapter.remove({ id });
        }
        return req.memoryIds.length;
      }
      return 0;
    },

    async learnStyle() {
      // Style learning is handled server-side
      // This client method is a no-op for Convex
      return [];
    },
  };
}

// =============================================================================
// Legacy HTTP Client (Deprecated)
// =============================================================================

/**
 * @deprecated Use createConvexMemoryClient instead.
 * Legacy HTTP client configuration for Supabase edge functions.
 */
export interface LegacyMemoryClientConfig {
  supabaseUrl: string;
  getAuthHeaders?: () => Promise<Record<string, string>>;
}

const DEFAULT_TIMEOUT_MS = 30000;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error("Request failed");
}

async function makeRequest<T>(
  config: LegacyMemoryClientConfig,
  endpoint: string,
  body: unknown,
  opts?: { signal?: AbortSignal }
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.getAuthHeaders) {
    const authHeaders = await config.getAuthHeaders();
    Object.assign(headers, authHeaders);
  }

  const url = `${config.supabaseUrl}/functions/v1/${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  if (opts?.signal) {
    opts.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new MemoryApiError(
        errorData.message ?? `Request failed with status ${response.status}`,
        response.status,
        errorData.code
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof MemoryApiError) {
      throw error;
    }
    throw new MemoryApiError(
      error instanceof Error ? error.message : "Unknown error",
      undefined,
      "NETWORK_ERROR"
    );
  }
}

/**
 * @deprecated Use createConvexMemoryClient instead.
 * Create a legacy memory client that calls Supabase HTTP endpoints.
 */
export function createMemoryClient(config: LegacyMemoryClientConfig): MemoryClient {
  console.warn(
    "[memory] createMemoryClient is deprecated. Use createConvexMemoryClient instead."
  );

  return {
    async write(req, opts) {
      const response = await makeRequest<MemoryWriteResponse>(
        config,
        "ai-memory-write",
        req,
        opts
      );
      return response.memory;
    },

    async writeBatch(req, opts) {
      const response = await makeRequest<MemoryWriteBatchResponse>(
        config,
        "ai-memory-write",
        req,
        opts
      );
      return response.memories;
    },

    async read(req, opts) {
      const response = await makeRequest<MemoryReadResponse>(
        config,
        "ai-memory-read",
        req,
        opts
      );
      return response.memories;
    },

    async delete(req, opts) {
      const response = await makeRequest<MemoryDeleteResponse>(
        config,
        "ai-memory-delete",
        req,
        opts
      );
      return response.deletedCount;
    },

    async learnStyle(req, opts) {
      const response = await makeRequest<LearnStyleResponse>(
        config,
        "ai-learn-style",
        req,
        opts
      );
      return response.learned;
    },
  };
}
