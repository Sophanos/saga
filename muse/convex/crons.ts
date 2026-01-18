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

// Use require to break deep type inference chain for Convex internal API
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const internal = require("./_generated/api").internal as any;

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
// Analysis Job Processing
// Runs every 30s to process analysis outbox
// ============================================================

crons.interval(
  "process-analysis-jobs",
  { seconds: 30 },
  (internal as any)["ai/analysis/processAnalysisJobs"].processAnalysisJobs
);

crons.interval(
  "requeue-stale-analysis-jobs",
  { minutes: 5 },
  (internal as any)["ai/analysisJobs"].requeueStaleProcessingJobs
);

// ============================================================
// Flow Runtime Cleanup
// Runs every 10 minutes to expire session vectors
// ============================================================

crons.interval(
  "cleanup-flow-runtime-sessions",
  { minutes: 10 },
  (internal as any)["ai/flow/cleanupSessionVectors"].cleanupExpiredSessions
);

crons.daily(
  "cleanup-analysis-jobs",
  { hourUTC: 1, minuteUTC: 0 },
  (internal as any)["ai/analysisJobs"].cleanupAnalysisJobs
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
