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
  internal.ai.embeddings.processEmbeddingJobs
);

export default crons;
