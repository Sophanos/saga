/**
 * Convex Cron Jobs
 *
 * Scheduled background tasks for:
 * - Stream cleanup (delete old completed/failed streams)
 * - Embedding sync (future: sync Convex documents to Qdrant)
 * - Consistency checks (future: automated linting)
 *
 * Cron timing uses UTC timezone.
 * See: https://docs.convex.dev/scheduling/cron-jobs
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ============================================================
// Stream Cleanup
// Runs daily at 3:00 AM UTC to clean up old generation streams
// ============================================================

crons.daily(
  "cleanup-old-streams",
  { hourUTC: 3, minuteUTC: 0 },
  internal.maintenance.cleanupOldStreams
);

// ============================================================
// AI Usage Aggregation
// Runs hourly to aggregate AI usage stats
// ============================================================

crons.hourly(
  "aggregate-ai-usage",
  { minuteUTC: 15 },
  internal.maintenance.aggregateAIUsage
);

// ============================================================
// Presence Cleanup
// Runs every 5 minutes to remove stale presence records
// ============================================================

crons.interval(
  "cleanup-stale-presence",
  { minutes: 5 },
  internal.maintenance.cleanupStalePresence
);

// ============================================================
// Embedding Sync
// Runs every 30s to process embedding outbox
// ============================================================

crons.interval(
  "sync-embeddings",
  { seconds: 30 },
  (internal as any)["ai/embeddings"].processEmbeddingJobs
);

// ============================================================
// Embedding Job Recovery
// Reclaims stuck processing jobs and cleans up stale records
// ============================================================

crons.interval(
  "requeue-stale-embedding-jobs",
  { minutes: 5 },
  (internal as any)["ai/embeddings"].requeueStaleProcessingJobs
);

crons.daily(
  "cleanup-embedding-jobs",
  { hourUTC: 1, minuteUTC: 30 },
  (internal as any)["ai/embeddings"].cleanupEmbeddingJobs
);

// ============================================================
// Invitation Cleanup
// Runs daily at 4:00 AM UTC to expire old invitations
// ============================================================

crons.daily(
  "expire-old-invitations",
  { hourUTC: 4, minuteUTC: 0 },
  internal.maintenance.expireOldInvitations
);

// ============================================================
// Asset Cleanup
// Runs weekly on Sunday at 5:00 AM UTC to clean up soft-deleted assets
// ============================================================

crons.weekly(
  "cleanup-deleted-assets",
  { dayOfWeek: "sunday", hourUTC: 5, minuteUTC: 0 },
  internal.maintenance.cleanupDeletedAssets
);

// ============================================================
// Vector Delete Job Processing
// Runs every minute to process pending Qdrant vector deletions
// ============================================================

crons.interval(
  "process-vector-delete-jobs",
  { minutes: 1 },
  internal.maintenanceNode.processVectorDeleteJobs
);

crons.interval(
  "requeue-stale-vector-delete-jobs",
  { minutes: 5 },
  internal.maintenance.requeueStaleVectorDeleteJobs
);

// ============================================================
// Memory Expiry Cleanup
// Runs daily at 2:00 AM UTC to purge expired memories
// ============================================================

crons.daily(
  "purge-expired-memories",
  { hourUTC: 2, minuteUTC: 0 },
  internal.memories.purgeExpired
);

export default crons;
