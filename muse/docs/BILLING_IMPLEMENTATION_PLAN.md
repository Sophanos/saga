# Billing & Usage System - Implementation Plan

> Comprehensive plan for Usage Dashboard + Hybrid Billing (MANAGED/BYOK)

## Executive Summary

This plan implements:
1. **Usage Dashboard** - Track words written, AI tokens used, projects, entities
2. **Hybrid Billing Model** - MANAGED (included tokens) vs BYOK (user provides key)
3. **Stripe Integration** - Subscriptions with metered overage billing

---

## Current State Analysis

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| Word count (per doc) | Exists | `apps/web/src/stores/index.ts` (`EditorState.wordCount`) |
| Token usage (returned) | Exists but not stored | `supabase/functions/_shared/deepinfra.ts` |
| BYOK key storage | Exists | `apps/web/src/hooks/useApiKey.ts` (localStorage) |
| BYOK header passing | Exists | `apps/web/src/services/api-client.ts` (`x-openrouter-key`) |
| API key extraction | Exists | `supabase/functions/_shared/api-key.ts` |
| Pricing tiers UI | Exists (landing only) | `apps/website/src/pages/LandingPage.tsx` |
| Settings components | Exists | `apps/web/src/components/settings/` |
| Billing snapshot endpoint | Exists (Convex HTTP) | `convex/billing.ts`, `convex/http.ts` |

### What's Missing

| Component | Priority |
|-----------|----------|
| `subscriptions` table | P0 |
| `token_usage` table | P0 |
| Usage aggregation by user | P0 |
| Stripe SDK integration | P0 |
| Billing state store | P1 |
| Usage Dashboard UI | P1 |
| Billing mode toggle UI | P1 |
| Quota enforcement middleware | P1 |

---

## Pricing Tiers

| Tier | Monthly (MANAGED) | Monthly (BYOK) | Tokens Included | Overage |
|------|-------------------|----------------|-----------------|---------|
| Free | $0 | $0 | 10,000 | None |
| Pro | $20 | $10 | 500,000 | $0.10/1K |
| Team | $50 | $25 | 2,000,000 | $0.08/1K |
| Enterprise | Custom | Custom | Unlimited | Custom |

Note: For Convex-backed tiers, the source of truth for limits is `muse/convex/lib/tierConfig.ts`.

---

## Database Schema

### Migration: `009_billing.sql`

**Location:** `packages/db/src/migrations/009_billing.sql`

