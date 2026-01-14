# Billing & Usage System

> Usage Dashboard + Hybrid Billing (MANAGED/BYOK) via RevenueCat + Convex

## Pricing Tiers

Source of truth: `convex/lib/tierConfig.ts`

| Tier | Monthly | Yearly | AI Tokens/mo | Features |
|------|---------|--------|--------------|----------|
| **Free** | $0 | $0 | 10,000 | 3 projects, basic AI |
| **Pro** | $14.99 | $119.99 | 500,000 | 20 projects, all AI, image gen |
| **Team** | $49.99 | $299.99 | 2,000,000 | 100 projects, collaboration |
| **Enterprise** | Custom | Custom | Unlimited | API access, custom limits |

---

## Architecture

```
RevenueCat (App Store/Play Store)
    ↓ webhook
Convex HTTP endpoint (/api/webhooks/revenuecat)
    ↓ update
subscriptions table + tierConfig
    ↓ query
useBilling hook → UI
```

---

## Billing Modes

| Mode | Description | API Key Source | Pricing |
|------|-------------|----------------|---------|
| **MANAGED** | Platform provides AI tokens | Platform key | Full price |
| **BYOK** | User provides own API key | `x-openrouter-key` header | 50% discount |

- BYOK stays for power users (lower friction, lower platform cost)
- MANAGED is default for non-technical users
- Mode switching allowed at any time

---

## Current State

| Component | Status | Location |
|-----------|--------|----------|
| BYOK key storage | Exists | `@mythos/ai/hooks/useApiKey.ts` |
| BYOK header passing | Exists | Agent runtime client |
| Pricing tiers config | Exists | `convex/lib/tierConfig.ts` |
| Billing snapshot endpoint | Exists | `convex/billing.ts`, `convex/http.ts` |

### Missing

| Component | Priority |
|-----------|----------|
| `subscriptions` table | P0 |
| `tokenUsage` table | P0 |
| RevenueCat webhook handler | P0 |
| Billing state store | P1 |
| Usage Dashboard UI | P1 |
| Quota enforcement in agent | P1 |

---

## Schema (Convex)

```typescript
// convex/schema.ts

subscriptions: defineTable({
  userId: v.id("users"),
  tier: v.union(v.literal("free"), v.literal("pro"), v.literal("team"), v.literal("enterprise")),
  billingMode: v.union(v.literal("managed"), v.literal("byok")),
  status: v.string(), // active, canceled, past_due
  revenueCatId: v.optional(v.string()),
  currentPeriodStart: v.optional(v.number()),
  currentPeriodEnd: v.optional(v.number()),
})
.index("by_user", ["userId"])
.index("by_revenuecat", ["revenueCatId"])

tokenUsage: defineTable({
  userId: v.id("users"),
  periodStart: v.number(),
  periodEnd: v.number(),
  tokensIncluded: v.number(),
  tokensUsed: v.number(),
  wordsWritten: v.number(),
  aiCalls: v.object({
    chat: v.number(),
    lint: v.number(),
    coach: v.number(),
    detect: v.number(),
    search: v.number(),
  }),
})
.index("by_user_period", ["userId", "periodStart"])
```

---

## Queries & Mutations

```typescript
// convex/billing.ts

// Get billing context for quota checks
export const getBillingContext = query({
  args: { userId: v.id("users") },
  returns: v.object({
    tier: v.string(),
    billingMode: v.string(),
    tokensIncluded: v.number(),
    tokensUsed: v.number(),
    tokensRemaining: v.number(),
    canUseAI: v.boolean(),
  }),
});

// Record token usage after AI call
export const recordTokenUsage = mutation({
  args: {
    userId: v.id("users"),
    tokens: v.number(),
    callType: v.string(),
  },
});

// Record words written (on document save)
export const recordWordsWritten = mutation({
  args: {
    userId: v.id("users"),
    wordsDelta: v.number(),
  },
});

// Switch billing mode
export const setBillingMode = mutation({
  args: {
    userId: v.id("users"),
    mode: v.union(v.literal("managed"), v.literal("byok")),
  },
});
```

---

## RevenueCat Webhook

