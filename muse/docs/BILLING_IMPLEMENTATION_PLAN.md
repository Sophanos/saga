# Billing & Usage System

> Hybrid Billing: Managed quota + BYOK via RevenueCat (mobile) + Stripe (web)

## Pricing Tiers

Source of truth: `convex/lib/tierConfig.ts`

| Tier | Monthly | Yearly | Managed Tokens/mo | Projects | Async AI |
|------|---------|--------|-------------------|----------|----------|
| **Free** | $0 | $0 | 10,000 | 3 | ❌ |
| **Pro** | $14.99 | $119.99 | 500,000 | 20 | ✅ |
| **Team** | $49.99 | $299.99 | 2,000,000 | Unlimited | ✅ |

---

## Billing Modes

| Mode | Description | API Key Source | Quota |
|------|-------------|----------------|-------|
| **MANAGED** | Platform provides AI | Platform key | Tier limit |
| **BYOK** | User provides key | `x-openrouter-key` header | Unlimited (interactive) |

### BYOK Strategy

**Available to all tiers** (Free, Pro, Team) for growth:
- Costs platform $0 (user pays OpenRouter)
- Attracts power users/developers
- "Half-open source" goodwill
- Can tighten later if needed

**Interactive vs Async split:**

| Feature Type | BYOK | Managed |
|--------------|------|---------|
| Chat/agents (sync) | ✅ Unlimited | Quota |
| Linting (user-triggered) | ✅ Unlimited | Quota |
| Image generation | ✅ Unlimited | Quota |
| Pulse (scheduled) | ❌ | ✅ Pro+ |
| Async widgets | ❌ | ✅ Pro+ |
| Background jobs | ❌ | ✅ Pro+ |

**Rationale:** Async features need server-side key → natural paywall for Pro+.

---

## Architecture

```
Client Request
      │
      ├── x-openrouter-key header? ──► BYOK path (skip quota)
      │                                    │
      │                                    ▼
      │                              Use client key
      │                              No usage tracking
      │
      └── No header ──► MANAGED path
                              │
                              ▼
                        Check quota
                              │
                              ├── Quota OK ──► Use platform key
                              │                Track usage
                              │
                              └── Quota exceeded ──► 429 + paywall
```

---

## Implementation Status

### Complete ✅

| Component | Location |
|-----------|----------|
| Tier config | `convex/lib/tierConfig.ts` |
| Entitlements | `convex/lib/entitlements.ts` |
| Billing core | `convex/lib/billingCore.ts` |
| Quota enforcement | `convex/lib/quotaEnforcement.ts` |
| Rate limiting | `convex/lib/rateLimiting.ts` |
| Usage tracking | `convex/aiUsage.ts` |
| Billing snapshot | `convex/billing.ts` |
| Stripe checkout | `convex/http.ts` → `/stripe-checkout` |
| Stripe portal | `convex/http.ts` → `/stripe-portal` |
| Stripe webhooks | `convex/stripe.ts` |
| RevenueCat webhooks | `convex/subscriptions.ts` |
| Webhook security | `convex/lib/webhookSecurity.ts` |
| Customer mapping | `convex/billingCustomers.ts` |
| Billing settings | `convex/billingSettings.ts` |

### In Progress 🔄

| Component | Status |
|-----------|--------|
| BYOK header passthrough | Needs implementation |
| Per-request OpenRouter key | Needs implementation |
| BYOK quota bypass | Needs implementation |

### Pending 📋

| Component | Priority |
|-----------|----------|
| Usage Dashboard UI | P1 |
| Billing mode toggle UI | P1 |
| Paywall modal (Expo) | P1 |
| Pulse async billing | P2 |

---

## BYOK Implementation

### HTTP Layer

Pass `x-openrouter-key` header through to internal actions:

```typescript
// convex/http.ts - AI endpoints
const byokKey = request.headers.get("x-openrouter-key");

await ctx.runAction(internal.ai.agentRuntime.run, {
  // ... other args
  byokKey: byokKey ?? undefined,
});
```

### Agent Runtime

Use BYOK key when present, skip quota:

