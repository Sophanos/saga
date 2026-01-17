import type { ActionCtx } from "../../../_generated/server";
import type { AnalysisJobRecord } from "../../analysisJobs";
import type { AnalysisHandlerResult } from "./types";
import { generateEmbedding, generateEmbeddings, isDeepInfraConfigured } from "../../../lib/embeddings";
import {
  deletePoints,
  deletePointsByFilter,
  isQdrantConfigured,
  scrollPoints,
  type QdrantFilter,
  type QdrantPoint,
  upsertPoints,
} from "../../../lib/qdrant";

const internal = require("../../../_generated/api").internal as any;

const MAX_EMBED_BATCH = 8;
const MAX_CHUNK_CHARS = 1200;
const MAX_EXISTING_CHUNK_SCAN = 500;
const MAX_MEMORY_EMBED_CHARS = 8000;

type EmbeddingTargetType = "document" | "entity" | "memory" | "memory_delete";

type EmbeddingPayload = {
  targetType: EmbeddingTargetType;
  targetId: string;
  source?: string;
};

function parseEmbeddingPayload(
  payload: unknown,
  fallbackDocumentId?: string
): EmbeddingPayload | null {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    const targetType = record["targetType"];
    const targetId = record["targetId"];
    if (typeof targetType === "string" && typeof targetId === "string") {
      if (
        targetType === "document" ||
        targetType === "entity" ||
        targetType === "memory" ||
        targetType === "memory_delete"
      ) {
        return {
          targetType,
          targetId,
          source: typeof record["source"] === "string" ? record["source"] : undefined,
        };
      }
    }
  }

  if (fallbackDocumentId) {
    return { targetType: "document", targetId: fallbackDocumentId };
  }

  return null;
}

function chunkText(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  const paragraphs = normalized.split(/\n{2,}/);
  let buffer = "";

  const pushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) chunks.push(trimmed);
    buffer = "";
  };

  for (const paragraph of paragraphs) {
    const para = paragraph.trim();
    if (!para) continue;

    if (para.length > maxChars) {
      if (buffer) pushBuffer();
      for (let i = 0; i < para.length; i += maxChars) {
        chunks.push(para.slice(i, i + maxChars));
      }
      continue;
    }

    if (buffer.length + para.length + 2 > maxChars) {
      pushBuffer();
    }

    buffer = buffer ? `${buffer}\n\n${para}` : para;
  }

  if (buffer) pushBuffer();
  return chunks;
}

function buildEntityText(entity: {
  name: string;
  aliases?: string[];
  notes?: string | null;
  properties?: Record<string, unknown> | null;
}): string {
  const parts: string[] = [];
  parts.push(entity.name);

  if (entity.aliases?.length) {
    parts.push(`Aliases: ${entity.aliases.join(", ")}`);
  }

  if (entity.notes) {
    parts.push(entity.notes);
  }

  if (entity.properties && Object.keys(entity.properties).length > 0) {
    parts.push(`Attributes: ${JSON.stringify(entity.properties)}`);
  }

  return parts.join("\n");
}

async function hashText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hashChunk(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseChunkIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

async function fetchExistingChunkHashes(options: {
  projectId: string;
  targetType: "document" | "entity";
  targetId: string;
  expectedCount: number;
}): Promise<Map<number, string> | null> {
  const { projectId, targetType, targetId, expectedCount } = options;
  if (expectedCount === 0) return new Map();
  if (expectedCount > MAX_EXISTING_CHUNK_SCAN) return null;

  const filter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: projectId } },
      { key: "type", match: { value: targetType } },
    ],
  };

  if (targetType === "document") {
    filter.must!.push({ key: "document_id", match: { value: targetId } });
  } else {
    filter.must!.push({ key: "entity_id", match: { value: targetId } });
  }

  const points = await scrollPoints(filter, expectedCount, {
    orderBy: { key: "chunk_index", direction: "asc" },
  });
  const hashes = new Map<number, string>();

  for (const point of points) {
    const chunkIndex = parseChunkIndex(point.payload["chunk_index"]);
    const chunkHash = point.payload["chunk_hash"];
    if (chunkIndex === undefined || typeof chunkHash !== "string") continue;
    hashes.set(chunkIndex, chunkHash);
  }

  return hashes;
}

function buildMemoryPayload(memory: Record<string, unknown>, projectId: string): Record<string, unknown> {
  const createdAtMs =
    typeof memory["createdAt"] === "number" ? (memory["createdAt"] as number) : Date.now();
  const expiresAtMs =
    typeof memory["expiresAt"] === "number" ? (memory["expiresAt"] as number) : undefined;

  return {
    project_id: projectId,
    memory_id: String(memory["_id"]),
    type: "memory",
    category: memory["type"],
    scope: memory["scope"] ?? "project",
    text: memory["text"],
    source: memory["source"] ?? "user",
    confidence: memory["confidence"] ?? 1.0,
    entity_ids: memory["entityIds"] ?? [],
    document_id: memory["documentId"],
    pinned: memory["pinned"] ?? false,
    created_at: new Date(createdAtMs).toISOString(),
    created_at_ts: createdAtMs,
    expires_at: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
  };
}

