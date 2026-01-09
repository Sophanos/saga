/**
 * Maintenance Jobs
 *
 * Internal mutations/actions called by cron jobs for system maintenance.
 */

import { internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { deletePointsByFilter, isQdrantConfigured, type QdrantFilter } from "./lib/qdrant";

// ============================================================
// Constants
// ============================================================

/** Age in milliseconds after which completed/failed streams are deleted (7 days) */
const STREAM_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Age in milliseconds after which presence records are considered stale (2 minutes) */
const PRESENCE_STALE_AGE_MS = 2 * 60 * 1000;

// ============================================================
// Stream Cleanup
// ============================================================

/**
 * Delete old generation streams that have completed or failed.
 * Keeps streams for 7 days to allow for debugging and replay.
 */
export const cleanupOldStreams = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - STREAM_MAX_AGE_MS;

    // Find old completed streams
    const oldStreams = await ctx.db
      .query("generationStreams")
      .filter((q) =>
        q.and(
          q.lt(q.field("updatedAt"), cutoffTime),
          q.or(
            q.eq(q.field("status"), "done"),
            q.eq(q.field("status"), "error")
          )
        )
      )
      .take(100); // Batch to avoid long-running mutations

    let deletedCount = 0;
    for (const stream of oldStreams) {
      await ctx.db.delete(stream._id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`[maintenance] Cleaned up ${deletedCount} old streams`);
    }

    return { deletedCount };
  },
});

// ============================================================
// AI Usage Aggregation
// ============================================================

/**
 * Aggregate AI usage statistics for billing and analytics.
 * Currently a no-op placeholder for future implementation.
 */
export const aggregateAIUsage = internalMutation({
  args: {},
  handler: async (_ctx) => {
    // Future: Aggregate aiUsage records into daily/monthly summaries
    // For now, this is a placeholder that doesn't do anything
    return { aggregated: 0 };
  },
});

// ============================================================
// Presence Cleanup
// ============================================================

/**
 * Remove stale presence records for users who have disconnected.
 * Presence is considered stale after 2 minutes of no updates.
 */
export const cleanupStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - PRESENCE_STALE_AGE_MS;

    // Find stale presence records
    const stalePresence = await ctx.db
      .query("presence")
      .filter((q) => q.lt(q.field("lastSeen"), cutoffTime))
      .take(100);

    let deletedCount = 0;
    for (const presence of stalePresence) {
      await ctx.db.delete(presence._id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`[maintenance] Cleaned up ${deletedCount} stale presence records`);
    }

    return { deletedCount };
  },
});

// ============================================================
// Future: Embedding Sync
// ============================================================

/**
 * Sync documents to Qdrant for semantic search.
 * Future implementation - will batch process documents needing embedding updates.
 */
export const syncEmbeddings = internalAction({
  args: {},
  handler: async () => {
    // Future: Query documents needing embedding updates
    // Generate embeddings via DeepInfra
    // Upsert to Qdrant
    console.log("[maintenance] Embedding sync not yet implemented");
    return { synced: 0 };
  },
});

// ============================================================
// Invitation Cleanup
// ============================================================

/**
 * Expire old pending invitations.
 * Runs daily to mark invitations past their expiry date.
 */
export const expireOldInvitations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("projectInvitations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    let expiredCount = 0;
    for (const inv of pending) {
      if (inv.expiresAt < now) {
        await ctx.db.patch(inv._id, { status: "expired" });
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(
        `[maintenance] Expired ${expiredCount} old invitations`
      );
    }

    return { expiredCount };
  },
});

// ============================================================
// Asset Cleanup
// ============================================================

/**
 * Clean up soft-deleted assets older than 30 days.
 * Removes both storage files and database records.
 */
