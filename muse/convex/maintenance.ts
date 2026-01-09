/**
 * Maintenance Jobs
 *
 * Internal mutations/actions called by cron jobs for system maintenance.
 */

import { internalMutation, internalAction } from "./_generated/server";

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