```sql
-- Billing Mode and Tier Enums
CREATE TYPE billing_mode AS ENUM ('managed', 'byok');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'team', 'enterprise');

-- Subscriptions Table
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stripe
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  
  -- Subscription state
  tier subscription_tier NOT NULL DEFAULT 'free',
  billing_mode billing_mode NOT NULL DEFAULT 'managed',
  status TEXT NOT NULL DEFAULT 'active',
  
  -- Period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Token Usage Table (monthly aggregation)
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Tokens
  tokens_included INTEGER NOT NULL DEFAULT 0,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  tokens_overage INTEGER GENERATED ALWAYS AS (GREATEST(0, tokens_used - tokens_included)) STORED,
  
  -- Words (writing metrics)
  words_written INTEGER NOT NULL DEFAULT 0,
  
  -- AI calls breakdown
  ai_calls_chat INTEGER DEFAULT 0,
  ai_calls_lint INTEGER DEFAULT 0,
  ai_calls_coach INTEGER DEFAULT 0,
  ai_calls_detect INTEGER DEFAULT 0,
  ai_calls_search INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, period_start)
);

-- Tier Configuration
CREATE TABLE tier_config (
  tier subscription_tier PRIMARY KEY,
  tokens_included INTEGER NOT NULL,
  price_managed_cents INTEGER NOT NULL,
  price_byok_cents INTEGER NOT NULL,
  overage_rate_cents INTEGER NOT NULL, -- per 1K tokens
  max_projects INTEGER,
  max_collaborators INTEGER
);

INSERT INTO tier_config VALUES
  ('free', 10000, 0, 0, 0, 3, 0),
  ('pro', 500000, 2000, 1000, 10, 20, 0),
  ('team', 2000000, 5000, 2500, 8, 100, 10),
  ('enterprise', 0, 0, 0, 0, 1000, 100);

-- Indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_token_usage_user_period ON token_usage(user_id, period_start);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users read own usage" ON token_usage
  FOR SELECT USING (auth.uid() = user_id);

-- Function: Record token usage
CREATE OR REPLACE FUNCTION record_token_usage(
  p_user_id UUID,
  p_tokens INTEGER,
  p_call_type TEXT DEFAULT 'other'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_period_start DATE := date_trunc('month', NOW())::DATE;
  v_period_end DATE := (date_trunc('month', NOW()) + INTERVAL '1 month')::DATE;
  v_tokens_included INTEGER;
BEGIN
  -- Get user's token allowance
  SELECT tc.tokens_included INTO v_tokens_included
  FROM subscriptions s
  JOIN tier_config tc ON s.tier = tc.tier
  WHERE s.user_id = p_user_id;
  
  -- Upsert usage record
  INSERT INTO token_usage (user_id, period_start, period_end, tokens_included, tokens_used)
  VALUES (p_user_id, v_period_start, v_period_end, COALESCE(v_tokens_included, 10000), p_tokens)
  ON CONFLICT (user_id, period_start) DO UPDATE SET
    tokens_used = token_usage.tokens_used + p_tokens,
    updated_at = NOW();
  
  -- Update call type counter
  EXECUTE format('UPDATE token_usage SET ai_calls_%s = ai_calls_%s + 1 WHERE user_id = $1 AND period_start = $2', p_call_type, p_call_type)
  USING p_user_id, v_period_start;
END;
$$;

-- Function: Record words written
CREATE OR REPLACE FUNCTION record_words_written(
  p_user_id UUID,
  p_words INTEGER
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO token_usage (user_id, period_start, period_end, tokens_included, words_written)
  VALUES (
    p_user_id, 
    date_trunc('month', NOW())::DATE,
    (date_trunc('month', NOW()) + INTERVAL '1 month')::DATE,
    10000, 
    p_words
  )
  ON CONFLICT (user_id, period_start) DO UPDATE SET
    words_written = token_usage.words_written + p_words,
    updated_at = NOW();
END;
$$;

-- Function: Get user billing context
CREATE OR REPLACE FUNCTION get_billing_context(p_user_id UUID)
RETURNS TABLE (
  tier subscription_tier,
  billing_mode billing_mode,
  tokens_included INTEGER,
  tokens_used INTEGER,
  tokens_remaining INTEGER,
  can_use_ai BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_sub subscriptions;
  v_usage token_usage;
  v_config tier_config;
BEGIN
  SELECT * INTO v_sub FROM subscriptions WHERE user_id = p_user_id;
  SELECT * INTO v_config FROM tier_config WHERE tier = COALESCE(v_sub.tier, 'free');
  SELECT * INTO v_usage FROM token_usage 
    WHERE user_id = p_user_id AND period_start = date_trunc('month', NOW())::DATE;
  
  RETURN QUERY SELECT
    COALESCE(v_sub.tier, 'free'),
    COALESCE(v_sub.billing_mode, 'managed'),
    v_config.tokens_included,
    COALESCE(v_usage.tokens_used, 0),
    GREATEST(0, v_config.tokens_included - COALESCE(v_usage.tokens_used, 0)),
    -- Can use AI if: BYOK mode, or has tokens remaining, or paid tier (allows overage)
    COALESCE(v_sub.billing_mode, 'managed') = 'byok' 
    OR COALESCE(v_usage.tokens_used, 0) < v_config.tokens_included
    OR COALESCE(v_sub.tier, 'free') != 'free';
END;
$$;
```

---

## DB Queries

### New File: `packages/db/src/queries/billing.ts`

