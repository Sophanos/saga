/**
 * Vector Payload Utilities
 *
 * Unified parsing/formatting of Qdrant payload fields.
 * Handles legacy key differences (project_id vs projectId, text vs content_preview).
 * Ensures consistent behavior across ai-chat, ai-saga, and memory endpoints.
 */

/**
 * Canonical vector payload types (v2 schema).
 * All new vectors should use these field names.
 */
export type VectorPayloadType = "document" | "entity" | "memory";

/**
 * Base payload fields common to all vector types.
 */
interface BasePayload {
  type: VectorPayloadType;
  project_id: string;
  text: string;
  preview?: string;
  updated_at?: string;
}

/**
 * Document vector payload.
 */
export interface DocumentPayload extends BasePayload {
  type: "document";
  document_id: string;
  title?: string;
}

/**
 * Entity vector payload.
 */
export interface EntityPayload extends BasePayload {
  type: "entity";
  entity_id: string;
  entity_type: string;
  title: string;
}

/**
 * Memory vector payload (MLP 1.5).
 */
export interface MemoryPayload extends BasePayload {
  type: "memory";
  memory_id: string;
  category: string;
  scope: string;
  owner_id?: string;
  conversation_id?: string;
  source?: string;
  confidence?: number;
  entity_ids?: string[];
  document_id?: string;
  tool_call_id?: string;
  tool_name?: string;
  created_at: string;
  created_at_ts: number; // Unix ms for range queries
  expires_at?: string;
}

/**
 * Union of all payload types.
 */
export type VectorPayload = DocumentPayload | EntityPayload | MemoryPayload;

// =============================================================================
// Legacy Key Mappings
// =============================================================================

/**
 * Legacy key alternatives for project_id.
 */
const PROJECT_ID_KEYS = ["project_id", "projectId"] as const;

/**
 * Legacy key alternatives for text content.
 */
const TEXT_KEYS = ["text", "content", "content_preview"] as const;

/**
 * Legacy key alternatives for preview.
 */
const PREVIEW_KEYS = ["preview", "content_preview", "text"] as const;

/**
 * Legacy key alternatives for title.
 */
const TITLE_KEYS = ["title", "name"] as const;

// =============================================================================
// Payload Parsing Functions
// =============================================================================

/**
 * Get project ID from payload, supporting legacy keys.
 * Returns null if not found.
 */
export function getProjectId(payload: Record<string, unknown>): string | null {
  for (const key of PROJECT_ID_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

/**
 * Get text content from payload, supporting legacy keys.
 * Returns empty string if not found.
 */
export function getPayloadText(payload: Record<string, unknown>): string {
  for (const key of TEXT_KEYS) {
    const value = payload[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

/**
 * Get preview text from payload, supporting legacy keys.
 * Falls back to truncated text content.
 */
export function getPayloadPreview(
  payload: Record<string, unknown>,
  maxLength = 200
): string {
  // Try dedicated preview keys first
  for (const key of PREVIEW_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value.slice(0, maxLength);
    }
  }
  // Fall back to text
  const text = getPayloadText(payload);
  return text.slice(0, maxLength);
}

/**
 * Get title from payload, supporting legacy keys.
 * Returns "Untitled" if not found.
 */
export function getPayloadTitle(payload: Record<string, unknown>): string {
  for (const key of TITLE_KEYS) {
    const value = payload[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "Untitled";
}

/**
 * Get payload type.
 * Returns null if not a recognized type.
 */
export function getPayloadType(
  payload: Record<string, unknown>
): VectorPayloadType | null {
  const type = payload["type"];
  if (type === "document" || type === "entity" || type === "memory") {
    return type;
  }
  return null;
}

/**
 * Get entity type from payload (for entity vectors).
 */
export function getEntityType(payload: Record<string, unknown>): string | null {
  const entityType = payload["entity_type"] ?? payload["entityType"];
  return typeof entityType === "string" ? entityType : null;
}

/**
 * Get memory category from payload (for memory vectors).
 */
export function getMemoryCategory(payload: Record<string, unknown>): string | null {
  const category = payload["category"];
  return typeof category === "string" ? category : null;
}

/**
 * Get memory scope from payload (for memory vectors).
 */
export function getMemoryScope(payload: Record<string, unknown>): string | null {
  const scope = payload["scope"];
  return typeof scope === "string" ? scope : null;
}

// =============================================================================
// Payload Building Functions
// =============================================================================

/**
 * Build a document payload with canonical keys.
 */
export function buildDocumentPayload(params: {
  projectId: string;
  documentId: string;
  title?: string;
  text: string;
  preview?: string;
}): DocumentPayload {
  return {
    type: "document",
    project_id: params.projectId,
    document_id: params.documentId,
    title: params.title,
    text: params.text,
    preview: params.preview ?? params.text.slice(0, 200),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Build an entity payload with canonical keys.
 */
export function buildEntityPayload(params: {
  projectId: string;
  entityId: string;
  entityType: string;
  title: string;
  text: string;
  preview?: string;
}): EntityPayload {
  return {
    type: "entity",
    project_id: params.projectId,
    entity_id: params.entityId,
    entity_type: params.entityType,
    title: params.title,
    text: params.text,
    preview: params.preview ?? params.text.slice(0, 200),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Build a memory payload with canonical keys.
 */
export function buildMemoryPayload(params: {
  projectId: string;
  memoryId: string;
  category: string;
  scope: string;
  text: string;
  ownerId?: string;
  conversationId?: string;
  source?: string;
  confidence?: number;
  entityIds?: string[];
  documentId?: string;
  toolCallId?: string;
  toolName?: string;
  expiresAt?: string;
}): MemoryPayload {
  const now = new Date();
  return {
    type: "memory",
    project_id: params.projectId,
    memory_id: params.memoryId,
    category: params.category,
    scope: params.scope,
    text: params.text,
    preview: params.text.slice(0, 200),
    owner_id: params.ownerId,
    conversation_id: params.conversationId,
    source: params.source,
    confidence: params.confidence,
    entity_ids: params.entityIds,
    document_id: params.documentId,
    tool_call_id: params.toolCallId,
    tool_name: params.toolName,
    created_at: now.toISOString(),
    created_at_ts: now.getTime(),
    updated_at: now.toISOString(),
    expires_at: params.expiresAt,
  };
}