async function embedDocument(
  ctx: ActionCtx,
  job: AnalysisJobRecord,
  documentId: string
): Promise<AnalysisHandlerResult> {
  const document = await ctx.runQuery((internal as any)["ai/analysisJobs"].getDocumentForAnalysis, {
    id: documentId,
  });

  if (!document) {
    return { summary: "Document not found; skipping embedding." };
  }

  if (document.projectId !== job.projectId) {
    throw new Error("Document project mismatch");
  }

  const contentText = document.contentText ?? "";
  const contentHash = await hashText(contentText);
  const chunks = chunkText(contentText);
  const isoNow = new Date().toISOString();
  let updatedChunks = 0;

  let existingHashes: Map<number, string> | null = null;
  if (chunks.length > 0) {
    existingHashes = await fetchExistingChunkHashes({
      projectId: String(job.projectId),
      targetType: "document",
      targetId: documentId,
      expectedCount: chunks.length,
    });
  }

  const chunkData = chunks.map((text, index) => ({
    index,
    text,
    hash: hashChunk(text),
  }));
  const chunksToEmbed = existingHashes
    ? chunkData.filter((chunk) => existingHashes?.get(chunk.index) !== chunk.hash)
    : chunkData;

  for (let i = 0; i < chunksToEmbed.length; i += MAX_EMBED_BATCH) {
    const slice = chunksToEmbed.slice(i, i + MAX_EMBED_BATCH);
    const { embeddings } = await generateEmbeddings(
      slice.map((chunk) => chunk.text),
      { task: "embed_document" }
    );

    const points: QdrantPoint[] = embeddings.map((vector, idx) => {
      const chunk = slice[idx];
      return {
        id: `document:${documentId}:${chunk.index}`,
        vector,
        payload: {
          type: "document",
          project_id: String(job.projectId),
          document_id: documentId,
          title: document.title ?? "Untitled",
          document_type: document.type ?? "document",
          text: chunk.text,
          preview: chunk.text.slice(0, 200),
          chunk_index: chunk.index,
          chunk_hash: chunk.hash,
          updated_at: isoNow,
        },
      };
    });

    if (points.length > 0) {
      await upsertPoints(points);
    }

    updatedChunks += slice.length;
  }

  const baseFilter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: String(job.projectId) } },
      { key: "type", match: { value: "document" } },
      { key: "document_id", match: { value: documentId } },
    ],
  };

  if (chunks.length === 0) {
    await deletePointsByFilter(baseFilter);
    return {
      summary: "Document empty; removed embeddings.",
      resultRef: { targetType: "document", targetId: documentId, chunks: 0, contentHash },
    };
  }

  await deletePointsByFilter({
    must: [
      ...baseFilter.must!,
      { key: "chunk_index", range: { gte: chunks.length } },
    ],
  });

  const summary =
    updatedChunks === 0
      ? "Document embeddings already up to date."
      : `Embedded document (${updatedChunks}/${chunks.length} chunks).`;

  return {
    summary,
    resultRef: {
      targetType: "document",
      targetId: documentId,
      chunks: chunks.length,
      updatedChunks,
      contentHash,
    },
  };
}

