/**
 * @mythos/memory - Memory Client
 *
 * Client for interacting with memory edge functions.
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
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

export interface MemoryClientConfig {
  /** Supabase URL */
  supabaseUrl: string;
  /** Function to get auth headers (Authorization + x-openrouter-key) */
  getAuthHeaders?: () => Promise<Record<string, string>>;
}

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
  /** Write or upsert a memory */
  write(
    req: MemoryWriteRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<MemoryRecord>;

  /** Read memories by query or filter */
  read(
    req: MemoryReadRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<MemoryRecord[]>;

  /** Delete memories by IDs or filter */
  delete(
    req: MemoryDeleteRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<number>;

  /** Learn writing style from content */
  learnStyle(
    req: LearnStyleRequest,
    opts?: { signal?: AbortSignal }
  ): Promise<Array<{ id: string; content: string }>>;
}

// =============================================================================
// Implementation
// =============================================================================

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
  config: MemoryClientConfig,
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

  // Combine with user-provided signal
  if (opts?.signal) {
    opts.signal.addEventListener("abort", () => controller.abort());
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
 * Create a memory client instance.
 */
export function createMemoryClient(config: MemoryClientConfig): MemoryClient {
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
