-- Migration 012: AI Request Logs
-- Detailed per-request logging for billing analytics
-- Reuses existing record_token_usage() for aggregate updates

-- First, extend record_token_usage to support additional call types
CREATE OR REPLACE FUNCTION record_token_usage(
  p_tokens INTEGER,
  p_call_type TEXT DEFAULT 'chat',
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS token_usage
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  usage_record token_usage;
BEGIN
  -- Validate call_type parameter (extended list)
  IF p_call_type NOT IN ('chat', 'lint', 'coach', 'detect', 'search', 'agent', 'dynamics', 'genesis', 'embed') THEN
    RAISE EXCEPTION 'Invalid call_type: %', p_call_type;
  END IF;

  -- Get or create the usage record
  usage_record := get_or_create_usage_record(p_user_id);

  -- Update the appropriate counters
  -- agent/genesis/dynamics map to chat, embed maps to search
  UPDATE token_usage
  SET
    tokens_used = tokens_used + p_tokens,
    ai_chat_calls = ai_chat_calls + CASE WHEN p_call_type IN ('chat', 'agent', 'genesis', 'dynamics') THEN 1 ELSE 0 END,
    ai_lint_calls = ai_lint_calls + CASE WHEN p_call_type = 'lint' THEN 1 ELSE 0 END,
    ai_coach_calls = ai_coach_calls + CASE WHEN p_call_type = 'coach' THEN 1 ELSE 0 END,
    ai_detect_calls = ai_detect_calls + CASE WHEN p_call_type = 'detect' THEN 1 ELSE 0 END,
    ai_search_calls = ai_search_calls + CASE WHEN p_call_type IN ('search', 'embed') THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = usage_record.id
  RETURNING * INTO usage_record;

  RETURN usage_record;
END;
$$;

-- AI Request Logs Table (detailed per-request tracking)
CREATE TABLE IF NOT EXISTS ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID,

  -- Request identification
  endpoint TEXT NOT NULL,
  request_id TEXT,

  -- Model info
  model TEXT NOT NULL,
  model_type TEXT,

  -- Token usage (from provider response)
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Performance
  latency_ms INTEGER,

  -- Billing context
  billing_mode TEXT NOT NULL,
  subscription_tier TEXT,

  -- Status
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_code TEXT,
  error_message TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_endpoint CHECK (endpoint IN ('chat', 'lint', 'coach', 'detect', 'dynamics', 'search', 'agent', 'genesis', 'embed')),
  CONSTRAINT valid_billing_mode CHECK (billing_mode IN ('managed', 'byok')),
  CONSTRAINT tokens_non_negative CHECK (prompt_tokens >= 0 AND completion_tokens >= 0 AND total_tokens >= 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_user_time ON ai_request_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_endpoint ON ai_request_logs(endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_billing_mode ON ai_request_logs(billing_mode, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_project ON ai_request_logs(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_errors ON ai_request_logs(created_at DESC) WHERE success = FALSE;

-- Enable RLS
ALTER TABLE ai_request_logs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own logs
CREATE POLICY "Users can view own request logs"
  ON ai_request_logs FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE for users - all writes via SECURITY DEFINER functions

-- Record AI request (detailed log + aggregate update)
-- Tracks BOTH managed AND byok users for analytics
CREATE OR REPLACE FUNCTION record_ai_request(
  p_user_id UUID,
  p_endpoint TEXT,
  p_model TEXT,
  p_model_type TEXT,
  p_prompt_tokens INTEGER,
  p_completion_tokens INTEGER,
  p_total_tokens INTEGER,
  p_latency_ms INTEGER,
  p_billing_mode TEXT,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_tier TEXT;
BEGIN
  -- Get user's subscription tier
  SELECT tier::TEXT INTO v_tier FROM subscriptions WHERE user_id = p_user_id;

  -- Insert detailed log
  INSERT INTO ai_request_logs (
    user_id, endpoint, model, model_type,
    prompt_tokens, completion_tokens, total_tokens, latency_ms,
    billing_mode, subscription_tier, success, error_code, error_message,
    project_id, request_id, metadata
  ) VALUES (
    p_user_id, p_endpoint, p_model, p_model_type,
    COALESCE(p_prompt_tokens, 0), COALESCE(p_completion_tokens, 0), COALESCE(p_total_tokens, 0), p_latency_ms,
    p_billing_mode, COALESCE(v_tier, 'free'), COALESCE(p_success, TRUE), p_error_code, p_error_message,
    p_project_id, p_request_id, COALESCE(p_metadata, '{}'::JSONB)
  )
  RETURNING id INTO v_log_id;

  -- Update aggregates for successful requests (reuses existing function)
  IF COALESCE(p_success, TRUE) AND p_user_id IS NOT NULL THEN
    PERFORM record_token_usage(COALESCE(p_total_tokens, 0), p_endpoint, p_user_id);
  END IF;

  RETURN v_log_id;
END;
$$;

-- Get user's request analytics (aggregated by endpoint)
CREATE OR REPLACE FUNCTION get_user_request_analytics(
  p_user_id UUID DEFAULT auth.uid(),
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  endpoint TEXT,
  request_count BIGINT,
  total_tokens BIGINT,
  avg_latency_ms NUMERIC,
  success_rate NUMERIC,
  byok_count BIGINT,
  managed_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.endpoint,
    COUNT(*)::BIGINT AS request_count,
    COALESCE(SUM(l.total_tokens), 0)::BIGINT AS total_tokens,
    COALESCE(AVG(l.latency_ms), 0)::NUMERIC AS avg_latency_ms,
    COALESCE(COUNT(*) FILTER (WHERE l.success)::NUMERIC / NULLIF(COUNT(*), 0), 1)::NUMERIC AS success_rate,
    COUNT(*) FILTER (WHERE l.billing_mode = 'byok')::BIGINT AS byok_count,
    COUNT(*) FILTER (WHERE l.billing_mode = 'managed')::BIGINT AS managed_count
  FROM ai_request_logs l
  WHERE l.user_id = p_user_id
    AND l.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY l.endpoint
  ORDER BY request_count DESC;
END;
$$;
