-- Migration 019: Chat Sessions Table
-- Durable storage for AI chat conversations with message history.
-- Sessions are private per-user within a project.

-- =============================================================================
-- Chat Sessions Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_sessions (
  -- Use TEXT for id to support both UUID and potentially non-UUID ids
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),

  -- Session metadata
  name TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,

  -- Aggregate stats (maintained by trigger)
  message_count INT NOT NULL DEFAULT 0
);

-- =============================================================================
-- Chat Messages Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  -- TEXT id to support toolCallIds and other non-UUID identifiers
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- Optional structured data
  mentions JSONB,
  tool JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Sessions: List by project + user, ordered by recent
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_user_recent
  ON chat_sessions(project_id, user_id, last_message_at DESC NULLS LAST);

-- Sessions: Fallback index for project-only queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_recent
  ON chat_sessions(project_id, last_message_at DESC NULLS LAST);

-- Messages: Ordered by creation time for loading history
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON chat_messages(session_id, created_at ASC);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user has access to a project
CREATE OR REPLACE FUNCTION has_project_access(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND user_id = v_user_id
    UNION
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id AND user_id = v_user_id
  );
END;
$$;

-- Sessions: Users can view/modify their own sessions in accessible projects
CREATE POLICY "Users can view own sessions"
  ON chat_sessions FOR SELECT
  USING (
    user_id = auth.uid() AND has_project_access(project_id)
  );

CREATE POLICY "Users can insert own sessions"
  ON chat_sessions FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND has_project_access(project_id)
  );

CREATE POLICY "Users can update own sessions"
  ON chat_sessions FOR UPDATE
  USING (
    user_id = auth.uid() AND has_project_access(project_id)
  )
  WITH CHECK (
    user_id = auth.uid() AND has_project_access(project_id)
  );

CREATE POLICY "Users can delete own sessions"
  ON chat_sessions FOR DELETE
  USING (
    user_id = auth.uid() AND has_project_access(project_id)
  );

-- Messages: Access via session ownership
CREATE POLICY "Users can view messages in own sessions"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
        AND has_project_access(s.project_id)
    )
  );

CREATE POLICY "Users can insert messages in own sessions"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
        AND has_project_access(s.project_id)
    )
  );

CREATE POLICY "Users can update messages in own sessions"
  ON chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
        AND has_project_access(s.project_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
        AND has_project_access(s.project_id)
    )
  );

CREATE POLICY "Users can delete messages in own sessions"
  ON chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
        AND has_project_access(s.project_id)
    )
  );

-- =============================================================================
-- Triggers
-- =============================================================================

-- Update session timestamp trigger
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_chat_sessions_timestamp ON chat_sessions;
CREATE TRIGGER update_chat_sessions_timestamp
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_chat_session_timestamp();

-- Update session aggregates on message insert
CREATE OR REPLACE FUNCTION update_session_on_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE chat_sessions
  SET
    message_count = message_count + 1,
    last_message_at = GREATEST(COALESCE(last_message_at, NEW.created_at), NEW.created_at),
    updated_at = now()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_session_on_message_insert ON chat_messages;
CREATE TRIGGER update_session_on_message_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_session_on_message_insert();

-- Update session aggregates on message delete
CREATE OR REPLACE FUNCTION update_session_on_message_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE chat_sessions
  SET
    message_count = GREATEST(0, message_count - 1),
    updated_at = now()
  WHERE id = OLD.session_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS update_session_on_message_delete ON chat_messages;
CREATE TRIGGER update_session_on_message_delete
  AFTER DELETE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_session_on_message_delete();