```typescript
import { getSupabaseClient } from "../client";

export type BillingMode = "managed" | "byok";
export type SubscriptionTier = "free" | "pro" | "team" | "enterprise";

export interface BillingContext {
  tier: SubscriptionTier;
  billingMode: BillingMode;
  tokensIncluded: number;
  tokensUsed: number;
  tokensRemaining: number;
  canUseAI: boolean;
}

export interface UsageSummary {
  tokensUsed: number;
  tokensIncluded: number;
  tokensRemaining: number;
  wordsWritten: number;
  aiCalls: {
    chat: number;
    lint: number;
    coach: number;
    detect: number;
    search: number;
  };
  periodStart: string;
  periodEnd: string;
}

// Get billing context for quota checks
export async function getBillingContext(userId: string): Promise<BillingContext>;

// Get current period usage summary
export async function getCurrentUsage(userId: string): Promise<UsageSummary | null>;

// Record token usage after AI call
export async function recordTokenUsage(
  userId: string, 
  tokens: number, 
  callType: "chat" | "lint" | "coach" | "detect" | "search"
): Promise<void>;

// Record words written (call on document save)
export async function recordWordsWritten(userId: string, wordsDelta: number): Promise<void>;

// Get/update subscription
export async function getSubscription(userId: string): Promise<Subscription | null>;
export async function updateBillingMode(userId: string, mode: BillingMode): Promise<void>;
```

---

## Edge Functions

### Shared Billing Helper: `supabase/functions/_shared/billing.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

export interface BillingCheck {
  canProceed: boolean;
  billingMode: "managed" | "byok";
  apiKey: string;
  tokensRemaining: number;
  userId: string;
}

/**
 * Check billing and get API key for an AI request
 * Call this at the start of every AI edge function
 */
export async function checkBillingAndGetKey(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<BillingCheck> {
  // 1. Get user from auth header
  const authHeader = req.headers.get("Authorization");
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader?.replace("Bearer ", "")
  );
  
  if (!user) throw new Error("Unauthorized");
  
  // 2. Get billing context from DB
  const { data: billing } = await supabase
    .rpc("get_billing_context", { p_user_id: user.id });
  
  // 3. Determine API key source
  let apiKey: string;
  
  if (billing.billing_mode === "byok") {
    // BYOK: Get key from header (user provides it)
    apiKey = req.headers.get("x-openrouter-key") ?? "";
    if (!apiKey) throw new Error("BYOK mode requires API key in header");
  } else {
    // MANAGED: Use platform key, check quota
    if (!billing.can_use_ai && billing.tier === "free") {
      throw new Error("Token limit reached. Upgrade to continue.");
    }
    apiKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  }
  
  return {
    canProceed: true,
    billingMode: billing.billing_mode,
    apiKey,
    tokensRemaining: billing.tokens_remaining,
    userId: user.id,
  };
}

/**
 * Record usage after AI call completes
 * Only records for MANAGED mode (BYOK users pay their own API)
 */
export async function recordUsageIfManaged(
  supabase: ReturnType<typeof createClient>,
  billing: BillingCheck,
  tokensUsed: number,
  callType: string
): Promise<void> {
  if (billing.billingMode === "managed") {
    await supabase.rpc("record_token_usage", {
      p_user_id: billing.userId,
      p_tokens: tokensUsed,
      p_call_type: callType,
    });
  }
}
```

### Update Pattern for AI Functions

Each AI function (`ai-chat`, `ai-lint`, `ai-coach`, `ai-detect`, `ai-search`) needs:

```typescript
// At start of handler:
const billing = await checkBillingAndGetKey(req, supabase);
const model = createDynamicOpenRouter(billing.apiKey);

// After AI call:
const tokensUsed = result.usage?.totalTokens ?? 0;
await recordUsageIfManaged(supabase, billing, tokensUsed, "chat");
```

### New Stripe Functions

| Function | Path | Purpose |
|----------|------|---------|
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | Handle subscription events |
| `stripe-checkout` | `supabase/functions/stripe-checkout/index.ts` | Create checkout session |
| `stripe-portal` | `supabase/functions/stripe-portal/index.ts` | Open customer portal |

---

## Frontend Components

### Usage Dashboard: `apps/web/src/components/settings/UsageDashboard.tsx`

```typescript
/**
 * Usage Dashboard Component
 * Shows current usage vs limits
 */

interface UsageDashboardProps {
  usage: UsageSummary;
  subscription: Subscription;
}

