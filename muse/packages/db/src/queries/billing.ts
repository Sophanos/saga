import { getSupabaseClient } from "../client";

// Billing mode types (matches billing_mode enum in DB)
export type BillingMode = "managed" | "byok";

// Subscription tier types (matches subscription_tier enum in DB)
export type SubscriptionTier = "free" | "pro" | "pro_plus" | "team";

// Subscription status types (matches subscription_status enum in DB)
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

// Subscription types (matches subscriptions table schema)
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: SubscriptionTier;
  billing_mode: BillingMode;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInsert {
  user_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  tier?: SubscriptionTier;
  billing_mode?: BillingMode;
  status?: SubscriptionStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionUpdate {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  tier?: SubscriptionTier;
  billing_mode?: BillingMode;
  status?: SubscriptionStatus;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  metadata?: Record<string, unknown>;
}

// Token usage record (matches token_usage table schema)
export interface TokenUsageRecord {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  tokens_included: number;
  tokens_used: number;
  words_written: number;
  ai_chat_calls: number;
  ai_lint_calls: number;
  ai_coach_calls: number;
  ai_detect_calls: number;
  ai_search_calls: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Billing context returned from get_billing_context RPC
export interface BillingContextRow {
  subscription_id: string | null;
  tier: SubscriptionTier;
  billing_mode: BillingMode;
  status: SubscriptionStatus;
  period_start: string;
  period_end: string;
  tokens_included: number;
  tokens_used: number;
  tokens_remaining: number;
  words_written: number;
  ai_chat_calls: number;
  ai_lint_calls: number;
  ai_coach_calls: number;
  ai_detect_calls: number;
  ai_search_calls: number;
  tier_name: string;
  ai_chat_enabled: boolean;
  ai_lint_enabled: boolean;
  ai_coach_enabled: boolean;
  ai_detect_enabled: boolean;
  ai_search_enabled: boolean;
  max_projects: number | null;
  is_over_limit: boolean;
}

// Billing context for application use (camelCase version)
export interface BillingContext {
  subscriptionId: string | null;
  tier: SubscriptionTier;
  billingMode: BillingMode;
  status: SubscriptionStatus;
  periodStart: string;
  periodEnd: string;
  tokensIncluded: number;
  tokensUsed: number;
  tokensRemaining: number;
  wordsWritten: number;
  aiChatCalls: number;
  aiLintCalls: number;
  aiCoachCalls: number;
  aiDetectCalls: number;
  aiSearchCalls: number;
  tierName: string;
  aiChatEnabled: boolean;
  aiLintEnabled: boolean;
  aiCoachEnabled: boolean;
  aiDetectEnabled: boolean;
  aiSearchEnabled: boolean;
  maxProjects: number | null;
  isOverLimit: boolean;
}

// Tier configuration (matches tier_config table schema)
export interface TierConfig {
  id: string;
  tier: SubscriptionTier;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  tokens_included: number;
  max_projects: number | null;
  max_collaborators_per_project: number | null;
  max_words_per_month: number | null;
  ai_chat_enabled: boolean;
  ai_lint_enabled: boolean;
  ai_coach_enabled: boolean;
  ai_detect_enabled: boolean;
  ai_search_enabled: boolean;
  priority_support: boolean;
  custom_models: boolean;
  api_access: boolean;
  export_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// AI call types for token usage tracking
export type AICallType = "chat" | "lint" | "coach" | "detect" | "search";

// AI feature types for permission checking
export type AIFeature = "chat" | "lint" | "coach" | "detect" | "search";

/**
 * Get a user's subscription
 */
export async function getSubscription(
  userId: string
): Promise<Subscription | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  return data as Subscription;
}

/**
 * Get or create a subscription for a user (ensures subscription exists)
 */
export async function getOrCreateSubscription(
  userId: string
): Promise<Subscription> {
  const existing = await getSubscription(userId);
  if (existing) return existing;

  const supabase = getSupabaseClient();
  const defaultSubscription: SubscriptionInsert = {
    user_id: userId,
    tier: "free",
    billing_mode: "managed",
    status: "active",
    cancel_at_period_end: false,
  };

  const { data, error } = await supabase
    .from("subscriptions")
    .insert(defaultSubscription as never)
    .select()
    .single();

  if (error) {
    // Handle race condition - another process may have created it
    if (error.code === "23505") {
      const retryData = await getSubscription(userId);
      if (retryData) return retryData;
    }
    throw new Error(`Failed to create subscription: ${error.message}`);
  }

  return data as Subscription;
}

/**
 * Update a user's subscription
 */
export async function updateSubscription(
  userId: string,
  updates: SubscriptionUpdate
): Promise<Subscription> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .update(updates as never)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  return data as Subscription;
}

/**
 * Get current period usage for a user via get_billing_context RPC
 */
export async function getCurrentUsage(userId: string): Promise<{
  tokensUsed: number;
  tokensIncluded: number;
  tokensRemaining: number;
  wordsWritten: number;
  periodStart: string | null;
  periodEnd: string | null;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("get_billing_context", {
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to get current usage: ${error.message}`);
  }

  // RPC returns an array with one row
  const row = (data as BillingContextRow[] | null)?.[0];

  if (!row) {
    return {
      tokensUsed: 0,
      tokensIncluded: 0,
      tokensRemaining: 0,
      wordsWritten: 0,
      periodStart: null,
      periodEnd: null,
    };
  }

  return {
    tokensUsed: row.tokens_used,
    tokensIncluded: row.tokens_included,
    tokensRemaining: row.tokens_remaining,
    wordsWritten: row.words_written,
    periodStart: row.period_start,
    periodEnd: row.period_end,
  };
}

/**
 * Record AI token usage for a user via record_token_usage RPC
 */
export async function recordTokenUsage(
  userId: string,
  tokens: number,
  callType: AICallType
): Promise<TokenUsageRecord> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("record_token_usage", {
    p_tokens: tokens,
    p_call_type: callType,
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to record token usage: ${error.message}`);
  }

  return data as TokenUsageRecord;
}

/**
 * Record words written by a user via record_words_written RPC
 */
export async function recordWordsWritten(
  userId: string,
  wordsDelta: number
): Promise<TokenUsageRecord> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("record_words_written", {
    p_words: wordsDelta,
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to record words written: ${error.message}`);
  }

  return data as TokenUsageRecord;
}

/**
 * Get billing context for quota checks via get_billing_context RPC
 */
export async function getBillingContext(userId: string): Promise<BillingContext> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("get_billing_context", {
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to get billing context: ${error.message}`);
  }

  // RPC returns an array with one row
  const row = (data as BillingContextRow[] | null)?.[0];

  if (!row) {
    // Return default free tier context if no data
    return {
      subscriptionId: null,
      tier: "free",
      billingMode: "managed",
      status: "active",
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      tokensIncluded: 0,
      tokensUsed: 0,
      tokensRemaining: 0,
      wordsWritten: 0,
      aiChatCalls: 0,
      aiLintCalls: 0,
      aiCoachCalls: 0,
      aiDetectCalls: 0,
      aiSearchCalls: 0,
      tierName: "Free",
      aiChatEnabled: false,
      aiLintEnabled: false,
      aiCoachEnabled: false,
      aiDetectEnabled: false,
      aiSearchEnabled: false,
      maxProjects: null,
      isOverLimit: false,
    };
  }

  return {
    subscriptionId: row.subscription_id,
    tier: row.tier,
    billingMode: row.billing_mode,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    tokensIncluded: row.tokens_included,
    tokensUsed: row.tokens_used,
    tokensRemaining: row.tokens_remaining,
    wordsWritten: row.words_written,
    aiChatCalls: row.ai_chat_calls,
    aiLintCalls: row.ai_lint_calls,
    aiCoachCalls: row.ai_coach_calls,
    aiDetectCalls: row.ai_detect_calls,
    aiSearchCalls: row.ai_search_calls,
    tierName: row.tier_name,
    aiChatEnabled: row.ai_chat_enabled,
    aiLintEnabled: row.ai_lint_enabled,
    aiCoachEnabled: row.ai_coach_enabled,
    aiDetectEnabled: row.ai_detect_enabled,
    aiSearchEnabled: row.ai_search_enabled,
    maxProjects: row.max_projects,
    isOverLimit: row.is_over_limit,
  };
}

