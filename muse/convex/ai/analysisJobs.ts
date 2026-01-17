import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const ANALYSIS_JOB_KINDS = [
  "detect_entities",
  "coherence_lint",
  "clarity_check",
  "policy_check",
  "digest_document",
  "embedding_generation",
] as const;

export type AnalysisJobKind = (typeof ANALYSIS_JOB_KINDS)[number];

export type AnalysisJobRecord = {
  _id: Id<"analysisJobs">;
  projectId: Id<"projects">;
  userId: string;
  documentId?: Id<"documents">;
  kind: string;
  status: string;
  attempts: number;
  lastError?: string;
  scheduledFor: number;
  contentHash?: string;
  dedupeKey?: string;
  processingRunId?: string;
  processingStartedAt?: number;
  leaseExpiresAt?: number;
  payload: unknown;
  resultSummary?: string;
  resultRef?: unknown;
  dirty?: boolean;
  createdAt: number;
  updatedAt: number;
};

const DEFAULT_BATCH_SIZE = 10;
const ANALYSIS_JOB_DEBOUNCE_MS = 3000;
const ANALYSIS_JOB_LEASE_MS = 5 * 60 * 1000;
const ANALYSIS_JOB_MAX_ATTEMPTS = 5;
const ANALYSIS_JOB_BACKOFF_BASE_MS = 30 * 1000;
const ANALYSIS_JOB_BACKOFF_MAX_MS = 15 * 60 * 1000;
const ANALYSIS_JOB_CLEANUP_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const ANALYSIS_JOB_CLEANUP_SCAN_LIMIT = 50;
const ANALYSIS_JOB_STALE_SCAN_LIMIT = 50;
const EMBEDDING_JOB_KIND = "embedding_generation";
const EMBEDDING_JOB_DEBOUNCE_MS = 15000;
const embeddingTargetSchema = v.union(
  v.literal("document"),
  v.literal("entity"),
  v.literal("memory"),
  v.literal("memory_delete")
);

function computeBackoffMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const baseDelay = ANALYSIS_JOB_BACKOFF_BASE_MS * Math.pow(2, exponent);
  const capped = Math.min(baseDelay, ANALYSIS_JOB_BACKOFF_MAX_MS);
  const jitter = 0.8 + Math.random() * 0.4;
  return Math.round(capped * jitter);
}

function buildDedupeKey(args: {
  projectId: string;
  documentId?: string;
  kind: string;
  dedupeKey?: string;
}): string | undefined {
  if (args.dedupeKey) return args.dedupeKey;
  if (args.documentId) return `${args.kind}:${args.documentId}`;
  return `${args.kind}:${args.projectId}`;
}

function buildEmbeddingDedupeKey(targetType: string, targetId: string): string {
  return `${EMBEDDING_JOB_KIND}:${targetType}:${targetId}`;
}

async function enqueueJob(
  ctx: MutationCtx,
  args: {
    projectId: Id<"projects">;
    userId: string;
    documentId?: Id<"documents">;
    kind: string;
    payload: unknown;
    contentHash?: string;
    dedupeKey?: string;
    debounceMs?: number;
  }
): Promise<{ jobId: Id<"analysisJobs">; status: string }> {
  const now = Date.now();
  const debounceMs = Math.max(0, args.debounceMs ?? ANALYSIS_JOB_DEBOUNCE_MS);
  const scheduledFor = now + debounceMs;
  const dedupeKey = buildDedupeKey({
    projectId: String(args.projectId),
    documentId: args.documentId ? String(args.documentId) : undefined,
    kind: args.kind,
    dedupeKey: args.dedupeKey,
  });

  if (dedupeKey) {
    const active = await ctx.db
      .query("analysisJobs")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "processing"))
      )
      .first();

    if (active) {
      await ctx.db.patch(active._id, {
        payload: args.payload,
        contentHash: args.contentHash,
        scheduledFor: active.status === "pending" ? scheduledFor : active.scheduledFor,
        updatedAt: now,
        dirty: active.status === "processing" ? true : active.dirty,
      });
      return { jobId: active._id, status: active.status };
    }
  }

  const jobId = await ctx.db.insert("analysisJobs", {
    projectId: args.projectId,
    userId: args.userId,
    documentId: args.documentId,
    kind: args.kind,
    status: "pending",
    attempts: 0,
    lastError: undefined,
    scheduledFor,
    contentHash: args.contentHash,
    dedupeKey,
    processingRunId: undefined,
    processingStartedAt: undefined,
    leaseExpiresAt: undefined,
    payload: args.payload,
    resultSummary: undefined,
    resultRef: undefined,
    dirty: false,
    createdAt: now,
    updatedAt: now,
  });

  return { jobId, status: "pending" };
}

