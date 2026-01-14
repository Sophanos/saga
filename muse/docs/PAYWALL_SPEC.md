# Paywall Spec

> Design spec for Rhei subscription paywall (iOS/macOS/Web)

## Design Inspiration

| App | Take | Skip |
|-----|------|------|
| **Ulysses** | Simple 3-screen onboarding, clean paywall, trial-first | - |
| **Craft** | Visual illustrations, plan comparison, expandable benefits | Calendar, Tasks |

## Pricing

Source: `convex/lib/tierConfig.ts`, [PRICING_REVENUECAT_SETUP.md](./PRICING_REVENUECAT_SETUP.md)

| Plan | Monthly | Yearly | Trial |
|------|---------|--------|-------|
| **Pro** | $14.99 | $119.99 (~$10/mo) | 7 days |
| **Team** | $49.99 | $299.99 (~$25/mo) | 14 days |

---

## Paywall Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│        [Illustration: flowing ink/writing]          │
│                                                     │
│           Write with intelligence.                  │
│           Only when you ask.                        │
│                                                     │
│         ┌──────────┐  ┌──────────┐                 │
│         │  Yearly  │  │ Monthly  │                 │
│         │ (save %) │  │          │                 │
│         └──────────┘  └──────────┘                 │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  Pro Plan                              ★      │ │
│  │                                               │ │
│  │  ✓ 500,000 AI tokens/month                   │ │
│  │  ✓ 20 projects                               │ │
│  │  ✓ Automatic entity tracking                 │ │
│  │  ✓ Image generation                          │ │
│  │  ✓ All AI features                           │ │
│  │                                               │ │
│  │  ~~$14.99/mo~~  $9.99/mo                     │ │
│  │  7 days free, then $119.99/year              │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│           [ Start Free Trial ]                      │
│                                                     │
│           ↓ Show all benefits                       │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  Restore purchases · Privacy · Terms                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Copy

### Headlines

| Language | Primary | Secondary |
|----------|---------|-----------|
| **EN** | Write with intelligence. | Only when you ask. |
| **DE** | Schreibe mit Intelligenz. | Nur wenn du fragst. |

### Feature Bullets (Pro)

| EN | DE |
|----|----|
| 500,000 AI tokens/month | 500.000 KI-Tokens/Monat |
| 20 projects | 20 Projekte |
| Automatic entity tracking | Automatische Entitäts-Erkennung |
| Image generation | Bildgenerierung |
| All AI features | Alle KI-Funktionen |

### Feature Bullets (Team)

| EN | DE |
|----|----|
| 2,000,000 AI tokens/month | 2.000.000 KI-Tokens/Monat |
| 100 projects | 100 Projekte |
| Real-time collaboration | Echtzeit-Zusammenarbeit |
| 10 team members | 10 Teammitglieder |
| Priority support | Prioritäts-Support |

### CTAs

| EN | DE |
|----|----|
| Start Free Trial | Kostenlos testen |
| Continue with Pro | Weiter mit Pro |
| Show all benefits | Alle Vorteile anzeigen |
| Restore purchases | Käufe wiederherstellen |

---

## States

### 1. First Launch (No Account)

- Show paywall after onboarding
- Highlight free trial
- "Start Free Trial" CTA

### 2. Free User (Logged In)

- Show when approaching token limit
- Show upgrade prompt in settings
- "Upgrade to Pro" CTA

### 3. Trial Active

- Show days remaining badge
- "You have X days left in your trial"

### 4. Subscribed

- Don't show paywall
- Show plan details in Settings

---

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `PaywallModal` | `apps/expo/src/components/paywall/` | Full paywall UI |
| `PlanCard` | `apps/expo/src/components/paywall/` | Single plan display |
| `TrialBadge` | `apps/expo/src/components/paywall/` | Trial countdown |
| `UpgradeBanner` | `apps/expo/src/components/settings/` | Inline upgrade prompt |

---

## Implementation

### RevenueCat Integration

```typescript
// Show paywall
const offerings = await Purchases.getOfferings();
const packages = offerings.current?.availablePackages;

// Purchase
await Purchases.purchasePackage(selectedPackage);

// Check trial
const info = await Purchases.getCustomerInfo();
const isInTrial = info.entitlements.active["pro"]?.periodType === "TRIAL";
```

### Trigger Points

| Trigger | Action |
|---------|--------|
| First launch (after onboarding) | Show paywall |
| Token limit reached (free) | Show upgrade modal |
| Settings → Subscription | Show paywall |
| Cmd+K → "Upgrade" | Show paywall |

---

## Screenshot Requirements (App Store)

For submission, need screenshot showing:
- Paywall with prices visible
- Feature list
- Trial messaging

**Size:** iPhone screenshot (1290×2796 or similar)

---

## Checklist

- [ ] Design paywall illustration
- [ ] Build `PaywallModal` component
- [ ] Build `PlanCard` component
- [ ] Integrate RevenueCat SDK
- [ ] Add EN/DE localizations
- [ ] Test purchase flow (sandbox)
- [ ] Take App Store screenshot
- [ ] Submit for review

---

## Related

- [PRICING_REVENUECAT_SETUP.md](./PRICING_REVENUECAT_SETUP.md) - Product IDs, App Store setup
- [BILLING_IMPLEMENTATION_PLAN.md](./BILLING_IMPLEMENTATION_PLAN.md) - Backend billing system
