-- Migration 021: Image Generation Call Tracking
-- Adds ai_image_calls column and updates constraints for image endpoints

-- =============================================================================
-- Add ai_image_calls column to token_usage
-- =============================================================================

ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS ai_image_calls INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- Update ai_request_logs endpoint constraint
-- =============================================================================

-- Drop existing constraint
ALTER TABLE ai_request_logs DROP CONSTRAINT IF EXISTS valid_endpoint;

-- Add updated constraint with 'image' and 'image-scene'
ALTER TABLE ai_request_logs ADD CONSTRAINT valid_endpoint
  CHECK (endpoint IN ('chat', 'lint', 'coach', 'detect', 'dynamics', 'search', 'agent', 'genesis', 'embed', 'image', 'image-scene'));

-- =============================================================================
-- Update record_token_usage function to handle 'image' call type
-- =============================================================================

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
  -- Validate call_type parameter (extended list with image)
  IF p_call_type NOT IN ('chat', 'lint', 'coach', 'detect', 'search', 'agent', 'dynamics', 'genesis', 'embed', 'image', 'image-scene') THEN
    RAISE EXCEPTION 'Invalid call_type: %', p_call_type;
  END IF;

  -- Get or create the usage record
  usage_record := get_or_create_usage_record(p_user_id);

  -- Update the appropriate counters
  -- agent/genesis/dynamics map to chat, embed maps to search, image/image-scene map to image
  UPDATE token_usage
  SET
    tokens_used = tokens_used + p_tokens,
    ai_chat_calls = ai_chat_calls + CASE WHEN p_call_type IN ('chat', 'agent', 'genesis', 'dynamics') THEN 1 ELSE 0 END,
    ai_lint_calls = ai_lint_calls + CASE WHEN p_call_type = 'lint' THEN 1 ELSE 0 END,
    ai_coach_calls = ai_coach_calls + CASE WHEN p_call_type = 'coach' THEN 1 ELSE 0 END,
    ai_detect_calls = ai_detect_calls + CASE WHEN p_call_type = 'detect' THEN 1 ELSE 0 END,
    ai_search_calls = ai_search_calls + CASE WHEN p_call_type IN ('search', 'embed') THEN 1 ELSE 0 END,
    ai_image_calls = ai_image_calls + CASE WHEN p_call_type IN ('image', 'image-scene') THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = usage_record.id
  RETURNING * INTO usage_record;

  RETURN usage_record;
END;
$$;

-- =============================================================================
-- Update get_billing_context to return ai_image_calls
-- =============================================================================

-- Must drop first since we're changing the return type (adding ai_image_calls)
DROP FUNCTION IF EXISTS get_billing_context(UUID);

CREATE OR REPLACE FUNCTION get_billing_context(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  subscription_id UUID,
  tier subscription_tier,
  billing_mode billing_mode,
  status subscription_status,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  tokens_included INTEGER,
  tokens_used INTEGER,
  tokens_remaining INTEGER,
  words_written INTEGER,
  ai_chat_calls INTEGER,
  ai_lint_calls INTEGER,
  ai_coach_calls INTEGER,
  ai_detect_calls INTEGER,
  ai_search_calls INTEGER,
  ai_image_calls INTEGER,
  tier_name TEXT,
  ai_chat_enabled BOOLEAN,
  ai_lint_enabled BOOLEAN,
  ai_coach_enabled BOOLEAN,
  ai_detect_enabled BOOLEAN,
  ai_search_enabled BOOLEAN,
  max_projects INTEGER,
  is_over_limit BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_sub subscriptions;
  usage_record token_usage;
  tier_cfg tier_config;
BEGIN
  -- Get subscription
  SELECT * INTO current_sub FROM subscriptions WHERE subscriptions.user_id = p_user_id;

  -- Get or create usage record
  usage_record := get_or_create_usage_record(p_user_id);

  -- Get tier config
  SELECT * INTO tier_cfg FROM tier_config WHERE tier_config.tier = COALESCE(current_sub.tier, 'free');

  -- Return the billing context
  RETURN QUERY SELECT
    current_sub.id AS subscription_id,
    COALESCE(current_sub.tier, 'free'::subscription_tier) AS tier,
    COALESCE(current_sub.billing_mode, 'managed'::billing_mode) AS billing_mode,
    COALESCE(current_sub.status, 'active'::subscription_status) AS status,
    usage_record.period_start,
    usage_record.period_end,
    usage_record.tokens_included,
    usage_record.tokens_used,
    GREATEST(0, usage_record.tokens_included - usage_record.tokens_used) AS tokens_remaining,
    usage_record.words_written,
    usage_record.ai_chat_calls,
    usage_record.ai_lint_calls,
    usage_record.ai_coach_calls,
    usage_record.ai_detect_calls,
    usage_record.ai_search_calls,
    usage_record.ai_image_calls,
    COALESCE(tier_cfg.name, 'Free') AS tier_name,
    COALESCE(tier_cfg.ai_chat_enabled, FALSE) AS ai_chat_enabled,
    COALESCE(tier_cfg.ai_lint_enabled, FALSE) AS ai_lint_enabled,
    COALESCE(tier_cfg.ai_coach_enabled, FALSE) AS ai_coach_enabled,
    COALESCE(tier_cfg.ai_detect_enabled, FALSE) AS ai_detect_enabled,
    COALESCE(tier_cfg.ai_search_enabled, FALSE) AS ai_search_enabled,
    tier_cfg.max_projects,
    (usage_record.tokens_used >= usage_record.tokens_included) AS is_over_limit;
END;
$$;

-- =============================================================================
-- DOWN MIGRATION (for rollback)
-- =============================================================================
-- To rollback this migration, run:
--
-- ALTER TABLE token_usage DROP COLUMN IF EXISTS ai_image_calls;
--
-- ALTER TABLE ai_request_logs DROP CONSTRAINT IF EXISTS valid_endpoint;
-- ALTER TABLE ai_request_logs ADD CONSTRAINT valid_endpoint
--   CHECK (endpoint IN ('chat', 'lint', 'coach', 'detect', 'dynamics', 'search', 'agent', 'genesis', 'embed'));
--
-- Then restore the original record_token_usage and get_billing_context functions
-- from migration 012/009.
