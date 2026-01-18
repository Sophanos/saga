import {
  deletePointsByFilter,
  namedDense,
  searchPoints,
  upsertPoints,
  type QdrantConfig,
  type QdrantFilter,
  type QdrantPoint,
  type QdrantSearchResult,
} from "./qdrant";
import { QDRANT_TEXT_VECTOR } from "./qdrantCollections";

export type SessionVectorKind =
  | "document_chunk"
  | "entity"
  | "relationship"
  | "memory"
  | "policy"
  | "facet_context";

export interface SessionVectorPoint {
  id: string;
  vector: number[];
  kind: SessionVectorKind;
  sourceId: string;
  content: string;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface SessionVectorSearchResult {
  score: number;
  kind: SessionVectorKind;
  sourceId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

function getSessionCollectionName(): string {
  return process.env["QDRANT_SESSION_COLLECTION"] ?? "saga_sessions";
}

function getSessionQdrantConfig(): Partial<QdrantConfig> {
  return { collection: getSessionCollectionName() };
}

function buildSessionFilter(args: {
  projectId: string;
  sessionId: string;
  kinds?: SessionVectorKind[];
}): QdrantFilter {
  const must: QdrantFilter["must"] = [
    { key: "project_id", match: { value: args.projectId } },
    { key: "session_id", match: { value: args.sessionId } },
  ];

  if (args.kinds && args.kinds.length > 0) {
    must?.push({
      key: "kind",
      match: { any: args.kinds },
    });
  }

  return { must };
}

export async function upsertSessionVectors(args: {
  projectId: string;
  sessionId: string;
  userId: string;
  documentId?: string;
  points: SessionVectorPoint[];
}): Promise<void> {
  if (args.points.length === 0) return;

  const qdrantPoints: QdrantPoint[] = args.points.map((point) => ({
    id: point.id,
    vector: namedDense(QDRANT_TEXT_VECTOR, point.vector),
    payload: {
      project_id: args.projectId,
      session_id: args.sessionId,
      user_id: args.userId,
      document_id: args.documentId ?? null,
      kind: point.kind,
      source_id: point.sourceId,
      content: point.content,
      created_at: point.createdAt,
      expires_at: point.expiresAt,
      metadata: point.metadata ?? null,
    },
  }));

  await upsertPoints(qdrantPoints, getSessionQdrantConfig());
}

export async function searchSessionVectors(args: {
  projectId: string;
  sessionId: string;
  vector: number[];
  limit: number;
  kinds?: SessionVectorKind[];
}): Promise<SessionVectorSearchResult[]> {
  const filter = buildSessionFilter({
    projectId: args.projectId,
    sessionId: args.sessionId,
    kinds: args.kinds,
  });

  const results = await searchPoints(
    namedDense(QDRANT_TEXT_VECTOR, args.vector),
    args.limit,
    filter,
    getSessionQdrantConfig()
  );

  return results.map((result: QdrantSearchResult) => ({
    score: result.score,
    kind: result.payload["kind"] as SessionVectorKind,
    sourceId: String(result.payload["source_id"] ?? ""),
    content: String(result.payload["content"] ?? ""),
    metadata:
      result.payload["metadata"] && typeof result.payload["metadata"] === "object"
        ? (result.payload["metadata"] as Record<string, unknown>)
        : undefined,
  }));
}

export async function deleteSessionVectors(args: {
  projectId: string;
  sessionId: string;
}): Promise<void> {
  const filter = buildSessionFilter({
    projectId: args.projectId,
    sessionId: args.sessionId,
  });

  await deletePointsByFilter(filter, getSessionQdrantConfig());
}