export const enqueueAnalysisJob = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    documentId: v.optional(v.id("documents")),
    kind: v.string(),
    payload: v.any(),
    contentHash: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    debounceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await enqueueJob(ctx, {
      projectId: args.projectId,
      userId: args.userId,
      documentId: args.documentId,
      kind: args.kind,
      payload: args.payload,
      contentHash: args.contentHash,
      dedupeKey: args.dedupeKey,
      debounceMs: args.debounceMs,
    });
  },
});

export const enqueueEmbeddingJob = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.optional(v.string()),
    targetType: embeddingTargetSchema,
    targetId: v.string(),
    documentId: v.optional(v.id("documents")),
    debounceMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = args.userId ?? "system";
    const dedupeKey = buildEmbeddingDedupeKey(args.targetType, args.targetId);
    const documentId =
      args.documentId ??
      (args.targetType === "document" ? (args.targetId as Id<"documents">) : undefined);

    return await enqueueJob(ctx, {
      projectId: args.projectId,
      userId,
      documentId,
      kind: EMBEDDING_JOB_KIND,
      payload: {
        targetType: args.targetType,
        targetId: args.targetId,
      },
      dedupeKey,
      debounceMs: args.debounceMs ?? EMBEDDING_JOB_DEBOUNCE_MS,
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

    return ctx.db
      .query("analysisJobs")
      .withIndex("by_status_scheduledFor", (q) =>
        q.eq("status", "pending").lte("scheduledFor", now)
      )
      .take(batchLimit);
  },
});

export const claimAnalysisJob = internalMutation({
  args: {
    jobId: v.id("analysisJobs"),
  },
  handler: async (ctx, { jobId }) => {
    const now = Date.now();
    const job = await ctx.db.get(jobId);
    if (!job) return { claimed: false as const };

    if (job.status !== "pending") {
      return { claimed: false as const };
    }

    if (job.scheduledFor > now) {
      return { claimed: false as const };
    }

    if (job.attempts >= ANALYSIS_JOB_MAX_ATTEMPTS) {
      await ctx.db.patch(jobId, {
        status: "failed",
        lastError: "max_attempts_exceeded",
        updatedAt: now,
      });
      return { claimed: false as const };
    }

    const runId = crypto.randomUUID();
    await ctx.db.patch(jobId, {
      status: "processing",
      attempts: job.attempts + 1,
      processingRunId: runId,
      processingStartedAt: now,
      leaseExpiresAt: now + ANALYSIS_JOB_LEASE_MS,
      updatedAt: now,
      lastError: undefined,
    });

    return { claimed: true as const, runId };
  },
});

export const finalizeAnalysisJob = internalMutation({
  args: {
    jobId: v.id("analysisJobs"),
    runId: v.string(),
    resultSummary: v.optional(v.string()),
    resultRef: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.processingRunId !== args.runId) return;

    const now = Date.now();
    const shouldRequeue = job.dirty === true;

    await ctx.db.patch(args.jobId, {
      status: shouldRequeue ? "pending" : "succeeded",
      scheduledFor: shouldRequeue ? now + ANALYSIS_JOB_DEBOUNCE_MS : job.scheduledFor,
      processingRunId: undefined,
      processingStartedAt: undefined,
      leaseExpiresAt: undefined,
      resultSummary: args.resultSummary ?? job.resultSummary,
      resultRef: args.resultRef ?? job.resultRef,
      dirty: shouldRequeue ? false : job.dirty,
      updatedAt: now,
    });
  },
});

