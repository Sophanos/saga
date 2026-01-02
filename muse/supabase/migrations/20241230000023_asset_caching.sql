-- Migration 022: Asset Caching Support
-- Adds hash-based cache lookup and cache metadata

-- =============================================================================
-- Add caching columns to project_assets
-- =============================================================================

-- Deterministic hash of generation parameters for exact-match lookup
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS generation_hash TEXT;

-- Track cache usage
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS cache_hit_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS last_cache_hit_at TIMESTAMPTZ;

-- =============================================================================
-- Indexes for cache lookup
-- =============================================================================

-- Unique index on hash for fast exact-match lookup (within project scope)
-- Note: We use a regular index, not unique, because:
-- 1. The same hash might exist across different asset_types
-- 2. We handle uniqueness via DB-backed locks in the application layer
CREATE INDEX IF NOT EXISTS idx_project_assets_generation_hash
  ON project_assets(project_id, generation_hash)
  WHERE generation_hash IS NOT NULL;

-- =============================================================================
-- Cache Lookup and Locking
-- =============================================================================

-- =============================================================================
-- Generation Lock Table (DB-backed, survives across requests)
-- =============================================================================

CREATE TABLE IF NOT EXISTS asset_generation_locks (
  project_id UUID NOT NULL,
  generation_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (project_id, generation_hash)
);

CREATE INDEX IF NOT EXISTS idx_asset_generation_locks_expires
  ON asset_generation_locks(expires_at);

/**
 * Look up cached asset by generation hash.
 * Returns asset if found, NULL otherwise.
 */
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
  ORDER BY pa.created_at DESC
  LIMIT 1;
END;
$$;

/**
 * Record a cache hit (increment counter and update timestamp).
 */
CREATE OR REPLACE FUNCTION record_cache_hit(p_asset_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE project_assets
  SET
    cache_hit_count = cache_hit_count + 1,
    last_cache_hit_at = NOW()
  WHERE id = p_asset_id;
END;
$$;

/**
 * Try to acquire a cache generation lock.
 * Returns TRUE if lock acquired, FALSE if another process is inserting.
 *
 * Uses a DB-backed lock row with expiry to avoid stale locks.
 */
CREATE OR REPLACE FUNCTION try_cache_lock(
  p_project_id UUID,
  p_generation_hash TEXT,
  p_ttl_seconds INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  lock_acquired BOOLEAN := FALSE;
BEGIN
  -- Clear expired lock (if any)
  DELETE FROM asset_generation_locks
  WHERE project_id = p_project_id
    AND generation_hash = p_generation_hash
    AND expires_at < NOW();

  BEGIN
    INSERT INTO asset_generation_locks (project_id, generation_hash, expires_at)
    VALUES (
      p_project_id,
      p_generation_hash,
      NOW() + make_interval(secs => p_ttl_seconds)
    );
    lock_acquired := TRUE;
  EXCEPTION WHEN unique_violation THEN
    lock_acquired := FALSE;
  END;

  RETURN lock_acquired;
END;
$$;

/**
 * Release the cache generation lock.
 */
CREATE OR REPLACE FUNCTION release_cache_lock(
  p_project_id UUID,
  p_generation_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM asset_generation_locks
  WHERE project_id = p_project_id
    AND generation_hash = p_generation_hash;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;

-- =============================================================================
-- DOWN MIGRATION (for rollback)
-- =============================================================================
-- To rollback this migration, run:
--
-- DROP FUNCTION IF EXISTS release_cache_lock(UUID, TEXT);
-- DROP FUNCTION IF EXISTS try_cache_lock(UUID, TEXT);
-- DROP FUNCTION IF EXISTS record_cache_hit(UUID);
-- DROP FUNCTION IF EXISTS lookup_asset_cache(UUID, TEXT);
--
-- DROP INDEX IF EXISTS idx_asset_generation_locks_expires;
-- DROP TABLE IF EXISTS asset_generation_locks;
--
-- DROP INDEX IF EXISTS idx_project_assets_generation_hash;
--
-- ALTER TABLE project_assets DROP COLUMN IF EXISTS last_cache_hit_at;
-- ALTER TABLE project_assets DROP COLUMN IF EXISTS cache_hit_count;
-- ALTER TABLE project_assets DROP COLUMN IF EXISTS generation_hash;