export function UsageDashboard({ usage, subscription }: UsageDashboardProps) {
  return (
    <div className="space-y-6">
      {/* Token Usage Meter */}
      <UsageMeter 
        used={usage.tokensUsed}
        included={usage.tokensIncluded}
        label="AI Tokens"
      />
      
      {/* Words Written */}
      <StatCard 
        label="Words Written"
        value={usage.wordsWritten.toLocaleString()}
        subtext="This month"
      />
      
      {/* AI Calls Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Chat" value={usage.aiCalls.chat} />
        <StatCard label="Linter" value={usage.aiCalls.lint} />
        <StatCard label="Coach" value={usage.aiCalls.coach} />
        <StatCard label="Search" value={usage.aiCalls.search} />
      </div>
      
      {/* Billing Mode */}
      <BillingModeToggle 
        mode={subscription.billingMode}
        onModeChange={handleModeChange}
      />
      
      {/* Upgrade CTA (if limits approaching) */}
      {usage.tokensRemaining < usage.tokensIncluded * 0.2 && (
        <UpgradeBanner tier={subscription.tier} />
      )}
    </div>
  );
}
```

### Billing Settings: `apps/web/src/components/settings/BillingSettings.tsx`

```typescript
/**
 * Billing Settings Component
 * Subscription management + billing mode toggle
 */

export function BillingSettings() {
  const { subscription, usage, openCheckout, openPortal, setBillingMode } = useBilling();
  
  return (
    <div className="space-y-8">
      {/* Current Plan */}
      <CurrentPlanCard 
        tier={subscription.tier}
        billingMode={subscription.billingMode}
        periodEnd={subscription.currentPeriodEnd}
      />
      
      {/* Usage Dashboard */}
      <UsageDashboard usage={usage} subscription={subscription} />
      
      {/* Billing Mode Toggle */}
      <BillingModeSection
        mode={subscription.billingMode}
        onModeChange={setBillingMode}
      />
      
      {/* Tier Selection */}
      <TierGrid 
        currentTier={subscription.tier}
        billingMode={subscription.billingMode}
        onSelectTier={openCheckout}
      />
      
      {/* Manage Subscription */}
      <Button onClick={openPortal}>
        Manage Subscription
      </Button>
    </div>
  );
}
```

---

## State Management

### New Store: `packages/state/src/billing.ts`

```typescript
import { create } from "zustand";

export interface BillingState {
  // Subscription
  tier: SubscriptionTier;
  billingMode: BillingMode;
  status: "active" | "canceled" | "past_due";
  currentPeriodEnd: Date | null;
  
  // Usage
  tokensUsed: number;
  tokensIncluded: number;
  tokensRemaining: number;
  wordsWritten: number;
  
  // Loading
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  setBillingMode: (mode: BillingMode) => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  // Initial state
  tier: "free",
  billingMode: "managed",
  // ...
}));
```

---

## Hooks

### `apps/web/src/hooks/useBilling.ts`

```typescript
import { useEffect, useCallback } from "react";
import { useBillingStore } from "@mythos/state";
import { callEdgeFunction } from "../services/api-client";

