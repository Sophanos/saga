-- Migration 009: Billing System
-- Subscriptions, token usage tracking, and tier configuration

-- Billing mode enum
CREATE TYPE billing_mode AS ENUM ('managed', 'byok');

-- Subscription tier enum
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'pro_plus', 'team');

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'paused');

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  billing_mode billing_mode NOT NULL DEFAULT 'managed',
  status subscription_status NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one subscription
  UNIQUE(user_id)
);

-- Token usage table (tracks usage per billing period)
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Token tracking
  tokens_included INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,

  -- Words written tracking
  words_written INTEGER NOT NULL DEFAULT 0,

  -- AI call counters
  ai_chat_calls INTEGER NOT NULL DEFAULT 0,
  ai_lint_calls INTEGER NOT NULL DEFAULT 0,
  ai_coach_calls INTEGER NOT NULL DEFAULT 0,
  ai_detect_calls INTEGER NOT NULL DEFAULT 0,
  ai_search_calls INTEGER NOT NULL DEFAULT 0,

  -- Additional metadata for detailed tracking
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One usage record per user per period
  UNIQUE(user_id, period_start, period_end)
);

-- Tier configuration table (stores tier allowances and pricing)
CREATE TABLE IF NOT EXISTS tier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  -- Monthly pricing in cents
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents INTEGER NOT NULL DEFAULT 0,

  -- Token allowances (per month)
  tokens_included INTEGER NOT NULL DEFAULT 0,

  -- Feature limits
  max_projects INTEGER,  -- NULL means unlimited
  max_collaborators_per_project INTEGER,  -- NULL means unlimited
  max_words_per_month INTEGER,  -- NULL means unlimited

  -- AI feature access
  ai_chat_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_lint_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_coach_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_detect_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ai_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Feature flags
  priority_support BOOLEAN NOT NULL DEFAULT FALSE,
  custom_models BOOLEAN NOT NULL DEFAULT FALSE,
  api_access BOOLEAN NOT NULL DEFAULT FALSE,
  export_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Metadata for additional config
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period ON subscriptions(current_period_start, current_period_end);

