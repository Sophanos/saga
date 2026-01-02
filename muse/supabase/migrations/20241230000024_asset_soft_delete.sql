-- Migration 024: Asset Soft Delete and Cleanup
-- Adds soft delete support and cleanup functions for project_assets

-- =============================================================================
-- Add soft delete column
-- =============================================================================

ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- =============================================================================
-- Indexes for cleanup queries
-- =============================================================================

-- Soft delete cleanup queue (for cron job)
CREATE INDEX IF NOT EXISTS idx_project_assets_deleted
  ON project_assets(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Update existing indexes to exclude deleted assets (drop and recreate)
DROP INDEX IF EXISTS idx_project_assets_project_created;
CREATE INDEX idx_project_assets_project_created
  ON project_assets(project_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_project_assets_project_entity;
CREATE INDEX idx_project_assets_project_entity
  ON project_assets(project_id, entity_id)
  WHERE entity_id IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS idx_project_assets_project_type;
CREATE INDEX idx_project_assets_project_type
  ON project_assets(project_id, asset_type)
  WHERE deleted_at IS NULL;

-- Update cache index to exclude deleted assets
DROP INDEX IF EXISTS idx_project_assets_generation_hash;
CREATE INDEX idx_project_assets_generation_hash
  ON project_assets(project_id, generation_hash)
  WHERE generation_hash IS NOT NULL AND deleted_at IS NULL;

-- =============================================================================
-- Cache Lookup (exclude deleted assets)
-- =============================================================================

CREATE OR REPLACE FUNCTION lookup_asset_cache(
  p_project_id UUID,
  p_generation_hash TEXT
)
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  public_url TEXT,
  generation_prompt TEXT,
  cache_hit_count INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.storage_path,
    pa.public_url,
    pa.generation_prompt,
    pa.cache_hit_count,
    pa.created_at
  FROM project_assets pa
  WHERE pa.project_id = p_project_id
    AND pa.generation_hash = p_generation_hash
    AND pa.deleted_at IS NULL
  ORDER BY pa.created_at DESC
  LIMIT 1;
END;
$$;

-- =============================================================================
-- Update RLS policies to exclude deleted assets
-- =============================================================================

-- Drop and recreate the view policy to exclude deleted assets
DROP POLICY IF EXISTS "Users can view project assets" ON project_assets;
CREATE POLICY "Users can view project assets"
  ON project_assets FOR SELECT
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()
      UNION
      SELECT 1 FROM project_members
      WHERE project_id = project_assets.project_id
        AND user_id = auth.uid()
        AND accepted_at IS NOT NULL
    )
  );

-- =============================================================================
-- Soft Delete Function
-- =============================================================================

/**
 * Soft delete an asset.
 * Also removes entity portrait reference if this asset is the entity's portrait.
 */
