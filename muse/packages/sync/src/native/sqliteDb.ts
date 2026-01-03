/**
 * SQLite adapter for React Native (expo-sqlite)
 * Implements LocalDbAdapter for offline storage on mobile
 */

import { v4 as uuidv4 } from "uuid";
import type {
  LocalDbAdapter,
  Mutation,
  QueuedAiRequest,
  SyncEvent,
  ProjectSnapshot,
} from "../types";

/**
 * SQLite bind parameter types
 */
type SQLiteBindValue = string | number | null | boolean | Uint8Array;
type SQLiteBindParams = SQLiteBindValue[] | Record<string, SQLiteBindValue>;

/**
 * SQLite database instance type (from expo-sqlite)
 * This is a subset of the expo-sqlite API we use
 */
export interface SQLiteDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SQLiteBindParams): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(sql: string, params?: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: SQLiteBindParams): Promise<T[]>;
}

/**
 * Create schema SQL statements
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    parent_id TEXT,
    type TEXT NOT NULL,
    title TEXT,
    content TEXT,
    content_text TEXT,
    order_index INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
  CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id);

  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aliases TEXT,
    type TEXT NOT NULL,
    properties TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project_id);
  CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(project_id, type);

  CREATE TABLE IF NOT EXISTS relationships (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL,
    bidirectional INTEGER DEFAULT 0,
    strength INTEGER,
    metadata TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_relationships_project ON relationships(project_id);
  CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
  CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);

  CREATE TABLE IF NOT EXISTS mentions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    position_start INTEGER NOT NULL,
    position_end INTEGER NOT NULL,
    context TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_mentions_project ON mentions(project_id);
  CREATE INDEX IF NOT EXISTS idx_mentions_document ON mentions(document_id);

  CREATE TABLE IF NOT EXISTS mutations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    tbl TEXT NOT NULL,
    type TEXT NOT NULL,
    row TEXT,
    pk TEXT,
    base_version INTEGER,
    created_at TEXT NOT NULL,
    error TEXT,
    retry_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_mutations_project ON mutations(project_id);
  CREATE INDEX IF NOT EXISTS idx_mutations_created ON mutations(created_at);

  CREATE TABLE IF NOT EXISTS ai_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    document_id TEXT,
    payload TEXT,
    created_at TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_ai_requests_project ON ai_requests(project_id);
  CREATE INDEX IF NOT EXISTS idx_ai_requests_priority ON ai_requests(priority DESC);

  CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    title TEXT,
    content TEXT,
    media_url TEXT,
    media_mime_type TEXT,
    payload TEXT,
    source TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    processed_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_captures_project ON captures(project_id);
  CREATE INDEX IF NOT EXISTS idx_captures_status ON captures(project_id, status);

  CREATE TABLE IF NOT EXISTS sync_meta (
    project_id TEXT PRIMARY KEY,
    last_sync_version INTEGER DEFAULT 0,
    last_sync_at TEXT
  );
`;

/**
 * Create a SQLite adapter for React Native
 */