export function useBilling() {
  const store = useBillingStore();
  
  // Fetch on mount
  useEffect(() => {
    store.refresh();
  }, []);
  
  // Upgrade via Stripe Checkout
  const openCheckout = useCallback(async (tier: SubscriptionTier) => {
    const { url } = await callEdgeFunction("stripe-checkout", { tier });
    window.location.href = url;
  }, []);
  
  // Manage via Stripe Portal
  const openPortal = useCallback(async () => {
    const { url } = await callEdgeFunction("stripe-portal", {});
    window.open(url, "_blank");
  }, []);
  
  return {
    ...store,
    openCheckout,
    openPortal,
  };
}
```

### Update `apps/web/src/hooks/useAutoSave.ts`

Add word count tracking:

```typescript
// After successful save:
const wordsDelta = newWordCount - previousWordCount;
if (wordsDelta !== 0) {
  await recordWordsWritten(userId, wordsDelta);
}
```

---

## Implementation Phases

### Phase 1: Database (Day 1)
- [ ] Create migration `009_billing.sql`
- [ ] Add `packages/db/src/queries/billing.ts`
- [ ] Update `packages/db/src/queries/index.ts` exports
- [ ] Run migration

### Phase 2: Billing State (Day 2)
- [ ] Create `packages/state/src/billing.ts`
- [ ] Update `packages/state/src/index.ts` exports
- [ ] Create `apps/web/src/stores/billing.ts` (web instance)

### Phase 3: Edge Function Updates (Days 3-4)
- [ ] Create `supabase/functions/_shared/billing.ts`
- [ ] Update all AI functions with billing checks
- [ ] Add usage recording after AI calls
- [ ] Test quota enforcement

### Phase 4: Stripe Integration (Days 5-6)
- [ ] Install Stripe SDK
- [ ] Create `stripe-webhook/index.ts`
- [ ] Create `stripe-checkout/index.ts`
- [ ] Create `stripe-portal/index.ts`
- [ ] Configure Stripe products/prices
- [ ] Test webhook events

### Phase 5: Frontend UI (Days 7-8)
- [ ] Create `UsageDashboard.tsx`
- [ ] Create `BillingSettings.tsx`
- [ ] Create `UsageMeter.tsx`
- [ ] Create `useBilling.ts` hook
- [ ] Update `useAutoSave.ts` for word tracking
- [ ] Add billing modal to settings

### Phase 6: Testing (Day 9)
- [ ] Test MANAGED mode quota limits
- [ ] Test BYOK mode key validation
- [ ] Test mode switching
- [ ] Test Stripe checkout flow
- [ ] Test metered billing accuracy

---

## File Summary

### New Files (15)

| File | Purpose |
|------|---------|
| `packages/db/src/migrations/009_billing.sql` | Database schema |
| `packages/db/src/queries/billing.ts` | DB query functions |
| `packages/state/src/billing.ts` | Billing state store |
| `apps/web/src/stores/billing.ts` | Web billing store instance |
| `apps/web/src/hooks/useBilling.ts` | Billing hook |
| `apps/web/src/components/settings/UsageDashboard.tsx` | Usage display |
| `apps/web/src/components/settings/BillingSettings.tsx` | Billing management |
| `apps/web/src/components/settings/UsageMeter.tsx` | Progress bar component |
| `apps/web/src/components/settings/TierCard.tsx` | Pricing tier card |
| `supabase/functions/_shared/billing.ts` | Billing helpers |
| `supabase/functions/stripe-webhook/index.ts` | Webhook handler |
| `supabase/functions/stripe-checkout/index.ts` | Checkout session |
| `supabase/functions/stripe-portal/index.ts` | Customer portal |
| `supabase/functions/billing-subscription/index.ts` | Get subscription |
| `supabase/functions/billing-mode/index.ts` | Switch mode |

### Modified Files (10)

| File | Changes |
|------|---------|
| `packages/db/src/queries/index.ts` | Export billing |
| `packages/state/src/index.ts` | Export billing |
| `supabase/functions/_shared/api-key.ts` | Billing-aware extraction |
| `supabase/functions/ai-chat/index.ts` | Add billing checks |
| `supabase/functions/ai-lint/index.ts` | Add billing checks |
| `supabase/functions/ai-coach/index.ts` | Add billing checks |
| `supabase/functions/ai-detect/index.ts` | Add billing checks |
| `supabase/functions/ai-search/index.ts` | Add billing checks |
| `apps/web/src/hooks/useAutoSave.ts` | Word count tracking |
| `apps/web/src/stores/index.ts` | Add billing modal |

---

## Environment Variables

The following environment variables must be configured for the billing system:

### Stripe Configuration
| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Yes |
| `STRIPE_PRICE_PRO_MONTHLY` | Price ID for Pro tier monthly | Yes |
| `STRIPE_PRICE_PRO_ANNUAL` | Price ID for Pro tier annual | Yes |
| `STRIPE_PRICE_PRO_PLUS_MONTHLY` | Price ID for Pro+ tier monthly | Yes |
| `STRIPE_PRICE_PRO_PLUS_ANNUAL` | Price ID for Pro+ tier annual | Yes |
| `STRIPE_PRICE_TEAM_MONTHLY` | Price ID for Team tier monthly | Yes |
| `STRIPE_PRICE_TEAM_ANNUAL` | Price ID for Team tier annual | Yes |

### AI/API Configuration
| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key for managed billing mode | Yes (for managed mode) |

### Supabase Configuration
| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes (for webhooks) |

---

## Key Design Decisions

1. **BYOK stays** - Power users get 50% discount, lower friction for technical users
2. **Managed is default** - Non-technical users don't need to understand API keys
3. **Monthly token limits** - Simple to understand, resets each billing cycle
4. **Overage allowed for paid tiers** - Only free tier has hard limit
5. **Words tracked separately** - Different metric from AI tokens, useful for analytics
6. **No AI call for BYOK usage** - Users pay their own API costs directly
