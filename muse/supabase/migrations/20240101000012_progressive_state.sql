-- Migration 011: Progressive State Persistence
-- Server-side persistence for progressive disclosure state (cross-device sync)

-- ============================================================================
-- Project Progressive State
-- ============================================================================

-- Progressive state per project (per user)
CREATE TABLE IF NOT EXISTS project_progressive_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Creation mode and phase
  creation_mode TEXT NOT NULL DEFAULT 'architect' 
    CHECK (creation_mode IN ('architect', 'gardener', 'hybrid')),
  phase INTEGER NOT NULL DEFAULT 4 
    CHECK (phase BETWEEN 1 AND 4),
  
  -- Module unlocks (JSONB for flexibility)
  unlocked_modules JSONB NOT NULL DEFAULT '{"editor": true}'::jsonb,
  
  -- Writing metrics
  total_writing_time_sec INTEGER NOT NULL DEFAULT 0,
  last_entity_nudge_word_count INTEGER,
  
  -- User preferences for this project
  never_ask JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One progressive state per project per user
  UNIQUE(project_id, user_id)
);

-- ============================================================================
-- User Progressive Preferences
-- ============================================================================

-- User-level progressive preferences (archetype, onboarding, etc.)
CREATE TABLE IF NOT EXISTS user_progressive_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- Writer archetype
  archetype TEXT CHECK (archetype IN ('architect', 'gardener', 'hybrid')),
  archetype_selected_at TIMESTAMPTZ,
  
  -- Onboarding state
  onboarding_completed_at TIMESTAMPTZ,
  completed_onboarding_steps TEXT[] NOT NULL DEFAULT '{}',
  current_onboarding_step TEXT NOT NULL DEFAULT 'welcome',
  
  -- UI visibility preferences
  ui_visibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Milestones (stored as JSONB array for flexibility)
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_project_progressive_state_project 
  ON project_progressive_state(project_id);

CREATE INDEX IF NOT EXISTS idx_project_progressive_state_user 
  ON project_progressive_state(user_id);

CREATE INDEX IF NOT EXISTS idx_project_progressive_state_lookup 
  ON project_progressive_state(project_id, user_id);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

-- Trigger function for project_progressive_state
CREATE OR REPLACE FUNCTION update_project_progressive_state_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for project_progressive_state
DROP TRIGGER IF EXISTS update_project_progressive_state_updated_at ON project_progressive_state;
CREATE TRIGGER update_project_progressive_state_updated_at
  BEFORE UPDATE ON project_progressive_state
  FOR EACH ROW EXECUTE FUNCTION update_project_progressive_state_updated_at();

-- Trigger function for user_progressive_preferences
CREATE OR REPLACE FUNCTION update_user_progressive_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for user_progressive_preferences
DROP TRIGGER IF EXISTS update_user_progressive_preferences_updated_at ON user_progressive_preferences;
CREATE TRIGGER update_user_progressive_preferences_updated_at
  BEFORE UPDATE ON user_progressive_preferences
  FOR EACH ROW EXECUTE FUNCTION update_user_progressive_preferences_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE project_progressive_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progressive_preferences ENABLE ROW LEVEL SECURITY;

-- Project progressive state: Users can only manage their own state AND must be project members
CREATE POLICY "Users can view their own project progressive state"
  ON project_progressive_state FOR SELECT
  USING (
    auth.uid() = user_id
    AND is_project_member(project_id)
  );

CREATE POLICY "Users can insert their own project progressive state"
  ON project_progressive_state FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_project_member(project_id)
  );

CREATE POLICY "Users can update their own project progressive state"
  ON project_progressive_state FOR UPDATE
  USING (
    auth.uid() = user_id
    AND is_project_member(project_id)
  );

CREATE POLICY "Users can delete their own project progressive state"
  ON project_progressive_state FOR DELETE
  USING (
    auth.uid() = user_id
    AND is_project_member(project_id)
  );

-- User progressive preferences: Users can only manage their own preferences
CREATE POLICY "Users can view their own progressive preferences"
  ON user_progressive_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progressive preferences"
  ON user_progressive_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progressive preferences"
  ON user_progressive_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progressive preferences"
  ON user_progressive_preferences FOR DELETE
  USING (auth.uid() = user_id);