CREATE OR REPLACE FUNCTION soft_delete_asset(p_asset_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Soft delete the asset
  UPDATE project_assets
  SET deleted_at = NOW()
  WHERE id = p_asset_id AND deleted_at IS NULL;

  -- Clear entity portrait reference if this was their portrait
  UPDATE entities
  SET portrait_url = NULL, portrait_asset_id = NULL
  WHERE portrait_asset_id = p_asset_id;
END;
$$;

-- =============================================================================
-- Cleanup Functions
-- =============================================================================

/**
 * Get assets ready for hard deletion (soft-deleted > N days ago).
 * Returns batch of assets for cleanup processing.
 */
CREATE OR REPLACE FUNCTION get_assets_for_cleanup(
  p_batch_size INTEGER DEFAULT 100,
  p_retention_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  clip_sync_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, storage_path, clip_sync_status
  FROM project_assets
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (p_retention_days || ' days')::INTERVAL
  ORDER BY deleted_at ASC
  LIMIT p_batch_size;
$$;

/**
 * Hard delete assets after cleanup is complete.
 * Only call this AFTER storage blob and Qdrant point have been deleted.
 */
CREATE OR REPLACE FUNCTION hard_delete_assets(p_asset_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM project_assets
  WHERE id = ANY(p_asset_ids)
    AND deleted_at IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

/**
 * Find orphaned assets (entity deleted, asset still exists with null entity_id).
 * These should be soft-deleted for cleanup.
 */
CREATE OR REPLACE FUNCTION find_orphaned_entity_assets(p_batch_size INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  storage_path TEXT,
  asset_type TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT pa.id, pa.project_id, pa.storage_path, pa.asset_type
  FROM project_assets pa
  WHERE pa.deleted_at IS NULL
    AND pa.entity_id IS NULL
    AND pa.asset_type = 'portrait'  -- Only portraits should have entity_id
  LIMIT p_batch_size;
$$;

/**
 * Soft delete orphaned portrait assets.
 * Call this to mark orphaned assets for cleanup.
 */
CREATE OR REPLACE FUNCTION soft_delete_orphaned_portraits(p_batch_size INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE project_assets
  SET deleted_at = NOW()
  WHERE id IN (
    SELECT id FROM find_orphaned_entity_assets(p_batch_size)
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- =============================================================================
-- Asset Cleanup Cron Job
-- =============================================================================

/**
 * Wrapper function for asset cleanup (called by cron).
 * NOTE: This only handles the database side. Storage and Qdrant cleanup
 * must be done via the asset-cleanup edge function which is called separately.
 *
 * This function:
 * 1. Marks orphaned portrait assets for deletion
 * 2. Logs assets ready for full cleanup (storage + Qdrant + DB)
 */
CREATE OR REPLACE FUNCTION run_asset_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_orphaned_count INTEGER;
  v_pending_cleanup_count INTEGER;
BEGIN
  -- Step 1: Mark orphaned portrait assets for deletion
  SELECT soft_delete_orphaned_portraits(100) INTO v_orphaned_count;

  -- Step 2: Count assets pending full cleanup (for logging)
  SELECT COUNT(*) INTO v_pending_cleanup_count
  FROM project_assets
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '7 days';

  -- Log results (visible in pg_cron.job_run_details)
  RAISE NOTICE 'Asset cleanup: % orphaned marked, % pending full cleanup (requires edge function)',
    v_orphaned_count, v_pending_cleanup_count;
END;
$$;

COMMENT ON FUNCTION run_asset_cleanup IS
  'Daily asset cleanup: marks orphaned portraits for deletion, logs pending full cleanup count.';

-- Schedule asset cleanup job: runs daily at 5:00 AM UTC (after other cleanup jobs)
SELECT cron.schedule(
  'asset-cleanup',            -- job name (unique identifier)
  '0 5 * * *',               -- cron expression: 5:00 AM UTC daily
  $$SELECT run_asset_cleanup()$$
);

-- =============================================================================
-- Permissions
-- =============================================================================

-- Revoke public access to admin functions
REVOKE EXECUTE ON FUNCTION soft_delete_asset FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_assets_for_cleanup FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION hard_delete_assets FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION find_orphaned_entity_assets FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION soft_delete_orphaned_portraits FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION run_asset_cleanup FROM PUBLIC;

-- Note: These functions are SECURITY DEFINER and run as the definer.
-- Only service_role or direct database access can call them.

-- =============================================================================
-- DOWN MIGRATION (for rollback)
-- =============================================================================
-- To rollback this migration, run:
--
-- SELECT cron.unschedule('asset-cleanup');
--
-- DROP FUNCTION IF EXISTS run_asset_cleanup();
-- DROP FUNCTION IF EXISTS soft_delete_orphaned_portraits(INTEGER);
-- DROP FUNCTION IF EXISTS find_orphaned_entity_assets(INTEGER);
-- DROP FUNCTION IF EXISTS hard_delete_assets(UUID[]);
-- DROP FUNCTION IF EXISTS get_assets_for_cleanup(INTEGER, INTEGER);
-- DROP FUNCTION IF EXISTS soft_delete_asset(UUID);
--
-- DROP POLICY IF EXISTS "Users can view project assets" ON project_assets;
-- (Restore original policy without deleted_at check)
--
-- DROP INDEX IF EXISTS idx_project_assets_deleted;
-- (Restore original indexes without WHERE deleted_at IS NULL)
--
-- ALTER TABLE project_assets DROP COLUMN IF EXISTS deleted_at;
