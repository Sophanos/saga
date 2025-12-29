-- Migration 016: Memories Table (MLP 2.x)
-- Durable source-of-truth for memory vectors with Qdrant sync tracking.
-- Enables graceful degradation when Qdrant is unavailable.

-- =============================================================================
-- Memories Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Memory classification
  category TEXT NOT NULL CHECK (category IN ('style', 'decision', 'preference', 'session')),
  scope TEXT NOT NULL CHECK (scope IN ('project', 'user', 'conversation')),
  
  -- Ownership (UUID string or anon device id)
  owner_id TEXT,
  conversation_id TEXT,
  
  -- Content
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  
  -- Timestamps (ISO strings + ms for efficient filtering)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at_ts BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  
  -- TTL support
  expires_at TIMESTAMPTZ,
  expires_at_ts BIGINT,
  
  -- Embedding for fallback semantic search (4096 dimensions for Qwen3-Embedding-8B)
  embedding VECTOR(4096),
  
  -- Qdrant sync tracking
  qdrant_sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (qdrant_sync_status IN ('pending', 'synced', 'error')),
  qdrant_synced_at TIMESTAMPTZ,
  qdrant_last_error TEXT,
  
  -- Soft delete for eventual Qdrant cleanup
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_conversation_scope CHECK (
    scope != 'conversation' OR conversation_id IS NOT NULL
  ),
  CONSTRAINT valid_user_scope CHECK (
    scope = 'project' OR owner_id IS NOT NULL
  )
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Primary access patterns
CREATE INDEX IF NOT EXISTS idx_memories_project_category_scope 
  ON memories(project_id, category, scope) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memories_project_owner_category 
  ON memories(project_id, owner_id, category) 
  WHERE deleted_at IS NULL AND owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_memories_project_conversation 
  ON memories(project_id, conversation_id) 
  WHERE deleted_at IS NULL AND conversation_id IS NOT NULL;

-- TTL cleanup
CREATE INDEX IF NOT EXISTS idx_memories_expires_at 
  ON memories(expires_at) 
  WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memories_expires_at_ts 
  ON memories(expires_at_ts) 
  WHERE expires_at_ts IS NOT NULL AND deleted_at IS NULL;

-- Qdrant sync queue
CREATE INDEX IF NOT EXISTS idx_memories_qdrant_pending 
  ON memories(qdrant_sync_status, created_at) 
  WHERE qdrant_sync_status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_memories_qdrant_error 
  ON memories(qdrant_sync_status, created_at) 
  WHERE qdrant_sync_status = 'error' AND deleted_at IS NULL;

-- Soft delete cleanup queue
CREATE INDEX IF NOT EXISTS idx_memories_deleted 
  ON memories(deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- Recency queries
CREATE INDEX IF NOT EXISTS idx_memories_project_created
  ON memories(project_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Note: No vector index for 4096-dim embeddings (HNSW limited to 2000 dims).
-- Postgres vector search is only used as fallback when Qdrant is unavailable.
-- Sequential scan is acceptable for the fallback use case.

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- Helper function to check project access (reuses collaboration logic)
CREATE OR REPLACE FUNCTION has_memory_access(
  p_project_id UUID,
  p_scope TEXT,
  p_owner_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_has_project_access BOOLEAN;
BEGIN
  -- Check project access (owner or collaborator)
  SELECT EXISTS (
    SELECT 1 FROM projects WHERE id = p_project_id AND user_id = v_user_id
    UNION
    SELECT 1 FROM project_collaborators
    WHERE project_id = p_project_id AND user_id = v_user_id
  ) INTO v_has_project_access;

  IF NOT v_has_project_access THEN
    RETURN FALSE;
  END IF;

  -- Project scope is visible to all with project access
  IF p_scope = 'project' THEN
    RETURN TRUE;
  END IF;

  -- User/conversation scope requires ownership match
  RETURN p_owner_id = v_user_id::TEXT;
END;
$$;

-- SELECT policy: Users can view memories they have access to
CREATE POLICY "Users can view accessible memories"
  ON memories FOR SELECT
  USING (
    deleted_at IS NULL AND
    has_memory_access(project_id, scope, owner_id)
  );

-- No INSERT/UPDATE/DELETE policies for users - all writes via SECURITY DEFINER functions

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_memory_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_memories_timestamp ON memories;
CREATE TRIGGER update_memories_timestamp
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_memory_timestamp();

-- =============================================================================
-- Semantic Search Function (Postgres fallback)
-- =============================================================================

/**
 * Search memories by semantic similarity.
 * Used when Qdrant is unavailable.
 */
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding VECTOR(4096),
  match_count INT,
  project_filter UUID,
  category_filter TEXT[] DEFAULT NULL,
  scope_filter TEXT DEFAULT NULL,
  owner_filter TEXT DEFAULT NULL,
  conversation_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  scope TEXT,
  owner_id TEXT,
  conversation_id TEXT,
  created_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.category,
    m.scope,
    m.owner_id,
    m.conversation_id,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM memories m
  WHERE m.project_id = project_filter
    AND m.deleted_at IS NULL
    AND m.embedding IS NOT NULL
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
    AND (category_filter IS NULL OR m.category = ANY(category_filter))
    AND (scope_filter IS NULL OR m.scope = scope_filter)
    AND (owner_filter IS NULL OR m.owner_id = owner_filter)
    AND (conversation_filter IS NULL OR m.conversation_id = conversation_filter)
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- Memory Cleanup Functions
-- =============================================================================

/**
 * Mark expired memories for deletion.
 * Called by cleanup job or opportunistically.
 */
CREATE OR REPLACE FUNCTION mark_expired_memories()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE memories
  SET deleted_at = NOW()
  WHERE deleted_at IS NULL
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

/**
 * Hard delete memories that have been soft-deleted for > retention_days.
 * Allows time for Qdrant cleanup retries.
 */
CREATE OR REPLACE FUNCTION purge_deleted_memories(retention_days INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM memories
  WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

/**
 * Get memories pending Qdrant sync (for retry queue).
 */
CREATE OR REPLACE FUNCTION get_pending_qdrant_sync(batch_size INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  content TEXT,
  embedding VECTOR(4096),
  qdrant_sync_status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, content, embedding, qdrant_sync_status, created_at
  FROM memories
  WHERE deleted_at IS NULL
    AND qdrant_sync_status IN ('pending', 'error')
  ORDER BY
    CASE WHEN qdrant_sync_status = 'pending' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT batch_size;
$$;