/**
 * Check if a user can use an AI feature via can_use_ai_feature RPC
 */
export async function canUseAIFeature(
  userId: string,
  feature: AIFeature
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("can_use_ai_feature", {
    p_feature: feature,
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to check AI feature access: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Get or create usage record for a user via get_or_create_usage_record RPC
 */
export async function getOrCreateUsageRecord(
  userId: string
): Promise<TokenUsageRecord> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("get_or_create_usage_record", {
    p_user_id: userId,
  } as never);

  if (error) {
    throw new Error(`Failed to get or create usage record: ${error.message}`);
  }

  return data as TokenUsageRecord;
}

/**
 * Get all tier configurations
 */
export async function getTierConfig(): Promise<TierConfig[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tier_config")
    .select("*")
    .order("price_monthly_cents", { ascending: true });

  if (error) {
    // Return default config if table doesn't exist or is empty
    if (error.code === "42P01" || error.code === "PGRST116") {
      return getDefaultTierConfig();
    }
    throw new Error(`Failed to fetch tier config: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return getDefaultTierConfig();
  }

  return data as TierConfig[];
}

/**
 * Get tier configuration for a specific tier
 */
export async function getTierConfigByTier(
  tier: SubscriptionTier
): Promise<TierConfig | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("tier_config")
    .select("*")
    .eq("tier", tier)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch tier config: ${error.message}`);
  }

  return data as TierConfig;
}

/**
 * Get default tier configuration (fallback)
 */
function getDefaultTierConfig(): TierConfig[] {
  const now = new Date().toISOString();
  return [
    {
      id: "default-free",
      tier: "free",
      name: "Free",
      description: "Get started with basic features",
      price_monthly_cents: 0,
      price_yearly_cents: 0,
      tokens_included: 10000,
      max_projects: 3,
      max_collaborators_per_project: 1,
      max_words_per_month: null,
      ai_chat_enabled: true,
      ai_lint_enabled: false,
      ai_coach_enabled: false,
      ai_detect_enabled: true,
      ai_search_enabled: true,
      priority_support: false,
      custom_models: false,
      api_access: false,
      export_enabled: true,
      metadata: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: "default-pro",
      tier: "pro",
      name: "Pro",
      description: "For serious writers",
      price_monthly_cents: 2000, // $20/mo
      price_yearly_cents: 19200, // $192/yr (20% off)
      tokens_included: 500000, // 500K tokens
      max_projects: 10,
      max_collaborators_per_project: 3,
      max_words_per_month: null,
      ai_chat_enabled: true,
      ai_lint_enabled: true,
      ai_coach_enabled: true,
      ai_detect_enabled: true,
      ai_search_enabled: true,
      priority_support: false,
      custom_models: false,
      api_access: false,
      export_enabled: true,
      metadata: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: "default-pro-plus",
      tier: "pro_plus",
      name: "Pro+",
      description: "Advanced features for power users",
      price_monthly_cents: 4000, // $40/mo
      price_yearly_cents: 38400, // $384/yr (20% off)
      tokens_included: 2000000, // 2M tokens
      max_projects: null,
      max_collaborators_per_project: 10,
      max_words_per_month: null,
      ai_chat_enabled: true,
      ai_lint_enabled: true,
      ai_coach_enabled: true,
      ai_detect_enabled: true,
      ai_search_enabled: true,
      priority_support: true,
      custom_models: true,
      api_access: false,
      export_enabled: true,
      metadata: {},
      created_at: now,
      updated_at: now,
    },
    {
      id: "default-team",
      tier: "team",
      name: "Team",
      description: "Collaborate with your writing team",
      price_monthly_cents: 9900, // $99/mo
      price_yearly_cents: 95040, // $950.40/yr (20% off)
      tokens_included: 10000000, // 10M tokens
      max_projects: null,
      max_collaborators_per_project: null,
      max_words_per_month: null,
      ai_chat_enabled: true,
      ai_lint_enabled: true,
      ai_coach_enabled: true,
      ai_detect_enabled: true,
      ai_search_enabled: true,
      priority_support: true,
      custom_models: true,
      api_access: true,
      export_enabled: true,
      metadata: {},
      created_at: now,
      updated_at: now,
    },
  ];
}
