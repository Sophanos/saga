-- Migration 007: Collaboration Features
-- Project members, invitations, and activity logging

-- Project member roles
CREATE TYPE project_role AS ENUM ('owner', 'editor', 'viewer');

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each user can only be a member of a project once
  UNIQUE(project_id, user_id)
);

-- Indexes for project_members
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(project_id, role);

-- Project invitations table (for users not yet registered)
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role project_role NOT NULL DEFAULT 'viewer',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Only one active invitation per email per project
  UNIQUE(project_id, email)
);

-- Indexes for project_invitations
CREATE INDEX IF NOT EXISTS idx_project_invitations_project ON project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);

-- Activity log table for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_table TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_project ON activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor ON activity_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_table, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(project_id, created_at DESC);

-- Enable RLS on new tables
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is a project member
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND accepted_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND user_id = p_user_id
  );
$$;

-- Helper function: Check if user is a project editor (or owner)
CREATE OR REPLACE FUNCTION is_project_editor(p_project_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND role IN ('owner', 'editor')
      AND accepted_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND user_id = p_user_id
  );
$$;

-- Helper function: Check if user is a project owner
CREATE OR REPLACE FUNCTION is_project_owner(p_project_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND role = 'owner'
      AND accepted_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id
      AND user_id = p_user_id
  );
$$;

-- RLS Policies for project_members

-- Members can view other members of projects they belong to
CREATE POLICY "Members can view project members"
  ON project_members FOR SELECT
  USING (is_project_member(project_id));

-- Owners and editors can invite new members
CREATE POLICY "Editors can invite members"
  ON project_members FOR INSERT
  WITH CHECK (is_project_editor(project_id));

-- Owners can update member roles
CREATE POLICY "Owners can update members"
  ON project_members FOR UPDATE
  USING (is_project_owner(project_id));

-- Owners can remove members, or members can remove themselves
CREATE POLICY "Owners can remove members or self-remove"
  ON project_members FOR DELETE
  USING (is_project_owner(project_id) OR user_id = auth.uid());

-- RLS Policies for project_invitations

-- Editors can view invitations
CREATE POLICY "Editors can view invitations"
  ON project_invitations FOR SELECT
  USING (is_project_editor(project_id) OR email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- Editors can create invitations
CREATE POLICY "Editors can create invitations"
  ON project_invitations FOR INSERT
  WITH CHECK (is_project_editor(project_id));

-- Editors can delete invitations
CREATE POLICY "Editors can delete invitations"
  ON project_invitations FOR DELETE
  USING (is_project_editor(project_id));

-- RLS Policies for activity_log

-- Members can view activity log
CREATE POLICY "Members can view activity log"
  ON activity_log FOR SELECT
  USING (is_project_member(project_id));

-- Only system (via triggers) can insert into activity log
-- We use a security definer function for logging
CREATE POLICY "System can insert activity"
  ON activity_log FOR INSERT
  WITH CHECK (is_project_member(project_id));

-- Update RLS policies for existing project tables to support collaboration

-- Drop existing project policies and recreate with collaboration support
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- New project policies with collaboration support
CREATE POLICY "Users can view accessible projects"
  ON projects FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
    OR is_project_member(id)
  );

CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Editors can update projects"
  ON projects FOR UPDATE
  USING (is_project_editor(id));

CREATE POLICY "Owners can delete projects"
  ON projects FOR DELETE
  USING (is_project_owner(id));

-- Update entity policies for collaboration
DROP POLICY IF EXISTS "Entities follow project access" ON entities;
CREATE POLICY "Entities follow project access"
  ON entities FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Editors can modify entities"
  ON entities FOR INSERT
  WITH CHECK (is_project_editor(project_id));

CREATE POLICY "Editors can update entities"
  ON entities FOR UPDATE
  USING (is_project_editor(project_id));

CREATE POLICY "Editors can delete entities"
  ON entities FOR DELETE
  USING (is_project_editor(project_id));

-- Update relationship policies for collaboration
DROP POLICY IF EXISTS "Relationships follow project access" ON relationships;
CREATE POLICY "Relationships follow project access"
  ON relationships FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Editors can modify relationships"
  ON relationships FOR INSERT
  WITH CHECK (is_project_editor(project_id));

CREATE POLICY "Editors can update relationships"
  ON relationships FOR UPDATE
  USING (is_project_editor(project_id));

CREATE POLICY "Editors can delete relationships"
  ON relationships FOR DELETE
  USING (is_project_editor(project_id));

-- Update document policies for collaboration
DROP POLICY IF EXISTS "Documents follow project access" ON documents;
CREATE POLICY "Documents follow project access"
  ON documents FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "Editors can modify documents"
  ON documents FOR INSERT
  WITH CHECK (is_project_editor(project_id));

