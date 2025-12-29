-- Migration 004: Scene Analysis Storage
-- Stores SceneMetrics snapshots for tracking scene analysis over time

-- Create scene_analysis table
CREATE TABLE IF NOT EXISTS scene_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  scene_id TEXT,

  -- Tension analysis data
  tension_data JSONB DEFAULT '{}',

  -- Sensory analysis data
  sensory_data JSONB DEFAULT '{}',

  -- Scene metrics
  pacing FLOAT CHECK (pacing >= 0 AND pacing <= 1),
  mood TEXT,
  show_dont_tell_score FLOAT CHECK (show_dont_tell_score >= 0 AND show_dont_tell_score <= 1),

  -- Additional metrics
  word_count INTEGER DEFAULT 0,
  dialogue_ratio FLOAT CHECK (dialogue_ratio >= 0 AND dialogue_ratio <= 1),
  action_ratio FLOAT CHECK (action_ratio >= 0 AND action_ratio <= 1),
  description_ratio FLOAT CHECK (description_ratio >= 0 AND description_ratio <= 1),

  -- Character and entity presence
  character_presence JSONB DEFAULT '[]',
  entity_mentions JSONB DEFAULT '[]',

  -- Timestamps
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scene_analysis_project ON scene_analysis(project_id);
CREATE INDEX IF NOT EXISTS idx_scene_analysis_document ON scene_analysis(document_id);
CREATE INDEX IF NOT EXISTS idx_scene_analysis_scene ON scene_analysis(project_id, scene_id);
CREATE INDEX IF NOT EXISTS idx_scene_analysis_analyzed_at ON scene_analysis(analyzed_at DESC);

-- Composite index for finding latest analysis per document
CREATE INDEX IF NOT EXISTS idx_scene_analysis_latest ON scene_analysis(project_id, document_id, analyzed_at DESC);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_scene_analysis_tension_data ON scene_analysis USING GIN (tension_data);
CREATE INDEX IF NOT EXISTS idx_scene_analysis_sensory_data ON scene_analysis USING GIN (sensory_data);
CREATE INDEX IF NOT EXISTS idx_scene_analysis_character_presence ON scene_analysis USING GIN (character_presence);

-- Row Level Security
ALTER TABLE scene_analysis ENABLE ROW LEVEL SECURITY;

-- Scene analysis follows project access
CREATE POLICY "Scene analysis follows project access" ON scene_analysis
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scene_analysis.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );

-- Function to get latest analysis for a document
CREATE OR REPLACE FUNCTION get_latest_scene_analysis(
  p_project_id UUID,
  p_document_id UUID DEFAULT NULL
)
RETURNS SETOF scene_analysis
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_document_id IS NOT NULL THEN
    RETURN QUERY
    SELECT *
    FROM scene_analysis
    WHERE project_id = p_project_id
      AND document_id = p_document_id
    ORDER BY analyzed_at DESC
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT DISTINCT ON (document_id) *
    FROM scene_analysis
    WHERE project_id = p_project_id
    ORDER BY document_id, analyzed_at DESC;
  END IF;
END;
$$;

-- Function to get analysis history for a scene
CREATE OR REPLACE FUNCTION get_scene_analysis_history(
  p_project_id UUID,
  p_document_id UUID,
  p_scene_id TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS SETOF scene_analysis
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_scene_id IS NOT NULL THEN
    RETURN QUERY
    SELECT *
    FROM scene_analysis
    WHERE project_id = p_project_id
      AND document_id = p_document_id
      AND scene_id = p_scene_id
    ORDER BY analyzed_at DESC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT *
    FROM scene_analysis
    WHERE project_id = p_project_id
      AND document_id = p_document_id
    ORDER BY analyzed_at DESC
    LIMIT p_limit;
  END IF;
END;
$$;
