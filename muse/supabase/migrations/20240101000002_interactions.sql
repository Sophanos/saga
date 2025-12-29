-- Interactions table for tracking causal events in scenes
-- Part of the Dynamics/Event Stream System

CREATE TABLE IF NOT EXISTS interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  scene_id TEXT,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  action TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('neutral','hostile','hidden','passive')),
  time_marker TEXT NOT NULL,
  effect TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactions_project ON interactions(project_id);
CREATE INDEX idx_interactions_document ON interactions(document_id);
CREATE INDEX idx_interactions_source ON interactions(source_id);
CREATE INDEX idx_interactions_target ON interactions(target_id);

-- Row Level Security
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- Interactions follow project access
CREATE POLICY "Interactions follow project access" ON interactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = interactions.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );
