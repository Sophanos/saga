-- Migration: Backfill legacy project_collaborators view
-- Provides compatibility for older policies/functions expecting project_collaborators.

CREATE OR REPLACE VIEW project_collaborators AS
SELECT
  id,
  project_id,
  user_id,
  role,
  invited_by,
  invited_at,
  accepted_at,
  created_at
FROM project_members;
