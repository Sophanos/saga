/**
 * Sync types
 * Types for offline sync and collaboration
 */

/**
 * Tables that can be synced
 */
export type SyncTable = "documents" | "entities" | "relationships" | "mentions" | "analysis" | "captures";

/**
 * Mutation type
 */
export type MutationType = "upsert" | "delete";

/**
 * A mutation represents a local change that needs to be synced
 */
export interface Mutation {
  id: string;
  table: SyncTable;
  type: MutationType;
  row?: Record<string, unknown>;
  pk?: string;
  baseVersion?: number;
  createdAt: string;
  projectId: string;
}

/**
 * AI request types that can be queued
 */
export type AiRequestType = "lint" | "coach" | "detect" | "dynamics";

/**
 * A queued AI request to be processed when online
 */
export interface QueuedAiRequest {
  id: string;
  type: AiRequestType;
  projectId: string;
  documentId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  priority?: number;
  retryCount?: number;
}

/**
 * Sync event from the server
 */
export interface SyncEvent {
  id: string;
  table: SyncTable;
  type: MutationType;
  row: Record<string, unknown>;
  version: number;
  userId: string;
  timestamp: string;
}

/**
 * Project snapshot for initial sync
 */
export interface ProjectSnapshot {
  projectId: string;
  version: number;
  documents: Record<string, unknown>[];
  entities: Record<string, unknown>[];
  relationships: Record<string, unknown>[];
  mentions: Record<string, unknown>[];
  analysis?: Record<string, unknown>[];
  captures?: Record<string, unknown>[];
  syncedAt: string;
}

/**
 * Sync result from a sync operation
 */
export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: ConflictResolution[];
  errors: SyncError[];
  syncedAt: string;
}

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = "server_wins" | "client_wins" | "merge" | "manual";

/**
 * A conflict between local and remote changes
 */
export interface ConflictResolution {
  mutationId: string;
  table: SyncTable;
  pk: string;
  strategy: ConflictStrategy;
  localValue?: Record<string, unknown>;
  serverValue?: Record<string, unknown>;
  resolvedValue?: Record<string, unknown>;
}

/**
 * Sync error
 */
export interface SyncError {
  mutationId?: string;
  table?: SyncTable;
  message: string;
  code?: string;
  retryable: boolean;
}

/**
 * Local database adapter interface
 * Implementations for web (Dexie/IndexedDB) and native (expo-sqlite)
 */
export interface LocalDbAdapter {
  /**
   * Initialize the database with schema
   */
  initialize(): Promise<void>;

  /**
   * Bootstrap a project with initial data from server
   */
  bootstrapProject(projectId: string, snapshot: ProjectSnapshot): Promise<void>;

  /**
   * Apply activity events from real-time sync
   */
  applyActivity(events: SyncEvent[]): Promise<void>;

  /**
   * Enqueue a mutation for later sync
   */
  enqueueMutation(mutation: Mutation): Promise<void>;

  /**
   * Get pending mutations to sync
   */
  peekMutations(limit: number): Promise<Mutation[]>;

  /**
   * Mark a mutation as synced and remove from queue
   */
  markMutationDone(id: string): Promise<void>;

  /**
   * Mark a mutation as failed
   */
  markMutationFailed(id: string, error: string): Promise<void>;

  /**
   * Get count of pending mutations
   */
  getPendingMutationsCount(): Promise<number>;

  /**
   * Enqueue an AI request for later processing
   */
  enqueueAiRequest(request: QueuedAiRequest): Promise<void>;

  /**
   * Get pending AI requests
   */
  peekAiRequests(limit: number): Promise<QueuedAiRequest[]>;

  /**
   * Mark an AI request as done
   */
  markAiRequestDone(id: string): Promise<void>;

  /**
   * Get count of pending AI requests
   */
  getPendingAiRequestsCount(): Promise<number>;

  /**
   * Get a document by ID
   */
  getDocument(id: string): Promise<Record<string, unknown> | null>;

  /**
   * Get all documents for a project
   */
  getDocuments(projectId: string): Promise<Record<string, unknown>[]>;

  /**
   * Upsert a document locally
   */
  upsertDocument(doc: Record<string, unknown>): Promise<void>;

  /**
   * Delete a document locally
   */
  deleteDocument(id: string): Promise<void>;

  /**
   * Get an entity by ID
   */
  getEntity(id: string): Promise<Record<string, unknown> | null>;

  /**
   * Get all entities for a project
   */
  getEntities(projectId: string): Promise<Record<string, unknown>[]>;

  /**
   * Upsert an entity locally
   */
  upsertEntity(entity: Record<string, unknown>): Promise<void>;

  /**
   * Delete an entity locally
   */
  deleteEntity(id: string): Promise<void>;

  /**
   * Get relationships for a project
   */
  getRelationships(projectId: string): Promise<Record<string, unknown>[]>;

  /**
   * Upsert a relationship locally
   */
  upsertRelationship(rel: Record<string, unknown>): Promise<void>;

  /**
   * Delete a relationship locally
   */
  deleteRelationship(id: string): Promise<void>;

  /**
   * Get a capture by ID
   */
  getCapture(id: string): Promise<Record<string, unknown> | null>;

  /**
   * Get all captures for a project
   */
  getCaptures(projectId: string): Promise<Record<string, unknown>[]>;

  /**
   * Upsert a capture locally
   */
  upsertCapture(capture: Record<string, unknown>): Promise<void>;

  /**
   * Delete a capture locally
   */
  deleteCapture(id: string): Promise<void>;

  /**
   * Get the last sync version for a project
   */
  getLastSyncVersion(projectId: string): Promise<number>;

  /**
   * Set the last sync version for a project
   */
  setLastSyncVersion(projectId: string, version: number): Promise<void>;

  /**
   * Clear all data for a project
   */
  clearProject(projectId: string): Promise<void>;

  /**
   * Clear all local data
   */
  clearAll(): Promise<void>;

  // ==========================================================================
  // Optional Memory Methods (MLP 1.5)
  // These are optional to avoid breaking mobile until implemented
  // ==========================================================================

  /**
   * Get a memory by ID
   */
  getMemory?(id: string): Promise<Record<string, unknown> | null>;

  /**
   * Get all memories for a project
   */
  getMemories?(projectId: string): Promise<Record<string, unknown>[]>;

  /**
   * Get memories for a project by category
   */
  getMemoriesByCategory?(projectId: string, category: string): Promise<Record<string, unknown>[]>;

  /**
   * Upsert a memory locally (for caching)
   */
  upsertMemory?(memory: Record<string, unknown>): Promise<void>;

  /**
   * Delete a memory locally
   */
  deleteMemory?(id: string): Promise<void>;

  /**
   * Clear all memories for a project
   */
  clearMemories?(projectId: string): Promise<void>;
}

/**
 * Document channel for real-time collaboration on a document
 */
export interface DocumentChannel {
  /**
   * Send cursor position update
   */
  sendCursor(position: { from: number; to: number }): void;

  /**
   * Send text operation (for CRDT)
   */
  sendOperation(operation: unknown): void;

  /**
   * Subscribe to remote cursor updates
   */
  onCursor(callback: (userId: string, position: { from: number; to: number }) => void): () => void;

  /**
   * Subscribe to remote operations
   */
  onOperation(callback: (userId: string, operation: unknown) => void): () => void;

  /**
   * Disconnect from the channel
   */
  disconnect(): void;
}
