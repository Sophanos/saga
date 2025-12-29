-- Migration 005: Flexible Entity and Document Kinds
--
-- This migration enables user-extensible entity and document types
-- to support all creative genres (LOTR, D&D, Manga, Literary Fiction, etc.)
--
-- Strategy: Remove CHECK constraints, validate at application layer via template registry.

-- ============================================================================
-- STEP 1: Drop the existing CHECK constraints
-- ============================================================================

-- Drop entity type constraint
ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_type_check;

-- Drop document type constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

-- ============================================================================
-- STEP 2: Add template configuration to projects
-- ============================================================================

-- Add template_id column (references builtin template or custom)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_id TEXT;

-- Add entity_kinds_config for project-specific kind overrides
-- Stores custom EntityKindDefinition[] as JSONB
ALTER TABLE projects ADD COLUMN IF NOT EXISTS entity_kinds_config JSONB DEFAULT '[]';

-- Add relationship_kinds_config for project-specific relationship kinds
ALTER TABLE projects ADD COLUMN IF NOT EXISTS relationship_kinds_config JSONB DEFAULT '[]';

-- Add document_kinds_config for project-specific document kinds
ALTER TABLE projects ADD COLUMN IF NOT EXISTS document_kinds_config JSONB DEFAULT '[]';

-- Add ui_config for project-specific UI module settings
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ui_config JSONB DEFAULT '{}';

-- ============================================================================
-- STEP 3: Add metadata columns for extensibility
-- ============================================================================

-- Add custom fields storage to entities
-- This allows entities to store template-specific fields beyond `properties`
ALTER TABLE entities ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Add category for entity semantic grouping
-- (agent, place, object, system, organization, temporal, abstract, narrative, mechanical)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS category TEXT;

-- Add visibility for mode-aware entities (writer, dm, both)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS visible_in TEXT DEFAULT 'both';

-- Add icon and color overrides for entities (optional per-entity customization)
ALTER TABLE entities ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS color TEXT;

-- ============================================================================
-- STEP 4: Add category to relationships for semantic grouping
-- ============================================================================

ALTER TABLE relationships ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE relationships ADD COLUMN IF NOT EXISTS visible_in TEXT DEFAULT 'both';

-- ============================================================================
-- STEP 5: Add visibility and icon to documents
-- ============================================================================

ALTER TABLE documents ADD COLUMN IF NOT EXISTS visible_in TEXT DEFAULT 'both';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS icon TEXT;

-- ============================================================================
-- STEP 6: Create entity_kind_registry table for runtime kind definitions
-- ============================================================================

-- This table stores custom entity kinds defined per-project
-- Builtin kinds are not stored here; they come from the template registry in code
CREATE TABLE IF NOT EXISTS entity_kind_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  label_plural TEXT NOT NULL,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  fields JSONB DEFAULT '[]',
  has_visual_description BOOLEAN DEFAULT FALSE,
  has_status BOOLEAN DEFAULT FALSE,
  visible_in TEXT DEFAULT 'both',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, kind)
);

-- Index for fast lookup by project
CREATE INDEX IF NOT EXISTS idx_entity_kind_registry_project ON entity_kind_registry(project_id);

-- ============================================================================
-- STEP 7: Create relationship_kind_registry table
-- ============================================================================

CREATE TABLE IF NOT EXISTS relationship_kind_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  inverse_label TEXT,
  category TEXT NOT NULL,
  color TEXT NOT NULL,
  default_bidirectional BOOLEAN DEFAULT FALSE,
  valid_source_kinds TEXT[] DEFAULT '{}',
  valid_target_kinds TEXT[] DEFAULT '{}',
  visible_in TEXT DEFAULT 'both',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_relationship_kind_registry_project ON relationship_kind_registry(project_id);

-- ============================================================================
-- STEP 8: Create document_kind_registry table
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_kind_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  label_plural TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  allow_children BOOLEAN DEFAULT FALSE,
  child_kinds TEXT[] DEFAULT '{}',
  default_content JSONB,
  visible_in TEXT DEFAULT 'both',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_document_kind_registry_project ON document_kind_registry(project_id);

-- ============================================================================
-- STEP 9: RLS policies for new tables
-- ============================================================================

ALTER TABLE entity_kind_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_kind_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_kind_registry ENABLE ROW LEVEL SECURITY;

-- Entity kind registry follows project access
CREATE POLICY "Entity kind registry follows project access" ON entity_kind_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = entity_kind_registry.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );

-- Relationship kind registry follows project access
CREATE POLICY "Relationship kind registry follows project access" ON relationship_kind_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationship_kind_registry.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );

-- Document kind registry follows project access
CREATE POLICY "Document kind registry follows project access" ON document_kind_registry
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = document_kind_registry.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );

-- ============================================================================
-- STEP 10: Helper function to get all entity kinds for a project
-- ============================================================================

CREATE OR REPLACE FUNCTION get_project_entity_kinds(project_uuid UUID)
RETURNS TABLE (
  kind TEXT,
  label TEXT,
  label_plural TEXT,
  category TEXT,
  color TEXT,
  icon TEXT,
  is_custom BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ekr.kind,
    ekr.label,
    ekr.label_plural,
    ekr.category,
    ekr.color,
    ekr.icon,
    TRUE as is_custom
  FROM entity_kind_registry ekr
  WHERE ekr.project_id = project_uuid
  ORDER BY ekr.label;
END;
$$;

-- ============================================================================
-- STEP 11: Update trigger for entity_kind_registry
-- ============================================================================

CREATE OR REPLACE FUNCTION update_entity_kind_registry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entity_kind_registry_updated_at
  BEFORE UPDATE ON entity_kind_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_entity_kind_registry_timestamp();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
--
-- Summary of changes:
-- 1. Removed CHECK constraints on entities.type and documents.type
-- 2. Added template_id and *_kinds_config columns to projects
-- 3. Added custom_fields, category, visible_in to entities
-- 4. Added category, visible_in to relationships
-- 5. Added visible_in, icon to documents
-- 6. Created entity_kind_registry, relationship_kind_registry, document_kind_registry tables
-- 7. Added RLS policies for new tables
-- 8. Added helper function for querying project entity kinds
--
-- Application layer now validates entity/document kinds via template registry.
