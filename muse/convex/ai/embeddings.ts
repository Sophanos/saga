/**
 * Embedding outbox processor for documents and entities.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { generateEmbeddings, isDeepInfraConfigured } from "../lib/embeddings";
import {
  isQdrantConfigured,
  namedDense,
  scrollPoints,
  type QdrantFilter,
  type QdrantPoint,
} from "../lib/qdrant";
import {
  deletePointsByFilterForWrite,
  getReadQdrantConfig,
  QDRANT_TEXT_VECTOR,
  upsertPointsForWrite,
} from "../lib/qdrantCollections";

const DEFAULT_BATCH_SIZE = 5;
const MAX_EMBED_BATCH = 8;
const MAX_CHUNK_CHARS = 1200;
const EMBEDDING_QUEUE_DEBOUNCE_MS = 15000;
const EMBEDDING_JOB_LEASE_MS = 5 * 60 * 1000;
const EMBEDDING_JOB_MAX_ATTEMPTS = 5;
const EMBEDDING_JOB_BACKOFF_BASE_MS = 30 * 1000;
const EMBEDDING_JOB_BACKOFF_MAX_MS = 15 * 60 * 1000;
const EMBEDDING_JOB_CLEANUP_FAILED_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const EMBEDDING_JOB_STALE_SCAN_LIMIT = 50;
const EMBEDDING_JOB_CLEANUP_SCAN_LIMIT = 50;
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
  nextRunAt?: number;
  processingRunId?: string;
  processingStartedAt?: number;
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

function computeBackoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const baseDelay = EMBEDDING_JOB_BACKOFF_BASE_MS * Math.pow(2, exponent);
  const capped = Math.min(baseDelay, EMBEDDING_JOB_BACKOFF_MAX_MS);
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.round(capped * jitter);
}

function getEffectiveNextRunAt(job: {
  nextRunAt?: number;
  queuedAt?: number;
  updatedAt?: number;
  createdAt?: number;
}): number {
  return job.nextRunAt ?? job.queuedAt ?? job.updatedAt ?? job.createdAt ?? 0;
}

function isPermanentEmbeddingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not found") ||
    normalized.includes("project mismatch") ||
    normalized.includes("unsupported embedding target")
  );
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

  const points = await scrollPoints(
    filter,
    expectedCount,
    { orderBy: { key: "chunk_index", direction: "asc" } },
    getReadQdrantConfig("text")
  );
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
    const nextRunAt = now + EMBEDDING_QUEUE_DEBOUNCE_MS;
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
          nextRunAt: status === "pending" ? nextRunAt : activeJob.nextRunAt,
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
        nextRunAt,
        processingRunId: undefined,
        processingStartedAt: undefined,
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
      nextRunAt,
      processingRunId: undefined,
      processingStartedAt: undefined,
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
    const now = Date.now();

    const ready = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_status_nextRunAt", (q) =>
        q.eq("status", "pending").lte("nextRunAt", now)
      )
      .take(batchLimit);

    if (ready.length >= batchLimit) {
      return ready;
    }

    const oversampleLimit = Math.min(batchLimit * 3, 50);
    const fallback = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(oversampleLimit);

    const seen = new Set(ready.map((job) => job._id));
    const merged = [...ready];

    for (const job of fallback) {
      if (merged.length >= batchLimit) break;
      if (seen.has(job._id)) continue;
      if (getEffectiveNextRunAt(job) <= now) {
        merged.push(job);
        seen.add(job._id);
      }
    }

    return merged;
  },
});

export const claimEmbeddingJob = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
  },
  handler: async (ctx, { jobId }) => {
    const now = Date.now();
    const job = await ctx.db.get(jobId);
    if (!job) return { claimed: false as const };

    if (job.status !== "pending") {
      return { claimed: false as const };
    }

    if (job.nextRunAt && job.nextRunAt > now) {
      return { claimed: false as const };
    }

    if (job.attempts >= EMBEDDING_JOB_MAX_ATTEMPTS) {
      await ctx.db.patch(jobId, {
        status: "failed",
        lastError: "max_attempts_exceeded",
        failedAt: now,
        updatedAt: now,
      });
      return { claimed: false as const };
    }

    const runId = crypto.randomUUID();
    await ctx.db.patch(jobId, {
      status: "processing",
      attempts: (job.attempts ?? 0) + 1,
      lastError: undefined,
      dirty: false,
      processingRunId: runId,
      processingStartedAt: now,
      nextRunAt: undefined,
      updatedAt: now,
    });

    return { claimed: true as const, runId };
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

export const finalizeEmbeddingJob = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
    chunksProcessed: v.number(),
    processedContentHash: v.string(),
    processingRunId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    if (job.processingRunId !== args.processingRunId) return;

    const desiredHash = job.desiredContentHash ?? args.processedContentHash;
    const shouldRequeue = Boolean(job.dirty && desiredHash !== args.processedContentHash);

    if (shouldRequeue) {
      await ctx.db.patch(args.jobId, {
        status: "pending",
        chunksProcessed: 0,
        desiredContentHash: desiredHash,
        processedContentHash: args.processedContentHash,
        dirty: false,
        queuedAt: now,
        nextRunAt: now + EMBEDDING_QUEUE_DEBOUNCE_MS,
        processingRunId: undefined,
        processingStartedAt: undefined,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.patch(args.jobId, {
      status: "synced",
      chunksProcessed: args.chunksProcessed,
      processedContentHash: args.processedContentHash,
      desiredContentHash: args.processedContentHash,
      dirty: false,
      processingRunId: undefined,
      processingStartedAt: undefined,
      updatedAt: now,
    });
  },
});

export const recordEmbeddingFailure = internalMutation({
  args: {
    jobId: v.id("embeddingJobs"),
    processingRunId: v.string(),
    error: v.string(),
    permanent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    if (job.processingRunId !== args.processingRunId) return;

    const attempts = job.attempts ?? 0;
    const shouldRetry = !args.permanent && attempts < EMBEDDING_JOB_MAX_ATTEMPTS;

    await ctx.db.patch(args.jobId, {
      status: shouldRetry ? "pending" : "failed",
      lastError: args.error,
      dirty: false,
      queuedAt: shouldRetry ? now : job.queuedAt,
      nextRunAt: shouldRetry ? now + computeBackoffMs(attempts) : undefined,
      processingRunId: undefined,
      processingStartedAt: undefined,
      failedAt: shouldRetry ? undefined : now,
      updatedAt: now,
    });
  },
});

export const requeueStaleProcessingJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - EMBEDDING_JOB_LEASE_MS;
    const stale = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_status_processingStartedAt", (q) =>
        q.eq("status", "processing").lt("processingStartedAt", cutoff)
      )
      .take(EMBEDDING_JOB_STALE_SCAN_LIMIT);

    let reclaimed = 0;
    let failed = 0;

    for (const job of stale) {
      if ((job.attempts ?? 0) >= EMBEDDING_JOB_MAX_ATTEMPTS) {
        await ctx.db.patch(job._id, {
          status: "failed",
          lastError: "processing_lease_expired",
          failedAt: now,
          processingRunId: undefined,
          processingStartedAt: undefined,
          updatedAt: now,
        });
        failed += 1;
        continue;
      }

      await ctx.db.patch(job._id, {
        status: "pending",
        lastError: "processing_lease_expired",
        queuedAt: now,
        nextRunAt: now,
        processingRunId: undefined,
        processingStartedAt: undefined,
        updatedAt: now,
      });
      reclaimed += 1;
    }

    return { reclaimed, failed };
  },
});

export const deleteEmbeddingJobsForTarget = internalMutation({
  args: {
    projectId: v.id("projects"),
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_project_target", (q) =>
        q
          .eq("projectId", args.projectId)
          .eq("targetType", args.targetType)
          .eq("targetId", args.targetId)
      )
      .collect();

    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    return jobs.length;
  },
});

export const cleanupEmbeddingJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expiredCutoff = now - EMBEDDING_JOB_CLEANUP_FAILED_AFTER_MS;

    const failedJobs = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .take(EMBEDDING_JOB_CLEANUP_SCAN_LIMIT);

    let removed = 0;
    let failedExpired = 0;

    for (const job of failedJobs) {
      const updatedAt = job.updatedAt ?? job.createdAt ?? 0;
      if (updatedAt < expiredCutoff) {
        await ctx.db.delete(job._id);
        failedExpired += 1;
      }
    }

    const pendingJobs = await ctx.db
      .query("embeddingJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(EMBEDDING_JOB_CLEANUP_SCAN_LIMIT);

    for (const job of pendingJobs) {
      if (job.targetType === "document") {
        const doc = await ctx.db.get(job.targetId as Id<"documents">);
        if (!doc) {
          await ctx.db.delete(job._id);
          removed += 1;
        }
      } else if (job.targetType === "entity") {
        const entity = await ctx.db.get(job.targetId as Id<"entities">);
        if (!entity) {
          await ctx.db.delete(job._id);
          removed += 1;
        }
      }
    }

    return { removed, failedExpired };
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
      const claim = await ctx.runMutation(internal.ai.embeddings.claimEmbeddingJob, {
        jobId: job._id,
      });

      if (!claim.claimed) {
        continue;
      }

      const runId = claim.runId;

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
                vector: namedDense(QDRANT_TEXT_VECTOR, vector),
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
              await upsertPointsForWrite(points, "text");
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
            await deletePointsByFilterForWrite(baseFilter, "text");
          } else {
            await deletePointsByFilterForWrite({
              must: [
                ...baseFilter.must!,
                { key: "chunk_index", range: { gte: chunks.length } },
              ],
            }, "text");
          }

          await ctx.runMutation(internal.ai.embeddings.finalizeEmbeddingJob, {
            jobId: job._id,
            chunksProcessed: chunks.length,
            processedContentHash: contentHash,
            processingRunId: runId,
          });
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
                vector: namedDense(QDRANT_TEXT_VECTOR, vector),
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
              await upsertPointsForWrite(points, "text");
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
            await deletePointsByFilterForWrite(baseFilter, "text");
          } else {
            await deletePointsByFilterForWrite({
              must: [
                ...baseFilter.must!,
                { key: "chunk_index", range: { gte: chunks.length } },
              ],
            }, "text");
          }

          await ctx.runMutation(internal.ai.embeddings.finalizeEmbeddingJob, {
            jobId: job._id,
            chunksProcessed: chunks.length,
            processedContentHash: contentHash,
            processingRunId: runId,
          });
        } else {
          throw new Error(`Unsupported embedding target type: ${job.targetType}`);
        }
      } catch (error) {
        await ctx.runMutation(internal.ai.embeddings.recordEmbeddingFailure, {
          jobId: job._id,
          processingRunId: runId,
          error: error instanceof Error ? error.message : "Embedding job failed",
          permanent: isPermanentEmbeddingError(error),
        });
      }
    }
  },
});