async function embedEntity(
  ctx: ActionCtx,
  job: AnalysisJobRecord,
  entityId: string
): Promise<AnalysisHandlerResult> {
  const entity = await ctx.runQuery((internal as any)["ai/analysisJobs"].getEntityForAnalysis, {
    id: entityId,
  });

  if (!entity) {
    return { summary: "Entity not found; skipping embedding." };
  }

  if (entity.projectId !== job.projectId) {
    throw new Error("Entity project mismatch");
  }

  const text = buildEntityText({
    name: entity.name,
    aliases: entity.aliases,
    notes: entity.notes ?? null,
    properties: entity.properties ?? null,
  });
  const contentHash = await hashText(text);
  const chunks = chunkText(text);
  const isoNow = new Date().toISOString();
  let updatedChunks = 0;

  let existingHashes: Map<number, string> | null = null;
  if (chunks.length > 0) {
    existingHashes = await fetchExistingChunkHashes({
      projectId: String(job.projectId),
      targetType: "entity",
      targetId: entityId,
      expectedCount: chunks.length,
    });
  }

  const chunkData = chunks.map((chunkTextValue, index) => ({
    index,
    text: chunkTextValue,
    hash: hashChunk(chunkTextValue),
  }));
  const chunksToEmbed = existingHashes
    ? chunkData.filter((chunk) => existingHashes?.get(chunk.index) !== chunk.hash)
    : chunkData;

  for (let i = 0; i < chunksToEmbed.length; i += MAX_EMBED_BATCH) {
    const slice = chunksToEmbed.slice(i, i + MAX_EMBED_BATCH);
    const { embeddings } = await generateEmbeddings(
      slice.map((chunk) => chunk.text),
      { task: "embed_document" }
    );

    const points: QdrantPoint[] = embeddings.map((vector, idx) => {
      const chunk = slice[idx];
      return {
        id: `entity:${entityId}:${chunk.index}`,
        vector,
        payload: {
          type: "entity",
          project_id: String(job.projectId),
          entity_id: entityId,
          entity_type: entity.type,
          title: entity.name,
          text: chunk.text,
          preview: chunk.text.slice(0, 200),
          chunk_index: chunk.index,
          chunk_hash: chunk.hash,
          updated_at: isoNow,
        },
      };
    });

    if (points.length > 0) {
      await upsertPoints(points);
    }

    updatedChunks += slice.length;
  }

  const baseFilter: QdrantFilter = {
    must: [
      { key: "project_id", match: { value: String(job.projectId) } },
      { key: "type", match: { value: "entity" } },
      { key: "entity_id", match: { value: entityId } },
    ],
  };

  if (chunks.length === 0) {
    await deletePointsByFilter(baseFilter);
    return {
      summary: "Entity empty; removed embeddings.",
      resultRef: { targetType: "entity", targetId: entityId, chunks: 0, contentHash },
    };
  }

  await deletePointsByFilter({
    must: [
      ...baseFilter.must!,
      { key: "chunk_index", range: { gte: chunks.length } },
    ],
  });

  const summary =
    updatedChunks === 0
      ? "Entity embeddings already up to date."
      : `Embedded entity (${updatedChunks}/${chunks.length} chunks).`;

  return {
    summary,
    resultRef: {
      targetType: "entity",
      targetId: entityId,
      chunks: chunks.length,
      updatedChunks,
      contentHash,
    },
  };
}

async function embedMemory(
  ctx: ActionCtx,
  job: AnalysisJobRecord,
  memoryId: string
): Promise<AnalysisHandlerResult> {
  const memory = await ctx.runQuery((internal as any)["ai/analysisJobs"].getMemoryForAnalysis, {
    id: memoryId,
  });

  if (!memory) {
    return { summary: "Memory not found; skipping embedding." };
  }

  if (memory.projectId !== job.projectId) {
    throw new Error("Memory project mismatch");
  }

  const vectorId =
    typeof memory.vectorId === "string" && memory.vectorId.length > 0
      ? memory.vectorId
      : String(memory._id);
  const text = typeof memory.text === "string" ? memory.text.trim() : "";
  if (!text) {
    await deletePoints([vectorId]);
    return { summary: "Memory empty; removed embeddings." };
  }

  const embeddingText =
    text.length > MAX_MEMORY_EMBED_CHARS ? text.slice(0, MAX_MEMORY_EMBED_CHARS) : text;
  const embedding = await generateEmbedding(embeddingText, { task: "embed_document" });

  const payload = buildMemoryPayload(memory as Record<string, unknown>, String(job.projectId));
  await upsertPoints([
    {
      id: vectorId,
      vector: embedding,
      payload,
    },
  ]);

  await ctx.runMutation((internal as any).memories.updateVectorStatus, {
    memoryId: memory._id,
    vectorId,
  });

  return {
    summary: "Embedded memory.",
    resultRef: { targetType: "memory", targetId: memoryId },
  };
}

async function deleteMemoryEmbedding(
  memoryVectorId: string
): Promise<AnalysisHandlerResult> {
  await deletePoints([memoryVectorId]);
  return {
    summary: "Deleted memory embedding.",
    resultRef: { targetType: "memory_delete", targetId: memoryVectorId },
  };
}

export async function runEmbeddingGenerationJob(
  ctx: ActionCtx,
  job: AnalysisJobRecord
): Promise<AnalysisHandlerResult> {
  const payload = parseEmbeddingPayload(
    job.payload,
    job.documentId ? String(job.documentId) : undefined
  );

  if (!payload) {
    return { summary: "Embedding job missing target info; skipping." };
  }

  if (!isQdrantConfigured()) {
    throw new Error("qdrant_unconfigured");
  }

  if (payload.targetType !== "memory_delete" && !isDeepInfraConfigured()) {
    throw new Error("deepinfra_unconfigured");
  }

  switch (payload.targetType) {
    case "document":
      return await embedDocument(ctx, job, payload.targetId);
    case "entity":
      return await embedEntity(ctx, job, payload.targetId);
    case "memory":
      return await embedMemory(ctx, job, payload.targetId);
    case "memory_delete":
      return await deleteMemoryEmbedding(payload.targetId);
    default:
      return { summary: `Unsupported embedding target type: ${payload.targetType}` };
  }
}
