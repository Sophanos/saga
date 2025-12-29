/**
 * @mythos/agent-protocol - Memory System (MLP 1.5)
 *
 * Writer Memory Layer types for persistence and retrieval.
 */

import type { ToolName } from "./tools";

// =============================================================================
// Memory System Types
// =============================================================================

/**
 * Memory categories for the Writer Memory Layer.
 * Maps to different scopes and retention policies.
 */
export type MemoryCategory = "style" | "decision" | "preference" | "session";

/**
 * Memory scope determines visibility and collaboration rules.
 * - project: Shared canon decisions (visible to all collaborators)
 * - user: Personal preferences and style (private to user)
 * - conversation: Short-lived session continuity (ephemeral)
 */
export type MemoryScope = "project" | "user" | "conversation";

/**
 * Source of a memory entry.
 */
export type MemorySource = "user" | "ai" | "system";

/**
 * Metadata attached to a memory record.
 */
export interface MemoryMetadata {
  /** How the memory was created */
  source?: MemorySource;
  /** Confidence score (0-1) for AI-derived memories */
  confidence?: number;
  /** Related entity IDs */
  entityIds?: string[];
  /** Source document ID */
  documentId?: string;
  /** Conversation this memory belongs to */
  conversationId?: string;
  /** Tool call that generated this memory */
  toolCallId?: string;
  /** Tool name that generated this memory */
  toolName?: ToolName;
  /** Expiration timestamp (ISO) for session memories */
  expiresAt?: string;
}

/**
 * A memory record in the Writer Memory Layer.
 * Stored in Qdrant with embeddings for semantic retrieval.
 */
export interface MemoryRecord {
  /** Unique identifier (also Qdrant point ID) */
  id: string;
  /** Project this memory belongs to */
  projectId: string;
  /** Category determines behavior and scope */
  category: MemoryCategory;
  /** Visibility scope */
  scope: MemoryScope;
  /** Owner ID (userId or deviceId for user/conversation scope) */
  ownerId?: string;
  /** Memory content */
  content: string;
  /** Additional metadata */
  metadata?: MemoryMetadata;
  /** Creation timestamp (ISO) */
  createdAt: string;
  /** Last update timestamp (ISO) */
  updatedAt?: string;
  /** Similarity score from retrieval (0-1) */
  score?: number;
}

/**
 * Grouped memory context for prompt injection.
 * Organized by category for structured insertion.
 */
export interface MemoryContext {
  /** Canon decisions that should never be contradicted */
  decisions: MemoryRecord[];
  /** Writer style preferences to match */
  style: MemoryRecord[];
  /** Accept/reject patterns from past interactions */
  preferences: MemoryRecord[];
  /** Current session continuity */
  session: MemoryRecord[];
}

/**
 * Get default scope for a memory category.
 * - decision → project (shared canon)
 * - style → user (personal writing style)
 * - preference → user (personal accept/reject patterns)
 * - session → conversation (short-lived continuity)
 */
export function getDefaultMemoryScope(category: MemoryCategory): MemoryScope {
  switch (category) {
    case "decision":
      return "project";
    case "session":
      return "conversation";
    default:
      return "user";
  }
}

// =============================================================================
// Memory API Request/Response Types
// =============================================================================

/**
 * Request to write a memory.
 */
export interface MemoryWriteRequest {
  projectId: string;
  category: MemoryCategory;
  content: string;
  scope?: MemoryScope;
  conversationId?: string;
  metadata?: Omit<MemoryMetadata, "conversationId">;
  /** Optional deterministic ID for upsert */
  id?: string;
}

/**
 * Response from memory write.
 */
export interface MemoryWriteResponse {
  memory: MemoryRecord;
}

/**
 * Request to read memories.
 */
export interface MemoryReadRequest {
  projectId: string;
  /** Semantic search query (optional) */
  query?: string;
  /** Filter by categories */
  categories?: MemoryCategory[];
  /** Filter by scope */
  scope?: MemoryScope;
  /** Required for conversation scope */
  conversationId?: string;
  /** Max results (default 20) */
  limit?: number;
  /** Blend factor for recency (0-1, default 0.2) */
  recencyWeight?: number;
}

/**
 * Response from memory read.
 */
export interface MemoryReadResponse {
  memories: MemoryRecord[];
}

/**
 * Request to delete memories.
 */
export interface MemoryDeleteRequest {
  projectId: string;
  /** Specific memory IDs to delete */
  memoryIds?: string[];
  /** Delete by category */
  category?: MemoryCategory;
  /** Delete by scope */
  scope?: MemoryScope;
  /** Required when deleting conversation scope */
  conversationId?: string;
  /** Delete memories older than this (ISO timestamp) */
  olderThan?: string;
}

/**
 * Response from memory delete.
 */
export interface MemoryDeleteResponse {
  deletedCount: number;
}

/**
 * Request to learn writing style from content.
 */
export interface LearnStyleRequest {
  projectId: string;
  documentId: string;
  content: string;
  maxFindings?: number;
}

/**
 * Response from style learning.
 */
export interface LearnStyleResponse {
  learned: Array<{ id: string; content: string }>;
}