export const cleanupDeletedAssets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const deleted = await ctx.db
      .query("projectAssets")
      .withIndex("by_deleted")
      .collect();

    const toDelete = deleted.filter(
      (a) => a.deletedAt && a.deletedAt < cutoff
    );

    let deletedCount = 0;
    for (const asset of toDelete.slice(0, 100)) {
      await ctx.storage.delete(asset.storageId);
      if (asset.thumbnailStorageId) {
        await ctx.storage.delete(asset.thumbnailStorageId);
      }
      await ctx.db.delete(asset._id);
      deletedCount++;
    }

    if (deletedCount > 0) {
      console.log(`[maintenance] Cleaned up ${deletedCount} deleted assets`);
    }

    return { deleted: deletedCount };
  },
});

// ============================================================
// Vector Delete Job Processing
// ============================================================

/** Max jobs to process per batch */
const VECTOR_DELETE_BATCH_SIZE = 10;

/** Max attempts before marking job as failed */
const VECTOR_DELETE_MAX_ATTEMPTS = 5;

/**
 * Get pending vector delete jobs.
 */
export const getPendingVectorDeleteJobs = internalQuery({
  args: {},
  handler: async (ctx) => {
    return ctx.db
      .query("vectorDeleteJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(VECTOR_DELETE_BATCH_SIZE);
  },
});

/**
 * Mark vector delete job as processing.
 */
export const markVectorJobProcessing = internalMutation({
  args: {
    jobId: v.id("vectorDeleteJobs"),
  },
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, {
      status: "processing",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark vector delete job as completed.
 */
export const markVectorJobCompleted = internalMutation({
  args: {
    jobId: v.id("vectorDeleteJobs"),
  },
  handler: async (ctx, { jobId }) => {
    await ctx.db.delete(jobId);
  },
});

/**
 * Mark vector delete job as failed.
 */
export const markVectorJobFailed = internalMutation({
  args: {
    jobId: v.id("vectorDeleteJobs"),
    error: v.string(),
    permanent: v.boolean(),
  },
  handler: async (ctx, { jobId, error, permanent }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    const newAttempts = job.attempts + 1;
    const shouldFail = permanent || newAttempts >= VECTOR_DELETE_MAX_ATTEMPTS;

    await ctx.db.patch(jobId, {
      status: shouldFail ? "failed" : "pending",
      attempts: newAttempts,
      lastError: error,
      updatedAt: Date.now(),
    });
  },
});

import { v } from "convex/values";

/**
 * Process pending vector delete jobs.
 * Calls Qdrant deletePointsByFilter for each job.
 */
export const processVectorDeleteJobs = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; failed: number }> => {
    if (!isQdrantConfigured()) {
      console.log("[maintenance] Qdrant not configured, skipping vector delete jobs");
      return { processed: 0, failed: 0 };
    }

    const jobs = await ctx.runQuery(internal.maintenance.getPendingVectorDeleteJobs);

    if (jobs.length === 0) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs) {
      // Mark as processing
      await ctx.runMutation(internal.maintenance.markVectorJobProcessing, {
        jobId: job._id,
      });

      try {
        const filter = job.filter as QdrantFilter;
        await deletePointsByFilter(filter);

        // Delete the job on success
        await ctx.runMutation(internal.maintenance.markVectorJobCompleted, {
          jobId: job._id,
        });

        processed++;
        console.log(
          `[maintenance] Vector delete job completed: ${job.targetType}/${job.targetId ?? "bulk"}`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const isPermanent = errorMessage.includes("not found") || errorMessage.includes("404");

        await ctx.runMutation(internal.maintenance.markVectorJobFailed, {
          jobId: job._id,
          error: errorMessage,
          permanent: isPermanent,
        });

        failed++;
        console.error(
          `[maintenance] Vector delete job failed: ${job.targetType}/${job.targetId ?? "bulk"} - ${errorMessage}`
        );
      }
    }

    if (processed > 0 || failed > 0) {
      console.log(
        `[maintenance] Vector delete jobs: ${processed} processed, ${failed} failed`
      );
    }

    return { processed, failed };
  },
});