export function createSqliteAdapter(db: SQLiteDatabase): LocalDbAdapter {
  return {
    async initialize(): Promise<void> {
      await db.execAsync(SCHEMA_SQL);
    },

    async bootstrapProject(projectId: string, snapshot: ProjectSnapshot): Promise<void> {
      // Clear existing project data
      await db.runAsync("DELETE FROM documents WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM entities WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM relationships WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM mentions WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM captures WHERE project_id = ?", [projectId]);

      // Insert documents
      for (const doc of snapshot.documents) {
        const d = doc as Record<string, unknown>;
        await db.runAsync(
          `INSERT INTO documents (id, project_id, parent_id, type, title, content, content_text, order_index, word_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d["id"] as string,
            projectId,
            (d["parentId"] as string) || null,
            d["type"] as string,
            (d["title"] as string) || null,
            d["content"] ? JSON.stringify(d["content"]) : null,
            (d["contentText"] as string) || null,
            (d["orderIndex"] as number) || 0,
            (d["wordCount"] as number) || 0,
            d["createdAt"] as string,
            d["updatedAt"] as string,
          ]
        );
      }

      // Insert entities
      for (const entity of snapshot.entities) {
        const e = entity as Record<string, unknown>;
        await db.runAsync(
          `INSERT INTO entities (id, project_id, name, aliases, type, properties, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e["id"] as string,
            projectId,
            e["name"] as string,
            JSON.stringify(e["aliases"] || []),
            e["type"] as string,
            JSON.stringify(e["properties"] || {}),
            (e["notes"] as string) || null,
            e["createdAt"] as string,
            e["updatedAt"] as string,
          ]
        );
      }

      // Insert relationships
      for (const rel of snapshot.relationships) {
        const r = rel as Record<string, unknown>;
        await db.runAsync(
          `INSERT INTO relationships (id, project_id, source_id, target_id, type, bidirectional, strength, metadata, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r["id"] as string,
            projectId,
            r["sourceId"] as string,
            r["targetId"] as string,
            r["type"] as string,
            r["bidirectional"] ? 1 : 0,
            (r["strength"] as number) || null,
            r["metadata"] ? JSON.stringify(r["metadata"]) : null,
            (r["notes"] as string) || null,
            r["createdAt"] as string,
          ]
        );
      }

      // Insert mentions
      for (const mention of snapshot.mentions) {
        const m = mention as Record<string, unknown>;
        await db.runAsync(
          `INSERT INTO mentions (id, project_id, entity_id, document_id, position_start, position_end, context, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m["id"] as string,
            projectId,
            m["entityId"] as string,
            m["documentId"] as string,
            m["positionStart"] as number,
            m["positionEnd"] as number,
            (m["context"] as string) || null,
            m["createdAt"] as string,
          ]
        );
      }

      // Insert captures
      for (const capture of snapshot.captures || []) {
        const c = capture as Record<string, unknown>;
        await db.runAsync(
          `INSERT INTO captures (id, project_id, created_by, kind, status, title, content, media_url, media_mime_type, payload, source, created_at, updated_at, processed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c["id"] as string,
            projectId,
            c["createdBy"] as string,
            c["kind"] as string,
            c["status"] as string,
            (c["title"] as string) || null,
            (c["content"] as string) || null,
            (c["mediaUrl"] as string) || null,
            (c["mediaMimeType"] as string) || null,
            c["payload"] ? JSON.stringify(c["payload"]) : null,
            (c["source"] as string) || null,
            c["createdAt"] as string,
            c["updatedAt"] as string,
            (c["processedAt"] as string) || null,
          ]
        );
      }

      // Update sync meta
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_meta (project_id, last_sync_version, last_sync_at)
         VALUES (?, ?, ?)`,
        [projectId, snapshot.version, snapshot.syncedAt]
      );
    },

    async applyActivity(events: SyncEvent[]): Promise<void> {
      for (const event of events) {
        const row = event.row;
        const id = row["id"] as string;

        switch (event.table) {
          case "documents":
            if (event.type === "delete") {
              await db.runAsync("DELETE FROM documents WHERE id = ?", [id]);
            } else {
              await db.runAsync(
                `INSERT OR REPLACE INTO documents (id, project_id, parent_id, type, title, content, content_text, order_index, word_count, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  row["projectId"] as string,
                  (row["parentId"] as string) || null,
                  row["type"] as string,
                  (row["title"] as string) || null,
                  row["content"] ? JSON.stringify(row["content"]) : null,
                  (row["contentText"] as string) || null,
                  (row["orderIndex"] as number) || 0,
                  (row["wordCount"] as number) || 0,
                  row["createdAt"] as string,
                  row["updatedAt"] as string,
                ]
              );
            }
            break;

          case "entities":
            if (event.type === "delete") {
              await db.runAsync("DELETE FROM entities WHERE id = ?", [id]);
            } else {
              await db.runAsync(
                `INSERT OR REPLACE INTO entities (id, project_id, name, aliases, type, properties, notes, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  row["projectId"] as string,
                  row["name"] as string,
                  JSON.stringify(row["aliases"] || []),
                  row["type"] as string,
                  JSON.stringify(row["properties"] || {}),
                  (row["notes"] as string) || null,
                  row["createdAt"] as string,
                  row["updatedAt"] as string,
                ]
              );
            }
            break;

          case "relationships":
            if (event.type === "delete") {
              await db.runAsync("DELETE FROM relationships WHERE id = ?", [id]);
            } else {
              await db.runAsync(
                `INSERT OR REPLACE INTO relationships (id, project_id, source_id, target_id, type, bidirectional, strength, metadata, notes, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  row["projectId"] as string,
                  row["sourceId"] as string,
                  row["targetId"] as string,
                  row["type"] as string,
                  row["bidirectional"] ? 1 : 0,
                  (row["strength"] as number) || null,
                  row["metadata"] ? JSON.stringify(row["metadata"]) : null,
                  (row["notes"] as string) || null,
                  row["createdAt"] as string,
                ]
              );
            }
            break;

          case "mentions":
            if (event.type === "delete") {
              await db.runAsync("DELETE FROM mentions WHERE id = ?", [id]);
            } else {
              await db.runAsync(
                `INSERT OR REPLACE INTO mentions (id, project_id, entity_id, document_id, position_start, position_end, context, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  row["projectId"] as string,
                  row["entityId"] as string,
                  row["documentId"] as string,
                  row["positionStart"] as number,
                  row["positionEnd"] as number,
                  (row["context"] as string) || null,
                  row["createdAt"] as string,
                ]
              );
            }
            break;

          case "captures":
            if (event.type === "delete") {
              await db.runAsync("DELETE FROM captures WHERE id = ?", [id]);
            } else {
              await db.runAsync(
                `INSERT OR REPLACE INTO captures (id, project_id, created_by, kind, status, title, content, media_url, media_mime_type, payload, source, created_at, updated_at, processed_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  id,
                  row["projectId"] as string,
                  row["createdBy"] as string,
                  row["kind"] as string,
                  row["status"] as string,
                  (row["title"] as string) || null,
                  (row["content"] as string) || null,
                  (row["mediaUrl"] as string) || null,
                  (row["mediaMimeType"] as string) || null,
                  row["payload"] ? JSON.stringify(row["payload"]) : null,
                  (row["source"] as string) || null,
                  row["createdAt"] as string,
                  row["updatedAt"] as string,
                  (row["processedAt"] as string) || null,
                ]
              );
            }
            break;
        }
      }
    },

    async enqueueMutation(mutation: Mutation): Promise<void> {
      await db.runAsync(
        `INSERT INTO mutations (id, project_id, tbl, type, row, pk, base_version, created_at, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          mutation.id || uuidv4(),
          mutation.projectId,
          mutation.table,
          mutation.type,
          mutation.row ? JSON.stringify(mutation.row) : null,
          mutation.pk || null,
          mutation.baseVersion || null,
          mutation.createdAt,
        ]
      );
    },

    async peekMutations(limit: number): Promise<Mutation[]> {
      const rows = await db.getAllAsync<{
        id: string;
        project_id: string;
        tbl: string;
        type: string;
        row: string | null;
        pk: string | null;
        base_version: number | null;
        created_at: string;
      }>("SELECT * FROM mutations ORDER BY created_at LIMIT ?", [limit]);

      return rows.map((m) => ({
        id: m.id,
        projectId: m.project_id,
        table: m.tbl as Mutation["table"],
        type: m.type as Mutation["type"],
        row: m.row ? JSON.parse(m.row) : undefined,
        pk: m.pk || undefined,
        baseVersion: m.base_version || undefined,
        createdAt: m.created_at,
      }));
    },

    async markMutationDone(id: string): Promise<void> {
      await db.runAsync("DELETE FROM mutations WHERE id = ?", [id]);
    },

    async markMutationFailed(id: string, error: string): Promise<void> {
      await db.runAsync(
        "UPDATE mutations SET error = ?, retry_count = retry_count + 1 WHERE id = ?",
        [error, id]
      );
    },

    async getPendingMutationsCount(): Promise<number> {
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM mutations"
      );
      return result?.count ?? 0;
    },

    async enqueueAiRequest(request: QueuedAiRequest): Promise<void> {
      await db.runAsync(
        `INSERT INTO ai_requests (id, project_id, type, document_id, payload, created_at, priority, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          request.id || uuidv4(),
          request.projectId,
          request.type,
          request.documentId || null,
          JSON.stringify(request.payload),
          request.createdAt,
          request.priority ?? 0,
          request.retryCount ?? 0,
        ]
      );
    },

    async peekAiRequests(limit: number): Promise<QueuedAiRequest[]> {
      const rows = await db.getAllAsync<{
        id: string;
        project_id: string;
        type: string;
        document_id: string | null;
        payload: string;
        created_at: string;
        priority: number;
        retry_count: number;
      }>("SELECT * FROM ai_requests ORDER BY priority DESC, created_at LIMIT ?", [limit]);

      return rows.map((r) => ({
        id: r.id,
        projectId: r.project_id,
        type: r.type as QueuedAiRequest["type"],
        documentId: r.document_id || undefined,
        payload: JSON.parse(r.payload),
        createdAt: r.created_at,
        priority: r.priority,
        retryCount: r.retry_count,
      }));
    },

    async markAiRequestDone(id: string): Promise<void> {
      await db.runAsync("DELETE FROM ai_requests WHERE id = ?", [id]);
    },

    async getPendingAiRequestsCount(): Promise<number> {
      const result = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM ai_requests"
      );
      return result?.count ?? 0;
    },

    async getDocument(id: string): Promise<Record<string, unknown> | null> {
      const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM documents WHERE id = ?",
        [id]
      );
      if (!row) return null;
      return transformDocumentRow(row);
    },

    async getDocuments(projectId: string): Promise<Record<string, unknown>[]> {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        "SELECT * FROM documents WHERE project_id = ? ORDER BY order_index",
        [projectId]
      );
      return rows.map(transformDocumentRow);
    },

    async upsertDocument(doc: Record<string, unknown>): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO documents (id, project_id, parent_id, type, title, content, content_text, order_index, word_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          doc["id"] as string,
          doc["projectId"] as string,
          (doc["parentId"] as string) || null,
          doc["type"] as string,
          (doc["title"] as string) || null,
          doc["content"] ? JSON.stringify(doc["content"]) : null,
          (doc["contentText"] as string) || null,
          (doc["orderIndex"] as number) || 0,
          (doc["wordCount"] as number) || 0,
          doc["createdAt"] as string,
          doc["updatedAt"] as string,
        ]
      );
    },

    async deleteDocument(id: string): Promise<void> {
      const row = await db.getFirstAsync<{ type?: string }>(
        "SELECT type FROM documents WHERE id = ?",
        [id]
      );
      if (!row) return;

      if (row.type === "chapter") {
        await db.runAsync("DELETE FROM documents WHERE parent_id = ?", [id]);
      }

      await db.runAsync("DELETE FROM documents WHERE id = ?", [id]);
    },

    async getEntity(id: string): Promise<Record<string, unknown> | null> {
      const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM entities WHERE id = ?",
        [id]
      );
      if (!row) return null;
      return transformEntityRow(row);
    },

    async getEntities(projectId: string): Promise<Record<string, unknown>[]> {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        "SELECT * FROM entities WHERE project_id = ?",
        [projectId]
      );
      return rows.map(transformEntityRow);
    },

    async upsertEntity(entity: Record<string, unknown>): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO entities (id, project_id, name, aliases, type, properties, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entity["id"] as string,
          entity["projectId"] as string,
          entity["name"] as string,
          JSON.stringify(entity["aliases"] || []),
          entity["type"] as string,
          JSON.stringify(entity["properties"] || {}),
          (entity["notes"] as string) || null,
          entity["createdAt"] as string,
          entity["updatedAt"] as string,
        ]
      );
    },

    async deleteEntity(id: string): Promise<void> {
      await db.runAsync("DELETE FROM entities WHERE id = ?", [id]);
    },

    async getRelationships(projectId: string): Promise<Record<string, unknown>[]> {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        "SELECT * FROM relationships WHERE project_id = ?",
        [projectId]
      );
      return rows.map(transformRelationshipRow);
    },

    async upsertRelationship(rel: Record<string, unknown>): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO relationships (id, project_id, source_id, target_id, type, bidirectional, strength, metadata, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rel["id"] as string,
          rel["projectId"] as string,
          rel["sourceId"] as string,
          rel["targetId"] as string,
          rel["type"] as string,
          rel["bidirectional"] ? 1 : 0,
          (rel["strength"] as number) || null,
          rel["metadata"] ? JSON.stringify(rel["metadata"]) : null,
          (rel["notes"] as string) || null,
          rel["createdAt"] as string,
        ]
      );
    },

    async deleteRelationship(id: string): Promise<void> {
      await db.runAsync("DELETE FROM relationships WHERE id = ?", [id]);
    },

    async getCapture(id: string): Promise<Record<string, unknown> | null> {
      const row = await db.getFirstAsync<Record<string, unknown>>(
        "SELECT * FROM captures WHERE id = ?",
        [id]
      );
      if (!row) return null;
      return transformCaptureRow(row);
    },

    async getCaptures(projectId: string): Promise<Record<string, unknown>[]> {
      const rows = await db.getAllAsync<Record<string, unknown>>(
        "SELECT * FROM captures WHERE project_id = ? ORDER BY created_at DESC",
        [projectId]
      );
      return rows.map(transformCaptureRow);
    },

    async upsertCapture(capture: Record<string, unknown>): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO captures (id, project_id, created_by, kind, status, title, content, media_url, media_mime_type, payload, source, created_at, updated_at, processed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          capture["id"] as string,
          capture["projectId"] as string,
          capture["createdBy"] as string,
          capture["kind"] as string,
          capture["status"] as string,
          (capture["title"] as string) || null,
          (capture["content"] as string) || null,
          (capture["mediaUrl"] as string) || null,
          (capture["mediaMimeType"] as string) || null,
          capture["payload"] ? JSON.stringify(capture["payload"]) : null,
          (capture["source"] as string) || null,
          capture["createdAt"] as string,
          capture["updatedAt"] as string,
          (capture["processedAt"] as string) || null,
        ]
      );
    },

    async deleteCapture(id: string): Promise<void> {
      await db.runAsync("DELETE FROM captures WHERE id = ?", [id]);
    },

    async getLastSyncVersion(projectId: string): Promise<number> {
      const result = await db.getFirstAsync<{ last_sync_version: number }>(
        "SELECT last_sync_version FROM sync_meta WHERE project_id = ?",
        [projectId]
      );
      return result?.last_sync_version ?? 0;
    },

    async setLastSyncVersion(projectId: string, version: number): Promise<void> {
      await db.runAsync(
        `INSERT OR REPLACE INTO sync_meta (project_id, last_sync_version, last_sync_at)
         VALUES (?, ?, ?)`,
        [projectId, version, new Date().toISOString()]
      );
    },

    async clearProject(projectId: string): Promise<void> {
      await db.runAsync("DELETE FROM documents WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM entities WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM relationships WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM mentions WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM captures WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM mutations WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM ai_requests WHERE project_id = ?", [projectId]);
      await db.runAsync("DELETE FROM sync_meta WHERE project_id = ?", [projectId]);
    },

    async clearAll(): Promise<void> {
      await db.runAsync("DELETE FROM documents");
      await db.runAsync("DELETE FROM entities");
      await db.runAsync("DELETE FROM relationships");
      await db.runAsync("DELETE FROM mentions");
      await db.runAsync("DELETE FROM captures");
      await db.runAsync("DELETE FROM mutations");
      await db.runAsync("DELETE FROM ai_requests");
      await db.runAsync("DELETE FROM sync_meta");
    },
  };
}

/**
 * Transform SQLite row to camelCase document
 */
function transformDocumentRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row["id"],
    projectId: row["project_id"],
    parentId: row["parent_id"] || undefined,
    type: row["type"],
    title: row["title"] || undefined,
    content: row["content"] ? JSON.parse(row["content"] as string) : undefined,
    contentText: row["content_text"] || undefined,
    orderIndex: row["order_index"],
    wordCount: row["word_count"],
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

/**
 * Transform SQLite row to camelCase entity
 */
function transformEntityRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row["id"],
    projectId: row["project_id"],
    name: row["name"],
    aliases: row["aliases"] ? JSON.parse(row["aliases"] as string) : [],
    type: row["type"],
    properties: row["properties"] ? JSON.parse(row["properties"] as string) : {},
    notes: row["notes"] || undefined,
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
  };
}

/**
 * Transform SQLite row to camelCase relationship
 */
function transformRelationshipRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row["id"],
    projectId: row["project_id"],
    sourceId: row["source_id"],
    targetId: row["target_id"],
    type: row["type"],
    bidirectional: row["bidirectional"] === 1,
    strength: row["strength"] || undefined,
    metadata: row["metadata"] ? JSON.parse(row["metadata"] as string) : undefined,
    notes: row["notes"] || undefined,
    createdAt: row["created_at"],
  };
}

/**
 * Transform SQLite row to camelCase capture
 */
function transformCaptureRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row["id"],
    projectId: row["project_id"],
    createdBy: row["created_by"],
    kind: row["kind"],
    status: row["status"],
    title: row["title"] || undefined,
    content: row["content"] || undefined,
    mediaUrl: row["media_url"] || undefined,
    mediaMimeType: row["media_mime_type"] || undefined,
    payload: row["payload"] ? JSON.parse(row["payload"] as string) : undefined,
    source: row["source"] || undefined,
    createdAt: row["created_at"],
    updatedAt: row["updated_at"],
    processedAt: row["processed_at"] || undefined,
  };
}

export default createSqliteAdapter;
