-- Migration 013: Collaboration Fixes
-- 1. Add activity logging to accept_invitation RPC (action='join')
-- 2. Add index on project_invitations.expires_at for efficient expiry queries

-- Index on expires_at for efficient expiry queries (e.g., cleanup jobs, validation)
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires_at
  ON project_invitations(expires_at);

-- Updated accept_invitation function with activity logging
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

  -- Log the join activity
  INSERT INTO activity_log (
    project_id,
    actor_user_id,
    action,
    entity_table,
    entity_id,
    after_data,
    metadata
  ) VALUES (
    inv.project_id,
    auth.uid(),
    'join',
    'project_members',
    new_member.id,
    jsonb_build_object(
      'role', inv.role::text,
      'invited_by', inv.invited_by,
      'invitation_id', inv.id
    ),
    jsonb_build_object(
      'invitation_email', inv.email
    )
  );

  RETURN new_member;
END;
$$;