-- Indexes for token_usage
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_period ON token_usage(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_token_usage_user_period ON token_usage(user_id, period_start DESC);

-- Indexes for tier_config
CREATE INDEX IF NOT EXISTS idx_tier_config_tier ON tier_config(tier);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only system can insert subscriptions (via Stripe webhooks)
-- We use a service role key for this, so no INSERT policy for users

-- Users can view their own usage for self-service updates (tier changes)
-- Actual subscription management goes through Stripe
CREATE POLICY "Users can update own subscription metadata"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for token_usage

-- Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- System inserts usage records, but we allow user-context inserts via helper functions
CREATE POLICY "Users can insert own usage"
  ON token_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage (for incrementing counters)
CREATE POLICY "Users can update own usage"
  ON token_usage FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for tier_config

-- Tier config is publicly readable (for pricing pages, etc.)
CREATE POLICY "Tier config is publicly readable"
  ON tier_config FOR SELECT
  USING (true);

-- Only admins can modify tier config (via service role)
-- No INSERT/UPDATE/DELETE policies for regular users

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS update_token_usage_updated_at ON token_usage;
CREATE TRIGGER update_token_usage_updated_at
  BEFORE UPDATE ON token_usage
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

DROP TRIGGER IF EXISTS update_tier_config_updated_at ON tier_config;
CREATE TRIGGER update_tier_config_updated_at
  BEFORE UPDATE ON tier_config
  FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at();

-- Helper function: Get or create current usage record for a user
CREATE OR REPLACE FUNCTION get_or_create_usage_record(p_user_id UUID DEFAULT auth.uid())
RETURNS token_usage
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_sub subscriptions;
  usage_record token_usage;
  period_s TIMESTAMPTZ;
  period_e TIMESTAMPTZ;
  tier_tokens INTEGER;
BEGIN
  -- Get user's subscription
  SELECT * INTO current_sub FROM subscriptions WHERE user_id = p_user_id;

  -- Determine period (use subscription period or calendar month)
  IF current_sub IS NOT NULL AND current_sub.current_period_start IS NOT NULL THEN
    period_s := current_sub.current_period_start;
    period_e := current_sub.current_period_end;
  ELSE
    -- Default to calendar month
    period_s := date_trunc('month', NOW());
    period_e := date_trunc('month', NOW()) + INTERVAL '1 month';
  END IF;

  -- Get tokens included for the tier
  SELECT tokens_included INTO tier_tokens
  FROM tier_config
  WHERE tier = COALESCE(current_sub.tier, 'free');

  tier_tokens := COALESCE(tier_tokens, 0);

  -- Try to get existing record
  SELECT * INTO usage_record
  FROM token_usage
  WHERE user_id = p_user_id
    AND period_start = period_s
    AND period_end = period_e;

  -- Create if not exists
  IF usage_record IS NULL THEN
    INSERT INTO token_usage (user_id, period_start, period_end, tokens_included)
    VALUES (p_user_id, period_s, period_e, tier_tokens)
    RETURNING * INTO usage_record;
  END IF;

  RETURN usage_record;
END;
$$;

-- Helper function: Record token usage
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
  -- Get or create the usage record
  usage_record := get_or_create_usage_record(p_user_id);

  -- Update the appropriate counters
  UPDATE token_usage
  SET
    tokens_used = tokens_used + p_tokens,
    ai_chat_calls = ai_chat_calls + CASE WHEN p_call_type = 'chat' THEN 1 ELSE 0 END,
    ai_lint_calls = ai_lint_calls + CASE WHEN p_call_type = 'lint' THEN 1 ELSE 0 END,
    ai_coach_calls = ai_coach_calls + CASE WHEN p_call_type = 'coach' THEN 1 ELSE 0 END,
    ai_detect_calls = ai_detect_calls + CASE WHEN p_call_type = 'detect' THEN 1 ELSE 0 END,
    ai_search_calls = ai_search_calls + CASE WHEN p_call_type = 'search' THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE id = usage_record.id
  RETURNING * INTO usage_record;

  RETURN usage_record;
END;
$$;

-- Helper function: Record words written
CREATE OR REPLACE FUNCTION record_words_written(
  p_words INTEGER,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS token_usage
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  usage_record token_usage;
BEGIN
  -- Get or create the usage record
  usage_record := get_or_create_usage_record(p_user_id);

  -- Update words written
  UPDATE token_usage
  SET
    words_written = words_written + p_words,
    updated_at = NOW()
  WHERE id = usage_record.id
  RETURNING * INTO usage_record;

  RETURN usage_record;
END;
$$;

-- Helper function: Get billing context for a user
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
STABLE
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

-- Helper function: Check if user can use AI feature
CREATE OR REPLACE FUNCTION can_use_ai_feature(
  p_feature TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_sub subscriptions;
  tier_cfg tier_config;
  usage_record token_usage;
BEGIN
  -- Get subscription
  SELECT * INTO current_sub FROM subscriptions WHERE user_id = p_user_id;

  -- Get tier config
  SELECT * INTO tier_cfg FROM tier_config WHERE tier = COALESCE(current_sub.tier, 'free');

  -- If no tier config, deny access
  IF tier_cfg IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check if feature is enabled for tier
  IF p_feature = 'chat' AND NOT tier_cfg.ai_chat_enabled THEN RETURN FALSE; END IF;
  IF p_feature = 'lint' AND NOT tier_cfg.ai_lint_enabled THEN RETURN FALSE; END IF;
  IF p_feature = 'coach' AND NOT tier_cfg.ai_coach_enabled THEN RETURN FALSE; END IF;
  IF p_feature = 'detect' AND NOT tier_cfg.ai_detect_enabled THEN RETURN FALSE; END IF;
  IF p_feature = 'search' AND NOT tier_cfg.ai_search_enabled THEN RETURN FALSE; END IF;

  -- BYOK mode bypasses token limits
  IF current_sub IS NOT NULL AND current_sub.billing_mode = 'byok' THEN
    RETURN TRUE;
  END IF;

  -- Check token usage
  usage_record := get_or_create_usage_record(p_user_id);

  -- Allow if under limit
  RETURN usage_record.tokens_used < usage_record.tokens_included;
END;
$$;

-- Function to create a subscription for a new user (called from trigger)
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier, billing_mode, status)
  VALUES (NEW.id, 'free', 'managed', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to auto-create subscription on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- Insert default tier configurations
-- Pricing: Pro $20, Pro+ $40, Team $99 (MANAGED mode)
-- BYOK pricing is handled at checkout (50% discount)
INSERT INTO tier_config (tier, name, description, price_monthly_cents, price_yearly_cents, tokens_included, max_projects, max_collaborators_per_project, ai_chat_enabled, ai_lint_enabled, ai_coach_enabled, ai_detect_enabled, ai_search_enabled, priority_support, custom_models, api_access)
VALUES
  ('free', 'Free', 'Get started with basic features', 0, 0, 10000, 3, 1, TRUE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE),
  ('pro', 'Pro', 'For serious writers', 2000, 19200, 500000, 10, 3, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE),
  ('pro_plus', 'Pro+', 'Advanced features for power users', 4000, 38400, 2000000, NULL, 10, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE),
  ('team', 'Team', 'Collaborate with your writing team', 9900, 95040, 10000000, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  tokens_included = EXCLUDED.tokens_included,
  max_projects = EXCLUDED.max_projects,
  max_collaborators_per_project = EXCLUDED.max_collaborators_per_project,
  ai_chat_enabled = EXCLUDED.ai_chat_enabled,
  ai_lint_enabled = EXCLUDED.ai_lint_enabled,
  ai_coach_enabled = EXCLUDED.ai_coach_enabled,
  ai_detect_enabled = EXCLUDED.ai_detect_enabled,
  ai_search_enabled = EXCLUDED.ai_search_enabled,
  priority_support = EXCLUDED.priority_support,
  custom_models = EXCLUDED.custom_models,
  api_access = EXCLUDED.api_access,
  updated_at = NOW();
