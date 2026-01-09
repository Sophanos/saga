/**
 * Entitlements Helper
 *
 * Centralized entitlement checks for Convex functions.
 * Checks user subscription status and entitlements.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Database context type - only Query and Mutation contexts have direct DB access.
 * Actions must call internal queries/mutations to access the database.
 */
type DbContext = QueryCtx | MutationCtx;

/**
 * Get active subscription for a user
 */
export async function getActiveSubscription(ctx: DbContext, userId: string) {
  const subscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .filter((q) =>
      q.or(
        q.eq(q.field("status"), "active"),
        q.eq(q.field("status"), "trialing"),
        q.eq(q.field("status"), "grace_period"),
        q.eq(q.field("status"), "ACTIVE"),
        q.eq(q.field("status"), "TRIALING"),
        q.eq(q.field("status"), "GRACE_PERIOD")
      )
    )
    .first();

  return subscription;
}

/**
 * Check if user has a specific entitlement
 */
export async function hasEntitlement(
  ctx: DbContext,
  userId: string,
  entitlement: string
): Promise<boolean> {
  const subscription = await getActiveSubscription(ctx, userId);

  if (!subscription) {
    return false;
  }

  return subscription.entitlements.includes(entitlement);
}

/**
 * Assert user has entitlement, throw if not
 */
export async function assertEntitlement(
  ctx: DbContext,
  userId: string,
  entitlement: string
): Promise<void> {
  const hasAccess = await hasEntitlement(ctx, userId, entitlement);

  if (!hasAccess) {
    throw new Error(`Missing entitlement: ${entitlement}`);
  }
}

/**
 * Check if user has pro access
 */
export async function hasProAccess(
  ctx: DbContext,
  userId: string
): Promise<boolean> {
  return hasEntitlement(ctx, userId, "pro");
}

/**
 * Get user's tier based on subscription
 */
export async function getUserTier(
  ctx: DbContext,
  userId: string
): Promise<"free" | "pro" | "team" | "enterprise"> {
  const subscription = await getActiveSubscription(ctx, userId);

  if (!subscription) {
    return "free";
  }

  // Map product ID to tier
  const productId = subscription.productId.toLowerCase();

  if (productId.includes("enterprise")) return "enterprise";
  if (productId.includes("team")) return "team";
  if (productId.includes("pro")) return "pro";

  return "free";
}

/**
 * Get tier configuration for a user
 */
export async function getUserTierConfig(ctx: DbContext, userId: string) {
  const tier = await getUserTier(ctx, userId);

  const config = await ctx.db
    .query("tierConfigs")
    .withIndex("by_tier", (q) => q.eq("tier", tier))
    .filter((q) => q.eq(q.field("isActive"), true))
    .first();

  return config;
}

/**
 * Check feature access based on tier
 */
export async function canAccessFeature(
  ctx: DbContext,
  userId: string,
  feature: keyof NonNullable<Awaited<ReturnType<typeof getUserTierConfig>>>["aiFeatures"]
): Promise<boolean> {
  const config = await getUserTierConfig(ctx, userId);

  if (!config) {
    // Default free tier if no config
    return feature === "chat" || feature === "search";
  }

  return config.aiFeatures[feature] ?? false;
}

/**
 * Get memory retention days for user's tier
 */
export async function getMemoryRetentionDays(
  ctx: DbContext,
  userId: string
): Promise<number | null> {
  const config = await getUserTierConfig(ctx, userId);

  if (!config) {
    return 90; // Default free tier: 90 days
  }

  return config.memory.retentionDays ?? null; // null = forever
}
