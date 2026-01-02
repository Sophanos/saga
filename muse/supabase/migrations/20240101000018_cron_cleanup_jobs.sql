-- Migration 018: Scheduled Cleanup Jobs (pg_cron)
-- Sets up daily cron jobs for memory TTL cleanup and anonymous trial data cleanup.
--
-- Jobs scheduled:
--   1. memory-cleanup: Daily at 3:00 AM UTC - marks expired memories, purges old deleted
--   2. anon-trial-cleanup: Daily at 4:00 AM UTC - removes stale anonymous devices and rate buckets
--
-- Note: pg_cron extension is pre-installed on Supabase hosted but must be enabled.
-- On local development, cron jobs won't run - use manual function calls for testing.

-- =============================================================================
-- Enable pg_cron Extension
-- =============================================================================

-- pg_cron must be created in the pg_catalog schema or postgres schema on Supabase
-- The cron schema provides the job management tables
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role (required for job scheduling)
GRANT USAGE ON SCHEMA cron TO postgres;

-- =============================================================================
-- Memory Cleanup Job
-- =============================================================================

-- Wrapper function for memory cleanup (logs results)
CREATE OR REPLACE FUNCTION run_memory_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
  v_purged_count INTEGER;
BEGIN
  -- Step 1: Mark memories with expired TTL as deleted
  SELECT mark_expired_memories() INTO v_expired_count;

  -- Step 2: Hard delete memories that have been soft-deleted for > 7 days
  -- This gives time for Qdrant sync cleanup before hard deletion
  SELECT purge_deleted_memories(7) INTO v_purged_count;

  -- Log results (visible in pg_cron.job_run_details)
  RAISE NOTICE 'Memory cleanup complete: % expired marked, % purged', v_expired_count, v_purged_count;
END;
$$;

COMMENT ON FUNCTION run_memory_cleanup IS
  'Daily memory cleanup: marks expired memories, purges soft-deleted older than 7 days.';

-- Schedule memory cleanup job: runs daily at 3:00 AM UTC
-- Using cron.schedule with explicit job name for idempotency
SELECT cron.schedule(
  'memory-cleanup',           -- job name (unique identifier)
  '0 3 * * *',               -- cron expression: 3:00 AM UTC daily
  $$SELECT run_memory_cleanup()$$
);

-- =============================================================================
-- Anonymous Trial Cleanup Job
-- =============================================================================

-- The cleanup_anon_trial_data function already exists in migration 015
-- Schedule it: runs daily at 4:00 AM UTC (offset from memory cleanup)
SELECT cron.schedule(
  'anon-trial-cleanup',       -- job name (unique identifier)
  '0 4 * * *',               -- cron expression: 4:00 AM UTC daily
  $$SELECT cleanup_anon_trial_data()$$
);

-- =============================================================================
-- Admin Functions for Job Management
-- =============================================================================

-- View scheduled jobs (wrapper for easier access)
CREATE OR REPLACE FUNCTION list_cron_jobs()
RETURNS TABLE (
  jobid BIGINT,
  schedule TEXT,
  command TEXT,
  nodename TEXT,
  nodeport INTEGER,
  database TEXT,
  username TEXT,
  active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jobid, schedule, command, nodename, nodeport, database, username, active
  FROM cron.job
  ORDER BY jobid;
$$;

COMMENT ON FUNCTION list_cron_jobs IS
  'List all scheduled cron jobs. Wrapper for cron.job table.';

-- View recent job runs (wrapper for monitoring)
CREATE OR REPLACE FUNCTION list_cron_job_runs(
  p_job_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  runid BIGINT,
  jobid BIGINT,
  job_pid INTEGER,
  database TEXT,
  username TEXT,
  command TEXT,
  status TEXT,
  return_message TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    r.runid, r.jobid, r.job_pid, r.database, r.username,
    r.command, r.status, r.return_message, r.start_time, r.end_time
  FROM cron.job_run_details r
  LEFT JOIN cron.job j ON j.jobid = r.jobid
  WHERE p_job_name IS NULL OR j.jobname = p_job_name
  ORDER BY r.start_time DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION list_cron_job_runs IS
  'View recent cron job execution history. Filter by job name optionally.';

-- =============================================================================
-- Permissions
-- =============================================================================

-- Revoke public access to admin functions
REVOKE EXECUTE ON FUNCTION run_memory_cleanup FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION list_cron_jobs FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION list_cron_job_runs FROM PUBLIC;

-- Note: These functions are SECURITY DEFINER and run as the definer.
-- Only service_role or direct database access can call them.
