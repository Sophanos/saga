-- Migration 003: Document embeddings and full-text search
-- Extends pgvector support to documents for semantic search

-- Ensure pgvector extension is enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to documents table for semantic search
ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- Add plain text content column for full-text search (extracted from JSONB content)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_text TEXT;

-- Vector similarity search index for documents
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- GIN index for full-text search on document content
CREATE INDEX IF NOT EXISTS idx_documents_content_text_fts ON documents
  USING GIN (to_tsvector('english', COALESCE(content_text, '')));

-- Function for semantic document search
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  project_filter UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.type,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.project_id = project_filter
    AND d.embedding IS NOT NULL
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for full-text search on documents
CREATE OR REPLACE FUNCTION fulltext_search_documents(
  search_query TEXT,
  project_filter UUID,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  type TEXT,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.type,
    ts_rank(to_tsvector('english', COALESCE(d.content_text, '')), plainto_tsquery('english', search_query)) AS rank
  FROM documents d
  WHERE d.project_id = project_filter
    AND to_tsvector('english', COALESCE(d.content_text, '')) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;

-- Hybrid search combining semantic and full-text search
CREATE OR REPLACE FUNCTION hybrid_search_documents(
  query_embedding VECTOR(1536),
  search_query TEXT,
  project_filter UUID,
  semantic_weight FLOAT DEFAULT 0.7,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  type TEXT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH semantic_results AS (
    SELECT
      d.id,
      d.title,
      d.type,
      1 - (d.embedding <=> query_embedding) AS semantic_score
    FROM documents d
    WHERE d.project_id = project_filter
      AND d.embedding IS NOT NULL
  ),
  fulltext_results AS (
    SELECT
      d.id,
      ts_rank(to_tsvector('english', COALESCE(d.content_text, '')), plainto_tsquery('english', search_query)) AS text_score
    FROM documents d
    WHERE d.project_id = project_filter
  )
  SELECT
    sr.id,
    sr.title,
    sr.type,
    (sr.semantic_score * semantic_weight + COALESCE(fr.text_score, 0) * (1 - semantic_weight)) AS combined_score
  FROM semantic_results sr
  LEFT JOIN fulltext_results fr ON sr.id = fr.id
  ORDER BY combined_score DESC
  LIMIT result_limit;
END;
$$;
