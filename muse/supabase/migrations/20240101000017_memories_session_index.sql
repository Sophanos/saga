-- Migration 017: Add composite index for session memory queries
-- Optimizes the common query pattern: (project_id, conversation_id, category)

-- Composite index for session memory retrieval
-- Used when filtering by project + conversation + category (session)
CREATE INDEX IF NOT EXISTS idx_memories_project_conversation_category
  ON memories(project_id, conversation_id, category)
  WHERE deleted_at IS NULL AND conversation_id IS NOT NULL;

-- Also add index for the full session filter pattern including owner
-- Used by retrieval.ts session filter: (project_id, owner_id, conversation_id, category, scope)
CREATE INDEX IF NOT EXISTS idx_memories_session_full
  ON memories(project_id, owner_id, conversation_id, category, scope)
  WHERE deleted_at IS NULL
    AND conversation_id IS NOT NULL
    AND category = 'session'
    AND scope = 'conversation';
