-- Migration 008: Offline Versioning Support
-- Add version columns to support optimistic concurrency control for offline sync

-- Add version column to documents
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version column to entities
ALTER TABLE entities 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version column to relationships
ALTER TABLE relationships 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version column to mentions
ALTER TABLE mentions 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version column to interactions
ALTER TABLE interactions 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add version column to scene_analysis
ALTER TABLE scene_analysis 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add last_synced_at for tracking offline sync status
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE entities 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE relationships 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Add client_id for conflict resolution (identifies which client made the change)
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS client_id TEXT;

ALTER TABLE entities 
ADD COLUMN IF NOT EXISTS client_id TEXT;

ALTER TABLE relationships 
ADD COLUMN IF NOT EXISTS client_id TEXT;

-- Create indexes for version queries
CREATE INDEX IF NOT EXISTS idx_documents_version ON documents(project_id, version);
CREATE INDEX IF NOT EXISTS idx_entities_version ON entities(project_id, version);
CREATE INDEX IF NOT EXISTS idx_relationships_version ON relationships(project_id, version);

-- Create indexes for sync queries
CREATE INDEX IF NOT EXISTS idx_documents_synced ON documents(project_id, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_entities_synced ON entities(project_id, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_relationships_synced ON relationships(project_id, last_synced_at);

-- Function to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only increment if this is a real update (not just version/sync changes)
  IF (TG_OP = 'UPDATE') THEN
    -- Check if any meaningful columns changed (exclude version, last_synced_at, client_id)
    IF (NEW.* IS DISTINCT FROM OLD.*) THEN
      NEW.version = OLD.version + 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Apply version increment triggers
DROP TRIGGER IF EXISTS increment_documents_version ON documents;
CREATE TRIGGER increment_documents_version
  BEFORE UPDATE ON documents
  FOR EACH ROW
  WHEN (
    OLD.content IS DISTINCT FROM NEW.content OR
    OLD.title IS DISTINCT FROM NEW.title OR
    OLD.order_index IS DISTINCT FROM NEW.order_index OR
    OLD.parent_id IS DISTINCT FROM NEW.parent_id OR
    OLD.type IS DISTINCT FROM NEW.type
  )
  EXECUTE FUNCTION increment_version();

DROP TRIGGER IF EXISTS increment_entities_version ON entities;
CREATE TRIGGER increment_entities_version
  BEFORE UPDATE ON entities
  FOR EACH ROW
  WHEN (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.type IS DISTINCT FROM NEW.type OR
    OLD.aliases IS DISTINCT FROM NEW.aliases OR
    OLD.properties IS DISTINCT FROM NEW.properties OR
    OLD.archetype IS DISTINCT FROM NEW.archetype OR
    OLD.custom_fields IS DISTINCT FROM NEW.custom_fields
  )
  EXECUTE FUNCTION increment_version();

DROP TRIGGER IF EXISTS increment_relationships_version ON relationships;
CREATE TRIGGER increment_relationships_version
  BEFORE UPDATE ON relationships
  FOR EACH ROW
  WHEN (
    OLD.type IS DISTINCT FROM NEW.type OR
    OLD.source_id IS DISTINCT FROM NEW.source_id OR
    OLD.target_id IS DISTINCT FROM NEW.target_id OR
    OLD.bidirectional IS DISTINCT FROM NEW.bidirectional OR
    OLD.strength IS DISTINCT FROM NEW.strength OR
    OLD.metadata IS DISTINCT FROM NEW.metadata
  )
  EXECUTE FUNCTION increment_version();

DROP TRIGGER IF EXISTS increment_mentions_version ON mentions;
CREATE TRIGGER increment_mentions_version
  BEFORE UPDATE ON mentions
  FOR EACH ROW
  WHEN (
    OLD.entity_id IS DISTINCT FROM NEW.entity_id OR
    OLD.position_start IS DISTINCT FROM NEW.position_start OR
    OLD.position_end IS DISTINCT FROM NEW.position_end OR
    OLD.context IS DISTINCT FROM NEW.context
  )
  EXECUTE FUNCTION increment_version();

DROP TRIGGER IF EXISTS increment_interactions_version ON interactions;
CREATE TRIGGER increment_interactions_version
  BEFORE UPDATE ON interactions
  FOR EACH ROW
  WHEN (
    OLD.source_id IS DISTINCT FROM NEW.source_id OR
    OLD.target_id IS DISTINCT FROM NEW.target_id OR
    OLD.action IS DISTINCT FROM NEW.action OR
    OLD.type IS DISTINCT FROM NEW.type OR
    OLD.time_marker IS DISTINCT FROM NEW.time_marker OR
    OLD.effect IS DISTINCT FROM NEW.effect
  )
  EXECUTE FUNCTION increment_version();

-- Function to get changes since a specific version (for sync)
CREATE OR REPLACE FUNCTION get_changes_since(
  p_project_id UUID,
  p_table_name TEXT,
  p_since_version INTEGER DEFAULT 0,
  p_since_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  CASE p_table_name
    WHEN 'documents' THEN
      SELECT jsonb_agg(to_jsonb(d.*))
      INTO result
      FROM documents d
      WHERE d.project_id = p_project_id
        AND (d.version > p_since_version OR (p_since_time IS NOT NULL AND d.updated_at > p_since_time));
    
    WHEN 'entities' THEN
      SELECT jsonb_agg(to_jsonb(e.*))
      INTO result
      FROM entities e
      WHERE e.project_id = p_project_id
        AND (e.version > p_since_version OR (p_since_time IS NOT NULL AND e.updated_at > p_since_time));
    
    WHEN 'relationships' THEN
      SELECT jsonb_agg(to_jsonb(r.*))
      INTO result
      FROM relationships r
      WHERE r.project_id = p_project_id
        AND (r.version > p_since_version OR (p_since_time IS NOT NULL AND r.created_at > p_since_time));
    
    ELSE
      RAISE EXCEPTION 'Unknown table: %', p_table_name;
  END CASE;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Function to get all changes for a project since a timestamp (for bulk sync)
CREATE OR REPLACE FUNCTION get_project_changes_since(
  p_project_id UUID,
  p_since_time TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'documents', COALESCE((
      SELECT jsonb_agg(to_jsonb(d.*))
      FROM documents d
      WHERE d.project_id = p_project_id AND d.updated_at > p_since_time
    ), '[]'::jsonb),
    'entities', COALESCE((
      SELECT jsonb_agg(to_jsonb(e.*))
      FROM entities e
      WHERE e.project_id = p_project_id AND e.updated_at > p_since_time
    ), '[]'::jsonb),
    'relationships', COALESCE((
      SELECT jsonb_agg(to_jsonb(r.*))
      FROM relationships r
      WHERE r.project_id = p_project_id AND r.created_at > p_since_time
    ), '[]'::jsonb),
    'mentions', COALESCE((
      SELECT jsonb_agg(to_jsonb(m.*))
      FROM mentions m
      JOIN documents d ON d.id = m.document_id
      WHERE d.project_id = p_project_id AND m.created_at > p_since_time
    ), '[]'::jsonb),
    'timestamp', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function for optimistic update with version check
CREATE OR REPLACE FUNCTION optimistic_update_document(
  p_id UUID,
  p_expected_version INTEGER,
  p_content JSONB DEFAULT NULL,
  p_title TEXT DEFAULT NULL,
  p_order_index INTEGER DEFAULT NULL,
  p_client_id TEXT DEFAULT NULL
)
RETURNS documents
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  updated_doc documents;
BEGIN
  UPDATE documents
  SET
    content = COALESCE(p_content, content),
    title = COALESCE(p_title, title),
    order_index = COALESCE(p_order_index, order_index),
    client_id = COALESCE(p_client_id, client_id),
    updated_at = NOW()
  WHERE id = p_id
    AND version = p_expected_version
  RETURNING * INTO updated_doc;
  
  IF updated_doc IS NULL THEN
    -- Check if document exists
    IF EXISTS (SELECT 1 FROM documents WHERE id = p_id) THEN
      RAISE EXCEPTION 'Version conflict: document has been modified (expected version %, current version %)',
        p_expected_version,
        (SELECT version FROM documents WHERE id = p_id);
    ELSE
      RAISE EXCEPTION 'Document not found: %', p_id;
    END IF;
  END IF;
  
  RETURN updated_doc;
END;
$$;

-- Function for optimistic update with version check for entities
CREATE OR REPLACE FUNCTION optimistic_update_entity(
  p_id UUID,
  p_expected_version INTEGER,
  p_name TEXT DEFAULT NULL,
  p_aliases TEXT[] DEFAULT NULL,
  p_properties JSONB DEFAULT NULL,
  p_archetype TEXT DEFAULT NULL,
  p_custom_fields JSONB DEFAULT NULL,
  p_client_id TEXT DEFAULT NULL
)
RETURNS entities
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  updated_entity entities;
BEGIN
  UPDATE entities
  SET
    name = COALESCE(p_name, name),
    aliases = COALESCE(p_aliases, aliases),
    properties = COALESCE(p_properties, properties),
    archetype = COALESCE(p_archetype, archetype),
    custom_fields = COALESCE(p_custom_fields, custom_fields),
    client_id = COALESCE(p_client_id, client_id),
    updated_at = NOW()
  WHERE id = p_id
    AND version = p_expected_version
  RETURNING * INTO updated_entity;
  
  IF updated_entity IS NULL THEN
    IF EXISTS (SELECT 1 FROM entities WHERE id = p_id) THEN
      RAISE EXCEPTION 'Version conflict: entity has been modified (expected version %, current version %)',
        p_expected_version,
        (SELECT version FROM entities WHERE id = p_id);
    ELSE
      RAISE EXCEPTION 'Entity not found: %', p_id;
    END IF;
  END IF;
  
  RETURN updated_entity;
END;
$$;

-- Function to get current max versions for sync initialization
CREATE OR REPLACE FUNCTION get_project_versions(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'documents_max_version', COALESCE((SELECT MAX(version) FROM documents WHERE project_id = p_project_id), 0),
    'entities_max_version', COALESCE((SELECT MAX(version) FROM entities WHERE project_id = p_project_id), 0),
    'relationships_max_version', COALESCE((SELECT MAX(version) FROM relationships WHERE project_id = p_project_id), 0),
    'last_updated', GREATEST(
      (SELECT MAX(updated_at) FROM documents WHERE project_id = p_project_id),
      (SELECT MAX(updated_at) FROM entities WHERE project_id = p_project_id),
      (SELECT MAX(created_at) FROM relationships WHERE project_id = p_project_id)
    )
  );
END;
$$;
