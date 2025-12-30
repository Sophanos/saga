-- Migration 019: Project Assets Table
-- Stores generated images tied to projects and optionally entities.
-- Supports portrait generation, scene illustrations, and other visual assets.

-- =============================================================================
-- Project Assets Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_id UUID NULL REFERENCES entities(id) ON DELETE SET NULL,
  
  -- Asset classification
  asset_type TEXT NOT NULL CHECK (asset_type IN ('portrait', 'scene', 'location', 'item', 'reference', 'other')),
  
  -- Storage
  storage_path TEXT NOT NULL,
  public_url TEXT,
  
  -- Generation metadata
  generation_prompt TEXT,
  generation_model TEXT,
  generation_params JSONB NOT NULL DEFAULT '{}',
  
  -- File metadata
  mime_type TEXT DEFAULT 'image/png',
  width INT NULL,
  height INT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Alter Entities Table for Portrait Support
-- =============================================================================

ALTER TABLE entities ADD COLUMN IF NOT EXISTS portrait_url TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS portrait_asset_id UUID REFERENCES project_assets(id) ON DELETE SET NULL;

-- =============================================================================
-- Indexes
-- =============================================================================

-- Primary access patterns
CREATE INDEX IF NOT EXISTS idx_project_assets_project_created
  ON project_assets(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_assets_project_entity
  ON project_assets(project_id, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_assets_project_type
  ON project_assets(project_id, asset_type);

-- Entity portrait lookup
CREATE INDEX IF NOT EXISTS idx_entities_portrait_asset
  ON entities(portrait_asset_id)
  WHERE portrait_asset_id IS NOT NULL;

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE project_assets ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can view assets for projects they have access to
CREATE POLICY "Users can view project assets"
  ON project_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()
      UNION
      SELECT 1 FROM project_collaborators
      WHERE project_id = project_assets.project_id AND user_id = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE handled via service role in edge functions
-- (No user-facing write policies - all writes go through authenticated edge functions)

-- =============================================================================
-- Helper Functions
-- =============================================================================

/**
 * Get all assets for an entity.
 */
CREATE OR REPLACE FUNCTION get_entity_assets(
  p_entity_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  asset_type TEXT,
  storage_path TEXT,
  public_url TEXT,
  generation_prompt TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    pa.id,
    pa.asset_type,
    pa.storage_path,
    pa.public_url,
    pa.generation_prompt,
    pa.created_at
  FROM project_assets pa
  WHERE pa.entity_id = p_entity_id
  ORDER BY pa.created_at DESC
  LIMIT p_limit;
$$;

/**
 * Get all assets for a project by type.
 */
CREATE OR REPLACE FUNCTION get_project_assets_by_type(
  p_project_id UUID,
  p_asset_type TEXT,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  entity_id UUID,
  storage_path TEXT,
  public_url TEXT,
  generation_prompt TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    pa.id,
    pa.entity_id,
    pa.storage_path,
    pa.public_url,
    pa.generation_prompt,
    pa.created_at
  FROM project_assets pa
  WHERE pa.project_id = p_project_id
    AND pa.asset_type = p_asset_type
  ORDER BY pa.created_at DESC
  LIMIT p_limit;
$$;
