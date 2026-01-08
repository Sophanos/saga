/**
 * Embedding outbox processor for documents and entities.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { generateEmbeddings, isDeepInfraConfigured } from "../lib/embeddings";
import { upsertPoints, isQdrantConfigured, type QdrantPoint } from "../lib/qdrant";

const DEFAULT_BATCH_SIZE = 10;
const MAX_EMBED_BATCH = 16;
const MAX_CHUNK_CHARS = 1200;

interface EmbeddingJobRecord {
  _id: Id<"embeddingJobs">;
  projectId: Id<"projects">;
  targetType: string;
  targetId: string;
  status: string;
  attempts: number;
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

export const enqueueEmbeddingJob = internalMutation({
  args: {
    projectId: v.id("projects"),
    targetType: v.string(),
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
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
      const nextStatus = existing.status === "failed" ? "pending" : existing.status;
      await ctx.db.patch(existing._id, {
        status: nextStatus,
        attempts: nextStatus === "pending" ? 0 : existing.attempts,
        lastError: null,
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
      lastError: null,
      chunksProcessed: 0,
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
    return await ctx.db
      .query("embeddingJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(batchLimit);
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
      lastError: null,
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
  },
  handler: async (ctx, { jobId, chunksProcessed }) => {
    await ctx.db.patch(jobId, {
      status: "synced",
      chunksProcessed,
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

const getDocument = internalQuery({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

const getEntity = internalQuery({
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

    const jobs = await ctx.runQuery(getPendingJobs, { limit: batchSize });

    for (const job of jobs as EmbeddingJobRecord[]) {
      await ctx.runMutation(markProcessing, { jobId: job._id });

      try {
        if (job.targetType === "document") {
          const doc = await ctx.runQuery(getDocument, {
            id: job.targetId as Id<"documents">,
          });

          if (!doc) {
            throw new Error("Document not found");
          }

          if (doc.projectId !== job.projectId) {
            throw new Error("Document project mismatch");
          }

          const contentText = doc.contentText ?? "";
          const chunks = chunkText(contentText);
          const isoNow = new Date().toISOString();
          let processed = 0;

          for (let i = 0; i < chunks.length; i += MAX_EMBED_BATCH) {
            const slice = chunks.slice(i, i + MAX_EMBED_BATCH);
            const { embeddings } = await generateEmbeddings(slice);

            const points: QdrantPoint[] = embeddings.map((vector, idx) => {
              const chunkIndex = i + idx;
              const text = slice[idx];
              return {
                id: `document:${job.targetId}:${chunkIndex}`,
                vector,
                payload: {
                  type: "document",
                  project_id: job.projectId,
                  document_id: job.targetId,
                  title: doc.title ?? "Untitled",
                  document_type: doc.type ?? "document",
                  text,
                  preview: text.slice(0, 200),
                  chunk_index: chunkIndex,
                  updated_at: isoNow,
                },
              };
            });

            if (points.length > 0) {
              await upsertPoints(points);
            }

            processed += slice.length;
            await ctx.runMutation(updateProgress, {
              jobId: job._id,
              chunksProcessed: processed,
            });
          }

          await ctx.runMutation(markSynced, {
            jobId: job._id,
            chunksProcessed: processed,
          });
        } else if (job.targetType === "entity") {
          const entity = await ctx.runQuery(getEntity, {
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
          const chunks = chunkText(text);
          const isoNow = new Date().toISOString();
          let processed = 0;

          for (let i = 0; i < chunks.length; i += MAX_EMBED_BATCH) {
            const slice = chunks.slice(i, i + MAX_EMBED_BATCH);
            const { embeddings } = await generateEmbeddings(slice);

            const points: QdrantPoint[] = embeddings.map((vector, idx) => {
              const chunkIndex = i + idx;
              const chunkTextValue = slice[idx];
              return {
                id: `entity:${job.targetId}:${chunkIndex}`,
                vector,
                payload: {
                  type: "entity",
                  project_id: job.projectId,
                  entity_id: job.targetId,
                  entity_type: entity.type,
                  title: entity.name,
                  text: chunkTextValue,
                  preview: chunkTextValue.slice(0, 200),
                  chunk_index: chunkIndex,
                  updated_at: isoNow,
                },
              };
            });

            if (points.length > 0) {
              await upsertPoints(points);
            }

            processed += slice.length;
            await ctx.runMutation(updateProgress, {
              jobId: job._id,
              chunksProcessed: processed,
            });
          }

          await ctx.runMutation(markSynced, {
            jobId: job._id,
            chunksProcessed: processed,
          });
        } else {
          throw new Error(`Unsupported embedding target type: ${job.targetType}`);
        }
      } catch (error) {
        await ctx.runMutation(markFailed, {
          jobId: job._id,
          error: error instanceof Error ? error.message : "Embedding job failed",
        });
      }
    }
  },
});
