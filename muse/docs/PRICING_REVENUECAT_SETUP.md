# Pricing & RevenueCat Setup

> App Store pricing + RevenueCat for Rhei

## Pricing (Source of Truth: `convex/lib/tierConfig.ts`)

| Tier | Monthly | Yearly | AI Tokens/mo |
|------|---------|--------|--------------|
| **Free** | $0 | $0 | 10,000 |
| **Pro** | $14.99 | $119.99 | 500,000 |
| **Team** | $49.99 | $299.99 | 2,000,000 |

## App Store Connect

### Product IDs (v2)

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

| Product | Display Name (EN) | Display Name (DE) | Description (EN) | Description (DE) |
|---------|-------------------|-------------------|------------------|------------------|
| `rhei_pro_v2_monthly` | Pro Plan | Pro-Abo | 500K AI tokens, 20 projects | 500K KI-Tokens, 20 Projekte |
| `rhei_pro_v2_yearly` | Pro Plan (Annual) | Pro-Abo (Jährlich) | Save 33% - 500K tokens/month | 33% sparen - 500K Tokens/Monat |
| `rhei_team_v2_monthly` | Team Plan | Team-Abo | 2M AI tokens, collaboration | 2M KI-Tokens, Zusammenarbeit |
| `rhei_team_v2_yearly` | Team Plan (Annual) | Team-Abo (Jährlich) | Save 50% - 2M tokens/month | 50% sparen - 2M Tokens/Monat |

### Subscription Group Localization

| Field | EN (USA) | DE (Germany) |
|-------|----------|--------------|
| **Display Name** | Rhei Pro | Rhei Pro |

### Submission Checklist

- [x] Products created (4)
- [x] Free trials added
- [x] Prices set (USD/EUR)
- [x] Localizations added (EN/DE)
- [ ] Paywall screenshot uploaded
- [ ] Review information filled
- [ ] Submit for review

## RevenueCat Setup

### 1. Create Project
- Project name: "Rhei"
- Add App Store app with bundle ID: `team.rhei.app`

### 2. Entitlements
| ID | Description |
|----|-------------|
| `pro` | Pro tier access |
| `team` | Team tier access |

### 3. Products → Entitlements
| Product | Entitlement |
|---------|-------------|
| `rhei_pro_monthly` | pro |
| `rhei_pro_yearly` | pro |
| `rhei_team_monthly` | team |
| `rhei_team_yearly` | team |

### 4. Webhook
URL: `https://convex.rhei.team/api/webhooks/revenuecat`

## Environment Variables

```env
REVENUECAT_PUBLIC_KEY=appl_xxxxxxxx
REVENUECAT_WEBHOOK_AUTH_KEY=xxxxx
```

## Convex Webhook Handler

```typescript
// convex/http.ts
http.route({
  path: "/api/webhooks/revenuecat",
  method: "POST",
  handler: async (ctx, req) => {
    const body = await req.json();
    switch (body.event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
        await ctx.runMutation(internal.subscriptions.activate, {...});
        break;
      case "CANCELLATION":
      case "EXPIRATION":
        await ctx.runMutation(internal.subscriptions.deactivate, {...});
        break;
    }
    return new Response("OK");
  },
});
```

## Entitlement → Tier Mapping

```typescript
// convex/lib/entitlements.ts
export function entitlementToTier(entitlements: string[]): TierId {
  if (entitlements.includes("team")) return "team";
  if (entitlements.includes("pro")) return "pro";
  return "free";
}
```

## Testing

1. Create Sandbox Tester in App Store Connect
2. Enable RevenueCat debug logging in dev
3. Test: purchase → restore → expiration → tier sync