```typescript
// convex/http.ts

http.route({
  path: "/api/webhooks/revenuecat",
  method: "POST",
  handler: async (ctx, req) => {
    // Verify auth header
    const auth = req.headers.get("Authorization");
    if (auth !== `Bearer ${process.env.REVENUECAT_WEBHOOK_AUTH_KEY}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();

    switch (body.event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
        await ctx.runMutation(internal.subscriptions.activate, {
          userId: body.event.app_user_id,
          productId: body.event.product_id,
          expiresAt: body.event.expiration_at_ms,
        });
        break;

      case "CANCELLATION":
      case "EXPIRATION":
        await ctx.runMutation(internal.subscriptions.deactivate, {
          userId: body.event.app_user_id,
        });
        break;
    }

    return new Response("OK", { status: 200 });
  },
});
```

---

## Quota Enforcement

In AI agent runtime, check billing before executing:

```typescript
// convex/ai/agentRuntime.ts

async function checkBillingAndGetKey(ctx, userId) {
  const billing = await ctx.runQuery(api.billing.getBillingContext, { userId });

  if (billing.billingMode === "byok") {
    // BYOK: expect key from request context
    const apiKey = ctx.headers?.get("x-openrouter-key");
    if (!apiKey) throw new Error("BYOK mode requires API key");
    return { apiKey, record: false };
  }

  // MANAGED: check quota
  if (!billing.canUseAI && billing.tier === "free") {
    throw new Error("Token limit reached. Upgrade to continue.");
  }

  return { apiKey: process.env.OPENROUTER_API_KEY, record: true };
}

// After AI call completes:
if (record) {
  await ctx.runMutation(api.billing.recordTokenUsage, {
    userId,
    tokens: result.usage?.totalTokens ?? 0,
    callType: "chat",
  });
}
```

---

## Frontend Components

### UsageDashboard

```typescript
// apps/web/src/components/settings/UsageDashboard.tsx

export function UsageDashboard({ usage, subscription }) {
  return (
    <div>
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

      {/* Upgrade CTA */}
      {usage.tokensRemaining < usage.tokensIncluded * 0.2 && (
        <UpgradeBanner tier={subscription.tier} />
      )}
    </div>
  );
}
```

### useBilling Hook

```typescript
// packages/ai/src/hooks/useBilling.ts

export function useBilling() {
  const subscription = useQuery(api.billing.getSubscription);
  const usage = useQuery(api.billing.getCurrentUsage);

  const setBillingMode = useMutation(api.billing.setBillingMode);

  return {
    subscription,
    usage,
    setBillingMode,
    isLoading: subscription === undefined,
  };
}
```

---

## Implementation Phases

### Phase 1: Database
- [ ] Add `subscriptions` table to Convex schema
- [ ] Add `tokenUsage` table
- [ ] Create `getBillingContext` query
- [ ] Create `recordTokenUsage` mutation

### Phase 2: RevenueCat Integration
- [ ] Add webhook endpoint to `convex/http.ts`
- [ ] Handle subscription events
- [ ] Sync entitlements to tier
- [ ] Test with sandbox

### Phase 3: Quota Enforcement
- [ ] Add billing check to agent runtime
- [ ] Record usage after AI calls (MANAGED only)
- [ ] Enforce hard limit for free tier
- [ ] Allow overage for paid tiers

### Phase 4: Frontend
- [ ] Create `useBilling` hook
- [ ] Create `UsageDashboard` component
- [ ] Create `BillingSettings` component
- [ ] Add usage meter to settings
- [ ] Update word count tracking in autosave

---

## Environment Variables

```env
REVENUECAT_PUBLIC_KEY=appl_xxxxxxxx
REVENUECAT_WEBHOOK_AUTH_KEY=xxxxx
```

## App Store Product IDs

See [PRICING_REVENUECAT_SETUP.md](./PRICING_REVENUECAT_SETUP.md) for full details.

- `rhei_pro_v2_monthly` / `rhei_pro_v2_yearly`
- `rhei_team_v2_monthly` / `rhei_team_v2_yearly`

---

## Key Decisions

1. **RevenueCat for App Store** - Cross-platform subscription management
2. **BYOK stays** - Power users get 50% discount, lower platform cost
3. **MANAGED is default** - Non-technical users don't need API keys
4. **Monthly token limits** - Simple to understand, resets each billing cycle
5. **Overage for paid only** - Free tier has hard limit
6. **Words tracked separately** - Different metric from tokens, useful for analytics
7. **No usage recording for BYOK** - Users pay their own API costs
