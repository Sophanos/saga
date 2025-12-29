/**
 * Dexie IndexedDB adapter for web platform
 * Implements LocalDbAdapter for offline storage
 */

import Dexie, { type Table } from "dexie";
import { v4 as uuidv4 } from "uuid";
import type {
  LocalDbAdapter,
  Mutation,
  QueuedAiRequest,
  SyncEvent,
  ProjectSnapshot,
} from "../types";

/**
 * Database schema interfaces
 */
interface DbDocument {
  id: string;
  projectId: string;
  parentId?: string;
  type: string;
  title?: string;
  content?: unknown;
  contentText?: string;
  orderIndex: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DbEntity {
  id: string;
  projectId: string;
  name: string;
  aliases: string[];
  type: string;
  properties: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface DbRelationship {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  type: string;
  bidirectional: boolean;
  strength?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
}

interface DbMention {
  id: string;
  projectId: string;
  entityId: string;
  documentId: string;
  positionStart: number;
  positionEnd: number;
  context: string;
  createdAt: string;
}

interface DbCapture {
  id: string;
  projectId: string;
  createdBy: string;
  kind: string;
  status: string;
  title?: string;
  content?: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  payload?: unknown;
  source?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

interface DbMutation {
  id: string;
  projectId: string;
  table: string;
  type: string;
  row?: unknown;
  pk?: string;
  baseVersion?: number;
  createdAt: string;
  error?: string;
  retryCount: number;
}

interface DbAiRequest {
  id: string;
  projectId: string;
  type: string;
  documentId?: string;
  payload: unknown;
  createdAt: string;
  priority: number;
  retryCount: number;
}

interface DbSyncMeta {
  projectId: string;
  lastSyncVersion: number;
  lastSyncAt: string;
}

interface DbMemory {
  id: string;
  projectId: string;
  category: string;
  scope: string;
  ownerId?: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Dexie database class
 */
class MythosDb extends Dexie {
  documents!: Table<DbDocument, string>;
  entities!: Table<DbEntity, string>;
  relationships!: Table<DbRelationship, string>;
  mentions!: Table<DbMention, string>;
  captures!: Table<DbCapture, string>;
  mutations!: Table<DbMutation, string>;
  aiRequests!: Table<DbAiRequest, string>;
  syncMeta!: Table<DbSyncMeta, string>;
  memories!: Table<DbMemory, string>;

  constructor() {
    super("mythos-offline");

    this.version(1).stores({
      documents: "id, projectId, parentId, type, [projectId+type]",
      entities: "id, projectId, name, type, [projectId+type]",
      relationships: "id, projectId, sourceId, targetId, [projectId+type]",
      mentions: "id, projectId, entityId, documentId, [projectId+documentId]",
      mutations: "id, projectId, table, createdAt",
      aiRequests: "id, projectId, type, priority, createdAt",
      syncMeta: "projectId",
    });

    this.version(2).stores({
      documents: "id, projectId, parentId, type, [projectId+type]",
      entities: "id, projectId, name, type, [projectId+type]",
      relationships: "id, projectId, sourceId, targetId, [projectId+type]",
      mentions: "id, projectId, entityId, documentId, [projectId+documentId]",
      captures: "id, projectId, kind, status, createdAt, [projectId+status]",
      mutations: "id, projectId, table, createdAt",
      aiRequests: "id, projectId, type, priority, createdAt",
      syncMeta: "projectId",
    });

    // Version 3: Add memories table for MLP 1.5
    this.version(3).stores({
      documents: "id, projectId, parentId, type, [projectId+type]",
      entities: "id, projectId, name, type, [projectId+type]",
      relationships: "id, projectId, sourceId, targetId, [projectId+type]",
      mentions: "id, projectId, entityId, documentId, [projectId+documentId]",
      captures: "id, projectId, kind, status, createdAt, [projectId+status]",
      mutations: "id, projectId, table, createdAt",
      aiRequests: "id, projectId, type, priority, createdAt",
      syncMeta: "projectId",
      memories: "id, projectId, category, createdAt, [projectId+category]",
    });
  }
}

/**
 * Create a new Dexie database adapter
 */
export function createDexieAdapter(): LocalDbAdapter {
  const db = new MythosDb();

  return {
    async initialize(): Promise<void> {
      await db.open();
    },

    async bootstrapProject(projectId: string, snapshot: ProjectSnapshot): Promise<void> {
      await db.transaction(
        "rw",
        [db.documents, db.entities, db.relationships, db.mentions, db.captures, db.syncMeta],
        async () => {
          // Clear existing project data
          await db.documents.where("projectId").equals(projectId).delete();
          await db.entities.where("projectId").equals(projectId).delete();
          await db.relationships.where("projectId").equals(projectId).delete();
          await db.mentions.where("projectId").equals(projectId).delete();
          await db.captures.where("projectId").equals(projectId).delete();

          // Insert snapshot data
          if (snapshot.documents.length > 0) {
            await db.documents.bulkPut(
              snapshot.documents.map((d) => ({
                ...d,
                projectId,
              })) as DbDocument[]
            );
          }

          if (snapshot.entities.length > 0) {
            await db.entities.bulkPut(
              snapshot.entities.map((e) => ({
                ...e,
                projectId,
              })) as DbEntity[]
            );
          }

          if (snapshot.relationships.length > 0) {
            await db.relationships.bulkPut(
              snapshot.relationships.map((r) => ({
                ...r,
                projectId,
              })) as DbRelationship[]
            );
          }

          if (snapshot.mentions.length > 0) {
            await db.mentions.bulkPut(
              snapshot.mentions.map((m) => ({
                ...m,
                projectId,
              })) as DbMention[]
            );
          }

          if (snapshot.captures && snapshot.captures.length > 0) {
            await db.captures.bulkPut(
              snapshot.captures.map((c) => ({
                ...c,
                projectId,
              })) as DbCapture[]
            );
          }

          // Update sync meta
          await db.syncMeta.put({
            projectId,
            lastSyncVersion: snapshot.version,
            lastSyncAt: snapshot.syncedAt,
          });
        }
      );
    },

    async applyActivity(events: SyncEvent[]): Promise<void> {
      await db.transaction(
        "rw",
        [db.documents, db.entities, db.relationships, db.mentions, db.captures],
        async () => {
          for (const event of events) {
            const row = event.row as Record<string, unknown>;
            const id = row["id"] as string;

            switch (event.table) {
              case "documents":
                if (event.type === "delete") {
                  await db.documents.delete(id);
                } else {
                  await db.documents.put(row as unknown as DbDocument);
                }
                break;

              case "entities":
                if (event.type === "delete") {
                  await db.entities.delete(id);
                } else {
                  await db.entities.put(row as unknown as DbEntity);
                }
                break;

              case "relationships":
                if (event.type === "delete") {
                  await db.relationships.delete(id);
                } else {
                  await db.relationships.put(row as unknown as DbRelationship);
                }
                break;

              case "mentions":
                if (event.type === "delete") {
                  await db.mentions.delete(id);
                } else {
                  await db.mentions.put(row as unknown as DbMention);
                }
                break;

              case "captures":
                if (event.type === "delete") {
                  await db.captures.delete(id);
                } else {
                  await db.captures.put(row as unknown as DbCapture);
                }
                break;
            }
          }
        }
      );
    },

    async enqueueMutation(mutation: Mutation): Promise<void> {
      await db.mutations.put({
        id: mutation.id || uuidv4(),
        projectId: mutation.projectId,
        table: mutation.table,
        type: mutation.type,
        row: mutation.row,
        pk: mutation.pk,
        baseVersion: mutation.baseVersion,
        createdAt: mutation.createdAt,
        retryCount: 0,
      });
    },

    async peekMutations(limit: number): Promise<Mutation[]> {
      const mutations = await db.mutations
        .orderBy("createdAt")
        .limit(limit)
        .toArray();

      return mutations.map((m) => ({
        id: m.id,
        table: m.table as Mutation["table"],
        type: m.type as Mutation["type"],
        row: m.row as Record<string, unknown>,
        pk: m.pk,
        baseVersion: m.baseVersion,
        createdAt: m.createdAt,
        projectId: m.projectId,
      }));
    },

    async markMutationDone(id: string): Promise<void> {
      await db.mutations.delete(id);
    },

    async markMutationFailed(id: string, error: string): Promise<void> {
      const mutation = await db.mutations.get(id);
      if (mutation) {
        await db.mutations.update(id, {
          error,
          retryCount: mutation.retryCount + 1,
        });
      }
    },

    async getPendingMutationsCount(): Promise<number> {
      return db.mutations.count();
    },

    async enqueueAiRequest(request: QueuedAiRequest): Promise<void> {
      await db.aiRequests.put({
        id: request.id || uuidv4(),
        projectId: request.projectId,
        type: request.type,
        documentId: request.documentId,
        payload: request.payload,
        createdAt: request.createdAt,
        priority: request.priority ?? 0,
        retryCount: request.retryCount ?? 0,
      });
    },

    async peekAiRequests(limit: number): Promise<QueuedAiRequest[]> {
      const requests = await db.aiRequests
        .orderBy("priority")
        .reverse()
        .limit(limit)
        .toArray();

      return requests.map((r) => ({
        id: r.id,
        type: r.type as QueuedAiRequest["type"],
        projectId: r.projectId,
        documentId: r.documentId,
        payload: r.payload as Record<string, unknown>,
        createdAt: r.createdAt,
        priority: r.priority,
        retryCount: r.retryCount,
      }));
    },

    async markAiRequestDone(id: string): Promise<void> {
      await db.aiRequests.delete(id);
    },

    async getPendingAiRequestsCount(): Promise<number> {
      return db.aiRequests.count();
    },

    async getDocument(id: string): Promise<Record<string, unknown> | null> {
      const doc = await db.documents.get(id);
      return doc ? (doc as unknown as Record<string, unknown>) : null;
    },

    async getDocuments(projectId: string): Promise<Record<string, unknown>[]> {
      const docs = await db.documents.where("projectId").equals(projectId).toArray();
      return docs as unknown as Record<string, unknown>[];
    },

    async upsertDocument(doc: Record<string, unknown>): Promise<void> {
      await db.documents.put(doc as unknown as DbDocument);
    },

    async deleteDocument(id: string): Promise<void> {
      await db.documents.delete(id);
    },

    async getEntity(id: string): Promise<Record<string, unknown> | null> {
      const entity = await db.entities.get(id);
      return entity ? (entity as unknown as Record<string, unknown>) : null;
    },

    async getEntities(projectId: string): Promise<Record<string, unknown>[]> {
      const entities = await db.entities.where("projectId").equals(projectId).toArray();
      return entities as unknown as Record<string, unknown>[];
    },

    async upsertEntity(entity: Record<string, unknown>): Promise<void> {
      await db.entities.put(entity as unknown as DbEntity);
    },

    async deleteEntity(id: string): Promise<void> {
      await db.entities.delete(id);
    },

    async getRelationships(projectId: string): Promise<Record<string, unknown>[]> {
      const rels = await db.relationships.where("projectId").equals(projectId).toArray();
      return rels as unknown as Record<string, unknown>[];
    },

    async upsertRelationship(rel: Record<string, unknown>): Promise<void> {
      await db.relationships.put(rel as unknown as DbRelationship);
    },

    async deleteRelationship(id: string): Promise<void> {
      await db.relationships.delete(id);
    },

    async getCapture(id: string): Promise<Record<string, unknown> | null> {
      const capture = await db.captures.get(id);
      return capture ? (capture as unknown as Record<string, unknown>) : null;
    },

    async getCaptures(projectId: string): Promise<Record<string, unknown>[]> {
      const captures = await db.captures
        .where("projectId")
        .equals(projectId)
        .reverse()
        .sortBy("createdAt");
      return captures as unknown as Record<string, unknown>[];
    },

    async upsertCapture(capture: Record<string, unknown>): Promise<void> {
      await db.captures.put(capture as unknown as DbCapture);
    },

    async deleteCapture(id: string): Promise<void> {
      await db.captures.delete(id);
    },

    async getLastSyncVersion(projectId: string): Promise<number> {
      const meta = await db.syncMeta.get(projectId);
      return meta?.lastSyncVersion ?? 0;
    },

    async setLastSyncVersion(projectId: string, version: number): Promise<void> {
      await db.syncMeta.put({
        projectId,
        lastSyncVersion: version,
        lastSyncAt: new Date().toISOString(),
      });
    },

    async clearProject(projectId: string): Promise<void> {
      await db.transaction(
        "rw",
        [db.documents, db.entities, db.relationships, db.mentions, db.captures, db.mutations, db.aiRequests, db.syncMeta, db.memories],
        async () => {
          await db.documents.where("projectId").equals(projectId).delete();
          await db.entities.where("projectId").equals(projectId).delete();
          await db.relationships.where("projectId").equals(projectId).delete();
          await db.mentions.where("projectId").equals(projectId).delete();
          await db.captures.where("projectId").equals(projectId).delete();
          await db.mutations.where("projectId").equals(projectId).delete();
          await db.aiRequests.where("projectId").equals(projectId).delete();
          await db.syncMeta.delete(projectId);
          await db.memories.where("projectId").equals(projectId).delete();
        }
      );
    },

    async clearAll(): Promise<void> {
      await db.transaction(
        "rw",
        [db.documents, db.entities, db.relationships, db.mentions, db.captures, db.mutations, db.aiRequests, db.syncMeta, db.memories],
        async () => {
          await db.documents.clear();
          await db.entities.clear();
          await db.relationships.clear();
          await db.mentions.clear();
          await db.captures.clear();
          await db.mutations.clear();
          await db.aiRequests.clear();
          await db.syncMeta.clear();
          await db.memories.clear();
        }
      );
    },

    // =========================================================================
    // Memory Methods (MLP 1.5)
    // =========================================================================

    async getMemory(id: string): Promise<Record<string, unknown> | null> {
      const memory = await db.memories.get(id);
      return memory ? (memory as unknown as Record<string, unknown>) : null;
    },

    async getMemories(projectId: string): Promise<Record<string, unknown>[]> {
      const memories = await db.memories
        .where("projectId")
        .equals(projectId)
        .toArray();
      return memories as unknown as Record<string, unknown>[];
    },

    async getMemoriesByCategory(
      projectId: string,
      category: string
    ): Promise<Record<string, unknown>[]> {
      const memories = await db.memories
        .where("[projectId+category]")
        .equals([projectId, category])
        .toArray();
      return memories as unknown as Record<string, unknown>[];
    },

    async upsertMemory(memory: Record<string, unknown>): Promise<void> {
      await db.memories.put(memory as unknown as DbMemory);
    },

    async deleteMemory(id: string): Promise<void> {
      await db.memories.delete(id);
    },

    async clearMemories(projectId: string): Promise<void> {
      await db.memories.where("projectId").equals(projectId).delete();
    },
  };
}

export default createDexieAdapter;