```typescript
// convex/ai/agentRuntime.ts
async function getApiKeyAndMode(ctx, userId, byokKey) {
  if (byokKey) {
    // BYOK: use client key, skip quota
    return {
      apiKey: byokKey,
      billingMode: "byok",
      trackUsage: false
    };
  }

  // MANAGED: check quota, use platform key
  await assertQuota(ctx, userId);
  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    billingMode: "managed",
    trackUsage: true
  };
}
```

### All AI Endpoints

Apply BYOK to:
- `/ai/saga` - Agent runtime
- `/ai/chat` - Simple chat
- `/ai/widgets` - Widget execution
- `/ai/detect` - Entity detection
- `/ai/lint` - Consistency linting
- `/ai/dynamics` - Interaction extraction
- `/ai/coach` - Writing coach
- `/ai/style` - Style analysis
- `/ai/image` - Image generation

---

## Database Schema

```typescript
// convex/schema.ts

subscriptions: defineTable({
  userId: v.string(),
  status: v.string(), // active, canceled, past_due, trialing
  store: v.string(), // REVENUECAT, STRIPE
  productId: v.string(),
  entitlements: v.array(v.string()),
  purchasedAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
  willRenew: v.optional(v.boolean()),
  // ...
})

billingSettings: defineTable({
  userId: v.string(),
  billingMode: v.union(v.literal("managed"), v.literal("byok")),
  // ...
})

billingCustomers: defineTable({
  userId: v.string(),
  stripeCustomerId: v.optional(v.string()),
  revenuecatId: v.optional(v.string()),
  // ...
})

aiUsage: defineTable({
  userId: v.string(),
  projectId: v.optional(v.string()),
  endpoint: v.string(),
  model: v.string(),
  promptTokens: v.number(),
  completionTokens: v.number(),
  totalTokens: v.number(),
  billingMode: v.string(),
  // ...
})
```

---

## Environment Variables

### Stripe (Web)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_1SpXRYPNSLaIbAGJ0mYQPsgs
STRIPE_PRICE_PRO_ANNUAL=price_1SpXRoPNSLaIbAGJ8UHsrmFq
STRIPE_PRICE_TEAM_MONTHLY=price_1SpXRvPNSLaIbAGJP2Q5yed0
STRIPE_PRICE_TEAM_ANNUAL=price_1SpXRvPNSLaIbAGJ83LnGst0
STRIPE_CHECKOUT_SUCCESS_URL=https://rhei.team/settings?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=https://rhei.team/settings?checkout=cancel
STRIPE_PORTAL_RETURN_URL=https://rhei.team/settings
```

### RevenueCat (Mobile)
```env
REVENUECAT_PUBLIC_KEY=appl_xxxxxxxx
REVENUECAT_WEBHOOK_SECRET=xxxxx
REVENUECAT_WEBHOOK_AUTH_KEY=xxxxx
```

### AI
```env
OPENROUTER_API_KEY=sk-or-... (platform key for managed)
```

---

## Key Decisions

1. **BYOK open to all tiers** - Growth strategy, $0 cost, can restrict later
2. **Interactive vs Async split** - BYOK = sync only, async = managed (Pro+)
3. **Stripe for web** - Direct billing, no app store cut
4. **RevenueCat for mobile** - Cross-platform subscription management
5. **Per-request BYOK** - No server-side key storage (security/compliance)
6. **Usage tracking for managed only** - BYOK users pay their own API costs
7. **Team = collaboration features** - Not just more tokens (BYOK makes that worthless)

---

## Testing

### Stripe Flow
1. `POST /stripe-checkout` with `{ tier: "pro", billingInterval: "monthly" }`
2. Complete checkout with test card `4242 4242 4242 4242`
3. Verify webhook at `/webhooks/stripe`
4. Check `/billing-subscription` returns updated entitlements

### BYOK Flow
1. Set `x-openrouter-key` header on AI request
2. Verify request succeeds without quota check
3. Verify no usage tracked in `aiUsage` table

### Quota Enforcement
1. Use managed mode (no BYOK header)
2. Exhaust free tier quota
3. Verify 429 response with paywall message
4. Upgrade to Pro, verify quota reset