export const markAnalysisJobFailed = internalMutation({
  args: {
    jobId: v.id("analysisJobs"),
    runId: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.processingRunId !== args.runId) return;

    const now = Date.now();
    const attempts = job.attempts;
    const reachedMax = attempts >= ANALYSIS_JOB_MAX_ATTEMPTS;

    if (reachedMax) {
      await ctx.db.patch(args.jobId, {
        status: "failed",
        lastError: args.errorMessage,
        processingRunId: undefined,
        processingStartedAt: undefined,
        leaseExpiresAt: undefined,
        updatedAt: now,
      });
      return;
    }

    const scheduledFor = now + computeBackoffMs(attempts);
    await ctx.db.patch(args.jobId, {
      status: "pending",
      lastError: args.errorMessage,
      scheduledFor,
      processingRunId: undefined,
      processingStartedAt: undefined,
      leaseExpiresAt: undefined,
      updatedAt: now,
    });
  },
});

export const requeueStaleProcessingJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const candidates = await ctx.db
      .query("analysisJobs")
      .withIndex("by_status_scheduledFor", (q) =>
        q.eq("status", "processing").lte("scheduledFor", now)
      )
      .take(ANALYSIS_JOB_STALE_SCAN_LIMIT);

    let requeued = 0;

    for (const job of candidates) {
      if (job.leaseExpiresAt && job.leaseExpiresAt > now) continue;
      await ctx.db.patch(job._id, {
        status: "pending",
        scheduledFor: now + computeBackoffMs(job.attempts),
        processingRunId: undefined,
        processingStartedAt: undefined,
        leaseExpiresAt: undefined,
        lastError: "stale_processing_job",
        updatedAt: now,
      });
      requeued += 1;
    }

    return { requeued };
  },
});

export const cleanupAnalysisJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - ANALYSIS_JOB_CLEANUP_AFTER_MS;
    let removed = 0;

    const statuses = ["failed", "succeeded"] as const;
    for (const status of statuses) {
      const candidates = await ctx.db
        .query("analysisJobs")
        .withIndex("by_status_scheduledFor", (q) =>
          q.eq("status", status).lte("scheduledFor", now)
        )
        .take(ANALYSIS_JOB_CLEANUP_SCAN_LIMIT);

      for (const job of candidates) {
        if (job.updatedAt < cutoff) {
          await ctx.db.delete(job._id);
          removed += 1;
        }
      }
    }

    return { removed };
  },
});

export const deleteEmbeddingJobsForTarget = internalMutation({
  args: {
    projectId: v.id("projects"),
    targetType: embeddingTargetSchema,
    targetId: v.string(),
  },
  handler: async (ctx, args) => {
    const dedupeKey = buildEmbeddingDedupeKey(args.targetType, args.targetId);
    const jobs = await ctx.db
      .query("analysisJobs")
      .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey))
      .collect();

    let removed = 0;
    for (const job of jobs) {
      if (job.projectId !== args.projectId || job.kind !== EMBEDDING_JOB_KIND) {
        continue;
      }
      await ctx.db.delete(job._id);
      removed += 1;
    }

    return { removed };
  },
});

export const deleteEmbeddingJobsForProject = internalMutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("analysisJobs")
      .withIndex("by_project_kind", (q) =>
        q.eq("projectId", args.projectId).eq("kind", EMBEDDING_JOB_KIND)
      )
      .collect();

    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }

    return { removed: jobs.length };
  },
});

export const getDocumentForAnalysis = internalQuery({
  args: {
    id: v.id("documents"),
  },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const getEntityForAnalysis = internalQuery({
  args: {
    id: v.id("entities"),
  },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const getMemoryForAnalysis = internalQuery({
  args: {
    id: v.id("memories"),
  },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const createPulseSignalInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    signalType: v.union(
      v.literal("entity_detected"),
      v.literal("voice_drift"),
      v.literal("consistency_issue"),
      v.literal("suggestion")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    targetDocumentId: v.optional(v.id("documents")),
    targetEntityId: v.optional(v.id("entities")),
    context: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    confidence: v.optional(v.number()),
    sourceAgentId: v.optional(v.string()),
    sourceStreamId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("pulseSignals", {
      ...args,
      status: "unread",
      createdAt: now,
      updatedAt: now,
    });
  },
});
