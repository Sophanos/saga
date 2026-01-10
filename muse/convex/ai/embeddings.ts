/**
 * Embedding outbox processor for documents and entities.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateEmbeddings, isDeepInfraConfigured } from "../lib/embeddings";
import {
  deletePointsByFilter,
  isQdrantConfigured,
  scrollPoints,
  type QdrantFilter,
  type QdrantPoint,
  upsertPoints,
} from "../lib/qdrant";

const DEFAULT_BATCH_SIZE = 10;
const MAX_EMBED_BATCH = 16;
const MAX_CHUNK_CHARS = 1200;
const EMBEDDING_QUEUE_COOLDOWN_MS = 15000;
const MAX_EXISTING_CHUNK_SCAN = 500;

interface EmbeddingJobRecord {
  _id: Id<"embeddingJobs">;
  projectId: Id<"projects">;
  targetType: string;
  targetId: string;
  status: string;
  attempts: number;
  desiredContentHash?: string;
  processedContentHash?: string;
  dirty?: boolean;
  queuedAt?: number;
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

async function getDesiredContentHash(
  ctx: { db: { get: (id: Id<"documents"> | Id<"entities">) => Promise<any> } },
  targetType: string,
  targetId: string
): Promise<string | undefined> {
  if (targetType === "document") {
    const doc = await ctx.db.get(targetId as Id<"documents">);
    if (!doc) return undefined;
    const contentText = doc.contentText ?? "";
    return await hashText(contentText);
  }

  if (targetType === "entity") {
    const entity = await ctx.db.get(targetId as Id<"entities">);
    if (!entity) return undefined;
    const text = buildEntityText({
      name: entity.name,
      aliases: entity.aliases,
      notes: entity.notes ?? null,
      properties: entity.properties ?? null,
    });
    return await hashText(text);
  }

  return undefined;
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

export const enqueueEmbeddingJob = internalMutation({
  args: {
    projectId: v.id("projects"),
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const desiredContentHash = await getDesiredContentHash(
      ctx,
      args.targetType,
      args.targetId
    );
    const activeStatuses = ["pending", "processing"] as const;

    for (const status of activeStatuses) {
      const activeJob = await ctx.db
        .query("embeddingJobs")
        .withIndex("by_target_status", (q) =>
          q.eq("targetType", args.targetType).eq("targetId", args.targetId).eq("status", status)
        )
        .first();
      if (activeJob) {
        await ctx.db.patch(activeJob._id, {
          desiredContentHash,
          queuedAt: now,
          updatedAt: now,
          dirty: status === "processing",
        });
        return activeJob._id;
      }
    }

    const existing = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_project_target", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        attempts: 0,
        lastError: undefined,
        chunksProcessed: 0,
        desiredContentHash,
        dirty: false,
        queuedAt: now,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("embeddingJobs", {
      projectId: args.projectId,
      targetType: args.targetType,
      targetId: args.targetId,
      status: "pending",
      attempts: 0,
      lastError: undefined,
      chunksProcessed: 0,
      desiredContentHash,
      processedContentHash: undefined,
      dirty: false,
      queuedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getPendingJobs = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit }) => {
    const batchLimit = Math.max(1, Math.min(limit ?? DEFAULT_BATCH_SIZE, 50));
    const oversampleLimit = Math.min(batchLimit * 3, 50);
    const now = Date.now();
    const cutoff = now - EMBEDDING_QUEUE_COOLDOWN_MS;

    const pending = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(oversampleLimit);

    return pending
      .filter((job) => {
        const queuedAt = job.queuedAt ?? job.updatedAt ?? job.createdAt ?? 0;
        return queuedAt <= cutoff;
      })
      .slice(0, batchLimit);
  },
});

export const markProcessing = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) throw new Error("Embedding job not found");

    await ctx.db.patch(jobId, {
      status: "processing",
      attempts: (job.attempts ?? 0) + 1,
      lastError: undefined,
      dirty: false,
      updatedAt: Date.now(),
    });
  },
});

export const updateProgress = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
    chunksProcessed: v.number(),
  },
  handler: async (ctx, { jobId, chunksProcessed }) => {
    await ctx.db.patch(jobId, {
      chunksProcessed,
      updatedAt: Date.now(),
    });
  },
});

export const markSynced = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
    chunksProcessed: v.number(),
    processedContentHash: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, chunksProcessed, processedContentHash }) => {
    await ctx.db.patch(jobId, {
      status: "synced",
      chunksProcessed,
      processedContentHash,
      desiredContentHash: processedContentHash,
      dirty: false,
      updatedAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
    error: v.string(),
  },
  handler: async (ctx, { jobId, error }) => {
    await ctx.db.patch(jobId, {
      status: "failed",
      lastError: error,
      updatedAt: Date.now(),
    });
  },
});

export const getDocument = internalQuery({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getEntity = internalQuery({
  args: {
    id: v.id("entities"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const getEmbeddingJob = internalQuery({
  args: {
    id: v.id("embeddingJobs"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const requeueEmbeddingJob = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
    desiredContentHash: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, desiredContentHash }) => {
    const now = Date.now();
    await ctx.db.patch(jobId, {
      status: "pending",
      attempts: 0,
      lastError: undefined,
      chunksProcessed: 0,
      desiredContentHash,
      dirty: false,
      queuedAt: now,
      updatedAt: now,
    });
  },
});

export const processEmbeddingJobs = internalAction({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, { batchSize }) => {
    if (!isQdrantConfigured()) {
      console.warn("[embeddings] Qdrant not configured; skipping sync");
      return;
    }

    if (!isDeepInfraConfigured()) {
      console.warn("[embeddings] DeepInfra not configured; skipping sync");
      return;
    }

    const jobs = await ctx.runQuery(internal.ai.embeddings.getPendingJobs, { limit: batchSize });

    for (const job of jobs as EmbeddingJobRecord[]) {
      await ctx.runMutation(internal.ai.embeddings.markProcessing, { jobId: job._id });

      try {
        if (job.targetType === "document") {
          const doc = await ctx.runQuery(internal.ai.embeddings.getDocument, {
            id: job.targetId as Id<"documents">,
          });

          if (!doc) {
            throw new Error("Document not found");
          }

          if (doc.projectId !== job.projectId) {
            throw new Error("Document project mismatch");
          }

          const contentText = doc.contentText ?? "";
          const contentHash = await hashText(contentText);
          const chunks = chunkText(contentText);
          const isoNow = new Date().toISOString();
          let processed = 0;

          let existingHashes: Map<number, string> | null = null;
          if (chunks.length > 0) {
            existingHashes = await fetchExistingChunkHashes({
              projectId: String(job.projectId),
              targetType: "document",
              targetId: job.targetId,
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
                id: `document:${job.targetId}:${chunk.index}`,
                vector,
                payload: {
                  type: "document",
                  project_id: job.projectId,
                  document_id: job.targetId,
                  title: doc.title ?? "Untitled",
                  document_type: doc.type ?? "document",
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

            processed += slice.length;
            await ctx.runMutation(internal.ai.embeddings.updateProgress, {
              jobId: job._id,
              chunksProcessed: processed,
            });
          }

          const baseFilter: QdrantFilter = {
            must: [
              { key: "project_id", match: { value: String(job.projectId) } },
              { key: "type", match: { value: "document" } },
              { key: "document_id", match: { value: job.targetId } },
            ],
          };

          if (chunks.length === 0) {
            await deletePointsByFilter(baseFilter);
          } else {
            await deletePointsByFilter({
              must: [
                ...baseFilter.must!,
                { key: "chunk_index", range: { gte: chunks.length } },
              ],
            });
          }

          const latestJob = await ctx.runQuery(internal.ai.embeddings.getEmbeddingJob, {
            id: job._id,
          });
          const desiredHash = latestJob?.desiredContentHash ?? contentHash;
          const shouldRequeue = Boolean(
            latestJob?.dirty && desiredHash && desiredHash !== contentHash
          );

          if (shouldRequeue) {
            await ctx.runMutation(internal.ai.embeddings.requeueEmbeddingJob, {
              jobId: job._id,
              desiredContentHash: desiredHash,
            });
          } else {
            await ctx.runMutation(internal.ai.embeddings.markSynced, {
              jobId: job._id,
              chunksProcessed: chunks.length,
              processedContentHash: contentHash,
            });
          }
        } else if (job.targetType === "entity") {
          const entity = await ctx.runQuery(internal.ai.embeddings.getEntity, {
            id: job.targetId as Id<"entities">,
          });

          if (!entity) {
            throw new Error("Entity not found");
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
          let processed = 0;

          let existingHashes: Map<number, string> | null = null;
          if (chunks.length > 0) {
            existingHashes = await fetchExistingChunkHashes({
              projectId: String(job.projectId),
              targetType: "entity",
              targetId: job.targetId,
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
                id: `entity:${job.targetId}:${chunk.index}`,
                vector,
                payload: {
                  type: "entity",
                  project_id: job.projectId,
                  entity_id: job.targetId,
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

            processed += slice.length;
            await ctx.runMutation(internal.ai.embeddings.updateProgress, {
              jobId: job._id,
              chunksProcessed: processed,
            });
          }

          const baseFilter: QdrantFilter = {
            must: [
              { key: "project_id", match: { value: String(job.projectId) } },
              { key: "type", match: { value: "entity" } },
              { key: "entity_id", match: { value: job.targetId } },
            ],
          };

          if (chunks.length === 0) {
            await deletePointsByFilter(baseFilter);
          } else {
            await deletePointsByFilter({
              must: [
                ...baseFilter.must!,
                { key: "chunk_index", range: { gte: chunks.length } },
              ],
            });
          }

          const latestJob = await ctx.runQuery(internal.ai.embeddings.getEmbeddingJob, {
            id: job._id,
          });
          const desiredHash = latestJob?.desiredContentHash ?? contentHash;
          const shouldRequeue = Boolean(
            latestJob?.dirty && desiredHash && desiredHash !== contentHash
          );

          if (shouldRequeue) {
            await ctx.runMutation(internal.ai.embeddings.requeueEmbeddingJob, {
              jobId: job._id,
              desiredContentHash: desiredHash,
            });
          } else {
            await ctx.runMutation(internal.ai.embeddings.markSynced, {
              jobId: job._id,
              chunksProcessed: chunks.length,
              processedContentHash: contentHash,
            });
          }
        } else {
          throw new Error(`Unsupported embedding target type: ${job.targetType}`);
        }
      } catch (error) {
        await ctx.runMutation(internal.ai.embeddings.markFailed, {
          jobId: job._id,
          error: error instanceof Error ? error.message : "Embedding job failed",
        });
      }
    }
  },
});
