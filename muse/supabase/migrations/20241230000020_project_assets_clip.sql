-- Migration 020: Project Assets CLIP Embeddings
-- Adds CLIP embedding storage and Qdrant sync tracking for visual similarity search.

-- =============================================================================
-- CLIP Embedding Columns
-- =============================================================================

-- Sync tracking for Qdrant saga_images collection
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS clip_sync_status TEXT DEFAULT 'pending' 
  CHECK (clip_sync_status IN ('pending', 'synced', 'error'));

ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS clip_synced_at TIMESTAMPTZ;
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS clip_last_error TEXT;

-- CLIP embedding storage (512 dimensions for multilingual CLIP)
-- Used for Postgres fallback when Qdrant is unavailable
ALTER TABLE project_assets ADD COLUMN IF NOT EXISTS clip_embedding VECTOR(512);

-- =============================================================================
-- Indexes for CLIP Sync Queue
-- =============================================================================

-- Queue for pending/error CLIP syncs (for retry/backfill workflows)
CREATE INDEX IF NOT EXISTS idx_project_assets_clip_pending
  ON project_assets(clip_sync_status, created_at)
  WHERE clip_sync_status IN ('pending', 'error');

-- Vector similarity search index (for Postgres fallback)
-- Using IVFFlat index which works well with 512 dimensions
CREATE INDEX IF NOT EXISTS idx_project_assets_clip_embedding
  ON project_assets USING ivfflat (clip_embedding vector_cosine_ops)
  WITH (lists = 100);

-- =============================================================================
-- Helper Functions
-- =============================================================================

/**
 * Search project assets by visual similarity using CLIP embeddings.
 * Used when Qdrant is unavailable.
 */
CREATE OR REPLACE FUNCTION search_project_assets(
  query_embedding VECTOR(512),
  match_count INT,
  project_filter UUID,
  asset_type_filter TEXT DEFAULT NULL,
  entity_type_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  entity_id UUID,
  asset_type TEXT,
  storage_path TEXT,
  public_url TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $
BEGIN
  RETURN QUERY
  SELECT
    pa.id,
    pa.entity_id,
    pa.asset_type,
    pa.storage_path,
    pa.public_url,
    pa.created_at,
    1 - (pa.clip_embedding <=> query_embedding) AS similarity
  FROM project_assets pa
  LEFT JOIN entities e ON pa.entity_id = e.id
  WHERE pa.project_id = project_filter
    AND pa.clip_embedding IS NOT NULL
    AND (asset_type_filter IS NULL OR pa.asset_type = asset_type_filter)
    AND (entity_type_filter IS NULL OR e.type = entity_type_filter)
  ORDER BY pa.clip_embedding <=> query_embedding
  LIMIT match_count;
END;
$;

/**
 * Get assets pending CLIP sync (for retry queue).
 */
CREATE OR REPLACE FUNCTION get_pending_clip_sync(batch_size INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  storage_path TEXT,
  clip_sync_status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $
  SELECT id, storage_path, clip_sync_status, created_at
  FROM project_assets
  WHERE clip_sync_status IN ('pending', 'error')
  ORDER BY
    CASE WHEN clip_sync_status = 'pending' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT batch_size;
$;
