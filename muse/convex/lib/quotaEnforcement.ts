/**
 * Server-side quota enforcement for AI endpoints.
 */

import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { checkAiRateLimits, estimateTokenCount } from "./rateLimiting";
import { canAccessFeature, getUserTier } from "./entitlements";
import { dbToTierConfig, getTierDefaults, type TierId } from "./tierConfig";

const internal = require("../_generated/api").internal as any;

export type AiEndpoint =
  | "chat"
  | "coach"
  | "image_generate"
  | "detect"
  | "search"
  | "lint"
  | "dynamics"
  | "genesis"
  | "style";

export async function assertAiAllowed(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  args: {
    userId: string;
    endpoint: AiEndpoint;
    promptText: string;
    contextTokens?: number;
    requestedMaxOutputTokens?: number;
    billingModeUsed?: "managed" | "byok";
  }
): Promise<{ maxOutputTokens: number }> {
  const tier = await resolveUserTier(ctx, args.userId);
  const tierConfig = await getTierConfig(ctx, tier);

  const featureKey = mapEndpointToFeature(args.endpoint);
  const allowed = await resolveFeatureAccess(ctx, args.userId, featureKey);
  if (!allowed) {
    throw new Error("Feature not available on current tier");
  }

  await checkAiRateLimits(ctx, args.userId, args.promptText, {
    contextTokens: args.contextTokens ?? 0,
  });

  const billingModeUsed = args.billingModeUsed ?? "managed";
  if (billingModeUsed === "byok") {
    return { maxOutputTokens: args.requestedMaxOutputTokens ?? 4096 };
  }

  const periodStartMs = getBillingPeriodStartMs(Date.now());
  const usage = await getUsageCounters(ctx, args.userId, periodStartMs);
  const tokensIncluded = tierConfig.ai.tokensPerMonth ?? 0;

  if (tokensIncluded > 0 && usage.tokensUsedManaged >= tokensIncluded) {
    throw new Error("Token limit reached. Upgrade to continue.");
  }

  const estimatedPromptTokens =
    estimateTokenCount(args.promptText) + (args.contextTokens ?? 0);
  const remaining = Math.max(tokensIncluded - usage.tokensUsedManaged, 0);
  const maxOutputTokens = tokensIncluded === 0
    ? args.requestedMaxOutputTokens ?? 4096
    : Math.max(0, remaining - estimatedPromptTokens);

  if (tokensIncluded > 0 && maxOutputTokens <= 0) {
    throw new Error("Token limit reached. Upgrade to continue.");
  }

  return { maxOutputTokens };
}

function mapEndpointToFeature(endpoint: AiEndpoint) {
  switch (endpoint) {
    case "coach":
      return "coach" as const;
    case "image_generate":
      return "imageGeneration" as const;
    case "detect":
      return "detect" as const;
    case "search":
      return "search" as const;
    case "lint":
      return "lint" as const;
    case "dynamics":
      return "chat" as const;
    case "genesis":
      return "chat" as const;
    case "style":
      return "styleAdaptation" as const;
    case "chat":
    default:
      return "chat" as const;
  }
}

async function resolveUserTier(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  userId: string
): Promise<TierId> {
  if ("db" in ctx) {
    return await getUserTier(ctx as QueryCtx | MutationCtx, userId);
  }

  return await (ctx as ActionCtx).runQuery(
    (internal as any)["lib/entitlements"].getUserTierInternal,
    { userId }
  );
}

async function resolveFeatureAccess(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  userId: string,
  feature: ReturnType<typeof mapEndpointToFeature>
): Promise<boolean> {
  if ("db" in ctx) {
    return await canAccessFeature(ctx as QueryCtx | MutationCtx, userId, feature);
  }

  return await (ctx as ActionCtx).runQuery(
    (internal as any)["lib/entitlements"].canAccessFeatureInternal,
    { userId, feature }
  );
}

async function getTierConfig(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  tier: TierId
) {
  if ("db" in ctx) {
    const record = await (ctx as QueryCtx | MutationCtx).db
      .query("tierConfigs")
      .withIndex("by_tier", (q) => q.eq("tier", tier))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();
    if (!record) {
      return getTierDefaults(tier);
    }
    return dbToTierConfig(record as any);
  }

  const record = await (ctx as ActionCtx).runQuery(
    internal["tiers"]["getByTierInternal"],
    { tier }
  );
  if (!record) {
    return getTierDefaults(tier);
  }
  return dbToTierConfig(record as any);
}

async function getUsageCounters(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  userId: string,
  periodStartMs: number
): Promise<{ tokensUsedManaged: number }> {
  if ("db" in ctx) {
    const record = await (ctx as QueryCtx | MutationCtx).db
      .query("billingUsagePeriods")
      .withIndex("by_user_period", (q) =>
        q.eq("userId", userId).eq("periodStartMs", periodStartMs)
      )
      .first();

    return { tokensUsedManaged: record?.tokensUsedManaged ?? 0 };
  }

  const record = await (ctx as ActionCtx).runQuery(
    internal["billing"]["getBillingUsageCounters"],
    { userId, periodStartMs }
  );

  return { tokensUsedManaged: record?.tokensUsedManaged ?? 0 };
}

function getBillingPeriodStartMs(referenceMs: number): number {
  const now = new Date(referenceMs);
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}
