# Pricing & Billing Setup

> Multi-platform billing: RevenueCat (iOS/Android) + Stripe (Web)

## Pricing (Source of Truth: `convex/lib/tierConfig.ts`)

| Tier | Monthly | Yearly | Managed Tokens/mo | Projects |
|------|---------|--------|-------------------|----------|
| **Free** | $0 | $0 | 10,000 | 3 |
| **Pro** | $14.99 | $119.99 | 500,000 | 20 |
| **Team** | $49.99 | $299.99 | 2,000,000 | Unlimited |

## BYOK (Bring Your Own Key)

BYOK allows users to use their own OpenRouter API key for **unlimited interactive AI**.

| Aspect | Details |
|--------|---------|
| **Available to** | All tiers (Free, Pro, Team) |
| **Scope** | Interactive/sync AI only |
| **Async features** | Require managed quota (Pro+) |
| **Cost to platform** | $0 (user pays OpenRouter directly) |

### What BYOK Covers (Interactive)
- Chat/agent conversations
- Entity detection
- Linting/consistency checks (user-triggered)
- Style analysis
- Image generation
- Coach feedback
- Widget execution (user-triggered)

### What BYOK Does NOT Cover (Async)
- Pulse (scheduled background analysis)
- Scheduled widgets
- Server-triggered consistency checks
- Webhook-triggered AI processing

**Rationale:** Async features require server-side API key. BYOK users must use managed quota for these, creating natural paywall for Pro+.

---

## Stripe (Web)

### Products & Prices (Test Mode)

| Product | Price ID | Amount | Interval |
|---------|----------|--------|----------|
| Rhei Pro | `price_1SpXRYPNSLaIbAGJ0mYQPsgs` | $14.99 | monthly |
| Rhei Pro | `price_1SpXRoPNSLaIbAGJ8UHsrmFq` | $119.99 | yearly |
| Rhei Team | `price_1SpXRvPNSLaIbAGJP2Q5yed0` | $49.99 | monthly |
| Rhei Team | `price_1SpXRvPNSLaIbAGJ83LnGst0` | $299.99 | yearly |

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stripe-checkout` | POST | Create checkout session |
| `/stripe-portal` | POST | Open billing portal |
| `/webhooks/stripe` | POST | Webhook receiver |

### Webhook Events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_TEAM_MONTHLY=price_...
STRIPE_PRICE_TEAM_ANNUAL=price_...
STRIPE_CHECKOUT_SUCCESS_URL=https://rhei.team/settings?checkout=success
STRIPE_CHECKOUT_CANCEL_URL=https://rhei.team/settings?checkout=cancel
STRIPE_PORTAL_RETURN_URL=https://rhei.team/settings
```

---

## RevenueCat (iOS/Android)

### App Store Connect - Product IDs

| Product ID | Tier | Duration | Price | Free Trial |
|------------|------|----------|-------|------------|
| `rhei_pro_v2_monthly` | Pro | 1 month | $14.99 | 7 days |
| `rhei_pro_v2_yearly` | Pro | 1 year | $119.99 | 7 days |
| `rhei_team_v2_monthly` | Team | 1 month | $49.99 | 14 days |
| `rhei_team_v2_yearly` | Team | 1 year | $299.99 | 14 days |

### Subscription Level Order (highest → lowest)

1. `rhei_team_v2_yearly`
2. `rhei_team_v2_monthly`
3. `rhei_pro_v2_yearly`
4. `rhei_pro_v2_monthly`

### Localizations

| Product | Display Name (EN) | Display Name (DE) |
|---------|-------------------|-------------------|
| `rhei_pro_v2_monthly` | Pro Plan | Pro-Abo |
| `rhei_pro_v2_yearly` | Pro Plan (Annual) | Pro-Abo (Jährlich) |
| `rhei_team_v2_monthly` | Team Plan | Team-Abo |
| `rhei_team_v2_yearly` | Team Plan (Annual) | Team-Abo (Jährlich) |

### RevenueCat Setup

1. **Project**: "Rhei" with bundle ID `team.rhei.app`
2. **Entitlements**: `pro`, `team`
3. **Webhook**: `https://convex.rhei.team/webhooks/revenuecat`

### Environment Variables

```env
REVENUECAT_PUBLIC_KEY=appl_xxxxxxxx
REVENUECAT_WEBHOOK_SECRET=xxxxx
REVENUECAT_WEBHOOK_AUTH_KEY=xxxxx
```

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   iOS/Android   │     │       Web       │
│   RevenueCat    │     │     Stripe      │
└────────┬────────┘     └────────┬────────┘
         │ webhook               │ webhook
         ▼                       ▼
┌─────────────────────────────────────────┐
│        Convex HTTP Endpoints            │
│  /webhooks/revenuecat  /webhooks/stripe │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│         Canonical Subscription          │
│    subscriptions table + billingCore    │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│          Quota Enforcement              │
│   quotaEnforcement.ts + rateLimiting    │
└─────────────────────────────────────────┘
```

---

## Entitlement → Tier Mapping

```typescript
// convex/lib/entitlements.ts
export function entitlementToTier(entitlements: string[]): TierId {
  if (entitlements.includes("team")) return "team";
  if (entitlements.includes("pro")) return "pro";
  return "free";
}
```

---

## Testing

### Stripe
1. Use test mode keys (`sk_test_...`)
2. Test card: `4242 4242 4242 4242`
3. Verify webhook in Stripe dashboard

### RevenueCat
1. Create Sandbox Tester in App Store Connect
2. Enable RevenueCat debug logging
3. Test: purchase → restore → expiration → tier sync

---

## Submission Checklist

- [x] Stripe products created
- [x] Stripe webhook configured
- [x] Stripe env vars set
- [x] RevenueCat products created
- [x] RevenueCat entitlements configured
- [ ] RevenueCat webhook configured
- [ ] Paywall UI complete
- [ ] App Store review info filled
- [ ] Submit for review
