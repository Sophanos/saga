-- Migration 010: Mobile Capture Hub
-- Quick captures from mobile with different kinds: text, voice, photo, flag, chat_plan

-- Captures table
CREATE TABLE captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'voice', 'photo', 'flag', 'chat_plan')),
  status TEXT NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'processed', 'archived')),
  title TEXT,
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'mobile' CHECK (source IN ('mobile', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_captures_project_id ON captures(project_id);
CREATE INDEX idx_captures_status ON captures(project_id, status);
CREATE INDEX idx_captures_created_by ON captures(created_by);
CREATE INDEX idx_captures_kind ON captures(project_id, kind);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_captures_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Updated_at trigger
CREATE TRIGGER update_captures_updated_at
  BEFORE UPDATE ON captures
  FOR EACH ROW EXECUTE FUNCTION update_captures_updated_at();

-- Enable RLS
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;

-- SELECT: User can see captures for projects they own or are members of
CREATE POLICY "Users can view captures for their projects"
  ON captures FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: User can create captures for projects they own or are editors of
CREATE POLICY "Users can create captures for their projects"
  ON captures FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- UPDATE: User can update their own captures or captures in projects they edit
CREATE POLICY "Users can update captures"
  ON captures FOR UPDATE
  USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
      UNION
      SELECT project_id FROM project_members WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

-- DELETE: User can delete their own captures or captures in projects they own
CREATE POLICY "Users can delete captures"
  ON captures FOR DELETE
  USING (
    created_by = auth.uid() OR
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );
