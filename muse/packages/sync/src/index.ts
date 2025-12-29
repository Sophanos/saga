/**
 * @mythos/sync
 * Offline-first sync and real-time collaboration for Mythos
 *
 * This package provides:
 * - SyncEngine: Bidirectional sync between local storage and Supabase
 * - CollaborationClient: Real-time presence and collaboration features
 * - LocalDbAdapter: Interface for platform-specific local storage
 *
 * Platform-specific adapters:
 * - Web: import { createDexieAdapter } from "@mythos/sync/web"
 * - Native: import { createSqliteAdapter } from "@mythos/sync/native"
 */

// Types
export type {
  SyncTable,
  MutationType,
  Mutation,
  AiRequestType,
  QueuedAiRequest,
  SyncEvent,
  ProjectSnapshot,
  SyncResult,
  ConflictStrategy,
  ConflictResolution,
  SyncError,
  LocalDbAdapter,
  DocumentChannel,
} from "./types";

// Sync Engine
export { SyncEngine } from "./syncEngine";
export type { SyncEngineConfig } from "./syncEngine";

// Collaboration Client
export { CollaborationClient } from "./collaborationClient";

// Platform-specific adapters (re-exported for convenience)
// Users should prefer direct imports for better tree-shaking:
// import { createDexieAdapter } from "@mythos/sync/web"
// import { createSqliteAdapter } from "@mythos/sync/native"