CREATE POLICY "Editors can update documents"
  ON documents FOR UPDATE
  USING (is_project_editor(project_id));

CREATE POLICY "Editors can delete documents"
  ON documents FOR DELETE
  USING (is_project_editor(project_id));

-- Update mentions policies for collaboration
DROP POLICY IF EXISTS "Mentions follow document access" ON mentions;
CREATE POLICY "Mentions follow project access"
  ON mentions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = mentions.document_id
        AND is_project_member(d.project_id)
    )
  );

CREATE POLICY "Editors can modify mentions"
  ON mentions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = mentions.document_id
        AND is_project_editor(d.project_id)
    )
  );

CREATE POLICY "Editors can update mentions"
  ON mentions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = mentions.document_id
        AND is_project_editor(d.project_id)
    )
  );

CREATE POLICY "Editors can delete mentions"
  ON mentions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = mentions.document_id
        AND is_project_editor(d.project_id)
    )
  );

-- Function to accept an invitation by token
CREATE OR REPLACE FUNCTION accept_invitation(invitation_token TEXT)
RETURNS project_members
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv project_invitations;
  new_member project_members;
  current_user_email TEXT;
BEGIN
  -- Get current user's email
  SELECT email INTO current_user_email FROM profiles WHERE id = auth.uid();
  
  -- Find the invitation
  SELECT * INTO inv FROM project_invitations
  WHERE token = invitation_token
    AND expires_at > NOW()
    AND accepted_at IS NULL;
  
  IF inv IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Verify email matches (optional: can be removed for more flexible invites)
  IF inv.email != current_user_email THEN
    RAISE EXCEPTION 'Invitation was sent to a different email address';
  END IF;
  
  -- Create the membership
  INSERT INTO project_members (project_id, user_id, role, invited_by, invited_at, accepted_at)
  VALUES (inv.project_id, auth.uid(), inv.role, inv.invited_by, inv.created_at, NOW())
  ON CONFLICT (project_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        accepted_at = NOW()
  RETURNING * INTO new_member;
  
  -- Mark invitation as accepted
  UPDATE project_invitations
  SET accepted_at = NOW()
  WHERE id = inv.id;
  
  RETURN new_member;
END;
$$;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_project_id UUID,
  p_action TEXT,
  p_entity_table TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_before_data JSONB DEFAULT NULL,
  p_after_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS activity_log
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_log activity_log;
BEGIN
  INSERT INTO activity_log (project_id, actor_user_id, action, entity_table, entity_id, before_data, after_data, metadata)
  VALUES (p_project_id, auth.uid(), p_action, p_entity_table, p_entity_id, p_before_data, p_after_data, p_metadata)
  RETURNING * INTO new_log;
  
  RETURN new_log;
END;
$$;

-- Trigger function for auto-logging entity changes
CREATE OR REPLACE FUNCTION log_entity_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(NEW.project_id, 'create', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_activity(NEW.project_id, 'update', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity(OLD.project_id, 'delete', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Apply activity logging triggers to main tables
DROP TRIGGER IF EXISTS log_entities_changes ON entities;
CREATE TRIGGER log_entities_changes
  AFTER INSERT OR UPDATE OR DELETE ON entities
  FOR EACH ROW EXECUTE FUNCTION log_entity_changes();

DROP TRIGGER IF EXISTS log_documents_changes ON documents;
CREATE TRIGGER log_documents_changes
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION log_entity_changes();

DROP TRIGGER IF EXISTS log_relationships_changes ON relationships;
CREATE TRIGGER log_relationships_changes
  AFTER INSERT OR UPDATE OR DELETE ON relationships
  FOR EACH ROW EXECUTE FUNCTION log_entity_changes();

-- Function to get project members with profile info
CREATE OR REPLACE FUNCTION get_project_members(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  role project_role,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  name TEXT,
  email TEXT,
  avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    pm.id,
    pm.user_id,
    pm.role,
    pm.invited_at,
    pm.accepted_at,
    p.name,
    p.email,
    p.avatar_url
  FROM project_members pm
  JOIN profiles p ON p.id = pm.user_id
  WHERE pm.project_id = p_project_id
    AND pm.accepted_at IS NOT NULL
  ORDER BY pm.role, pm.accepted_at;
$$;

-- Function to get pending invitations for a project
CREATE OR REPLACE FUNCTION get_project_invitations(p_project_id UUID)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role project_role,
  invited_by_name TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT 
    pi.id,
    pi.email,
    pi.role,
    p.name as invited_by_name,
    pi.expires_at,
    pi.created_at
  FROM project_invitations pi
  LEFT JOIN profiles p ON p.id = pi.invited_by
  WHERE pi.project_id = p_project_id
    AND pi.accepted_at IS NULL
    AND pi.expires_at > NOW()
  ORDER BY pi.created_at DESC;
$$;
