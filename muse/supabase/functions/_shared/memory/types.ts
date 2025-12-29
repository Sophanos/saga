/**
 * Shared memory types for edge functions.
 * Canonical definitions to avoid duplication across ai-memory-* functions.
 */

// Memory categories
export type MemoryCategory = "style" | "decision" | "preference" | "session";

// Memory scopes
export type MemoryScope = "project" | "user" | "conversation";

// Valid values for runtime validation
export const VALID_CATEGORIES: MemoryCategory[] = ["style", "decision", "preference", "session"];
export const VALID_SCOPES: MemoryScope[] = ["project", "user", "conversation"];

// Type guards
export function isValidCategory(value: unknown): value is MemoryCategory {
  return typeof value === "string" && VALID_CATEGORIES.includes(value as MemoryCategory);
}

export function isValidScope(value: unknown): value is MemoryScope {
  return typeof value === "string" && VALID_SCOPES.includes(value as MemoryScope);
}

// Get default scope for a category
export function getDefaultScope(category: MemoryCategory): MemoryScope {
  switch (category) {
    case "decision":
      return "project";
    case "session":
      return "conversation";
    default:
      return "user";
  }
}

// Memory record interface
export interface MemoryRecord {
  id: string;
  projectId: string;
  ownerId?: string;
  category: MemoryCategory;
  scope: MemoryScope;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  conversationId?: string;
}

// Request/Response types
export interface MemoryWriteRequest {
  projectId: string;
  category: MemoryCategory;
  content: string;
  scope?: MemoryScope;
  conversationId?: string;
  metadata?: Record<string, unknown>;
  ttlMinutes?: number;
}

export interface MemoryReadRequest {
  projectId: string;
  query?: string;
  categories?: MemoryCategory[];
  scope?: MemoryScope;
  conversationId?: string;
  limit?: number;
  includeExpired?: boolean;
}

export interface MemoryDeleteRequest {
  projectId: string;
  memoryIds?: string[];
  categories?: MemoryCategory[];
  scope?: MemoryScope;
  conversationId?: string;
  olderThanDays?: number;
}

// Memory context for AI prompts (string arrays for simple injection)
export interface MemoryContext {
  decisions: string[];
  styleRules: string[];
  preferences: string[];
  sessionContext: string[];
}

// Profile context for AI prompts
export interface ProfileContext {
  preferredGenre?: string;
  namingCulture?: string;
  namingStyle?: string;
  logicStrictness?: string;
}

// =============================================================================
// Retrieval Types (for retrieveMemoryContext/retrieveProfileContext)
// =============================================================================

/**
 * A retrieved memory record with optional score from semantic search
 */
export interface RetrievedMemoryRecord {
  id: string;
  content: string;
  category: string;
  score?: number;
}

/**
 * Retrieved memory context organized by category
 */
export interface RetrievedMemoryContext {
  decisions: RetrievedMemoryRecord[];
  style: RetrievedMemoryRecord[];
  preferences: RetrievedMemoryRecord[];
  session: RetrievedMemoryRecord[];
}

/**
 * Configurable limits for memory retrieval
 */
export interface RetrievalLimits {
  decisions: number;
  style: number;
  preferences: number;
  session: number;
}
