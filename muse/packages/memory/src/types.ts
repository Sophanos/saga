/**
 * @mythos/memory - Types
 *
 * Re-exports and extends types from agent-protocol for client use.
 */

export type {
  MemoryCategory,
  MemoryScope,
  MemorySource,
  MemoryMetadata,
  MemoryRecord,
  MemoryContext,
  ProfileContext,
  MemoryWriteRequest,
  MemoryWriteResponse,
  MemoryReadRequest,
  MemoryReadResponse,
  MemoryDeleteRequest,
  MemoryDeleteResponse,
  LearnStyleRequest,
  LearnStyleResponse,
  // MLP 2.x batch operations
  MemoryWriteItem,
  MemoryWriteBatchRequest,
  MemoryWriteBatchResponse,
} from "@mythos/agent-protocol";

export { getDefaultMemoryScope } from "@mythos/agent-protocol";
