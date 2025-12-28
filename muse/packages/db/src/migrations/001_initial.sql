-- Mythos IDE Database Schema
-- Run this migration in Supabase SQL Editor

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  genre TEXT,
  style_config JSONB DEFAULT '{}',
  linter_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Entities table (Characters, Locations, Items, etc.)
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('character', 'location', 'item', 'magic_system', 'faction', 'event', 'concept')),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  properties JSONB DEFAULT '{}',
  archetype TEXT,
  embedding VECTOR(1536), -- For semantic search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  bidirectional BOOLEAN DEFAULT FALSE,
  strength INTEGER CHECK (strength >= 1 AND strength <= 10),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents table (Chapters, Scenes, Notes)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('chapter', 'scene', 'note', 'outline', 'worldbuilding')),
  title TEXT,
  content JSONB, -- Tiptap JSON content
  order_index INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity mentions table (tracks where entities appear in text)
CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position_start INTEGER NOT NULL,
  position_end INTEGER NOT NULL,
  context TEXT NOT NULL, -- Surrounding text for quick lookup
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entities_project ON entities(project_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(project_id, type);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(project_id, name);
CREATE INDEX IF NOT EXISTS idx_relationships_project ON relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_mentions_entity ON mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_mentions_document ON mentions(document_id);

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_entities_embedding ON entities
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Function for semantic entity search
CREATE OR REPLACE FUNCTION search_entities(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  project_filter UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.type,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM entities e
  WHERE e.project_id = project_filter
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

-- Policies (users can only access their own projects)
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);

-- Entities inherit project permissions
CREATE POLICY "Entities follow project access" ON entities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = entities.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );

-- Similar policies for other tables
CREATE POLICY "Relationships follow project access" ON relationships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = relationships.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );

CREATE POLICY "Documents follow project access" ON documents
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = documents.project_id
      AND (projects.user_id = auth.uid() OR projects.user_id IS NULL)
    )
  );

CREATE POLICY "Mentions follow document access" ON mentions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM documents d
      JOIN projects p ON p.id = d.project_id
      WHERE d.id = mentions.document_id
      AND (p.user_id = auth.uid() OR p.user_id IS NULL)
    )
  );
