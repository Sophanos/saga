/**
 * Subscription Management for Mythos
 *
 * Handles RevenueCat webhook events and subscription state.
 * Unified billing across iOS, Android, macOS (via RevenueCat).
 */

import { v } from "convex/values";
import {
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";

// ============================================================
// Types
// ============================================================

export interface RevenueCatEvent {
  type: string;
  id: string;
  app_user_id: string;
  original_app_user_id: string;
  product_id: string;
  entitlement_ids?: string[];
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  grace_period_expiration_at_ms?: number;
  environment: "SANDBOX" | "PRODUCTION";
  store: "APP_STORE" | "MAC_APP_STORE" | "PLAY_STORE" | "STRIPE" | "PROMOTIONAL";
  transaction_id?: string;
  original_transaction_id?: string;
  is_trial_period?: boolean;
  price_in_purchased_currency?: number;
  currency?: string;
  cancel_reason?: string;
}

export interface RevenueCatWebhook {
  api_version: string;
  event: RevenueCatEvent;
}

// ============================================================
// Internal Mutations (called from webhooks)
// ============================================================

/**
 * Process a RevenueCat webhook event
 */
export const processWebhookEvent = internalMutation({
  args: {
    event: v.any(),
  },
  handler: async (ctx, args) => {
    const event = args.event as RevenueCatEvent;
    const now = Date.now();

    // Log the event for audit
    await ctx.db.insert("subscriptionEvents", {
      userId: event.app_user_id,
      revenuecatId: event.original_app_user_id,
      eventType: event.type,
      store: event.store as any,
      productId: event.product_id,
      transactionId: event.transaction_id,
      environment: event.environment,
      priceInCents: event.price_in_purchased_currency
        ? Math.round(event.price_in_purchased_currency * 100)
        : undefined,
      currency: event.currency,
      rawEvent: event,
      processedAt: now,
    });

    // Handle different event types
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "PRODUCT_CHANGE":
        await upsertSubscription(ctx, event, "active", now);
        break;

      case "CANCELLATION":
        await upsertSubscription(ctx, event, "canceled", now);
        break;

      case "EXPIRATION":
        await upsertSubscription(ctx, event, "expired", now);
        break;

      case "BILLING_ISSUE":
        await upsertSubscription(ctx, event, "grace_period", now);
        break;

      case "SUBSCRIPTION_PAUSED":
        await upsertSubscription(ctx, event, "paused", now);
        break;

      case "UNCANCELLATION":
        // User re-enabled auto-renew
        await upsertSubscription(ctx, event, "active", now);
        break;

      case "TRANSFER":
        // Subscription transferred to another user
        await handleTransfer(ctx, event, now);
        break;

      default:
        console.log(`[subscriptions] Unhandled event type: ${event.type}`);
    }

    return { success: true, eventType: event.type };
  },
});

/**
 * Upsert subscription record
 */
async function upsertSubscription(
  ctx: any,
  event: RevenueCatEvent,
  status: string,
  now: number
) {
  // Find existing subscription
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", event.app_user_id))
    .first();

  const subscriptionData = {
    userId: event.app_user_id,
    revenuecatId: event.original_app_user_id,
    status: status as any,
    store: event.store as any,
    productId: event.product_id,
    entitlements: event.entitlement_ids || [],
    purchasedAt: event.purchased_at_ms || now,
    expiresAt: event.expiration_at_ms,
    gracePeriodExpiresAt: event.grace_period_expiration_at_ms,
    canceledAt: status === "canceled" ? now : undefined,
    willRenew: status === "active" && event.type !== "CANCELLATION",
    isTrialPeriod: event.is_trial_period || false,
    trialExpiresAt: event.is_trial_period ? event.expiration_at_ms : undefined,
    priceInCents: event.price_in_purchased_currency
      ? Math.round(event.price_in_purchased_currency * 100)
      : undefined,
    currency: event.currency,
    lastSyncedAt: now,
    rawEvent: event,
  };

  if (existing) {
    await ctx.db.patch(existing._id, subscriptionData);
  } else {
    await ctx.db.insert("subscriptions", subscriptionData);
  }
}

/**
 * Handle subscription transfer between users
 */
async function handleTransfer(
  ctx: any,
  event: RevenueCatEvent,
  now: number
) {
  // Mark old subscription as transferred/expired
  const oldSubscription = await ctx.db
    .query("subscriptions")
    .withIndex("by_revenuecat", (q: any) =>
      q.eq("revenuecatId", event.original_app_user_id)
    )
    .first();

  if (oldSubscription) {
    await ctx.db.patch(oldSubscription._id, {
      status: "expired",
      lastSyncedAt: now,
    });
  }

  // Create new subscription for new user
  await upsertSubscription(ctx, event, "active", now);
}

// ============================================================
// Queries
// ============================================================

/**
 * Get user's active subscription
 */
export const getActiveSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", identity.subject).eq("status", "active")
      )
      .first();

    // Also check for trialing
    if (!subscription) {
      return await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .filter((q) =>
          q.or(
            q.eq(q.field("status"), "trialing"),
            q.eq(q.field("status"), "grace_period")
          )
        )
        .first();
    }

    return subscription;
  },
});

/**
 * Get subscription history for user
 */
export const getSubscriptionHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("subscriptionEvents")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(50);
  },
});

/**
 * Check if user has specific entitlement
 */
export const checkEntitlement = query({
  args: {
    entitlement: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { hasAccess: false, reason: "not_authenticated" };

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "trialing"),
          q.eq(q.field("status"), "grace_period")
        )
      )
      .first();

    if (!subscription) {
      return { hasAccess: false, reason: "no_subscription" };
    }

    if (!subscription.entitlements.includes(args.entitlement)) {
      return { hasAccess: false, reason: "entitlement_not_included" };
    }

    // Check expiration
    if (subscription.expiresAt && subscription.expiresAt < Date.now()) {
      return { hasAccess: false, reason: "expired" };
    }

    return {
      hasAccess: true,
      subscription: {
        productId: subscription.productId,
        expiresAt: subscription.expiresAt,
        isTrialPeriod: subscription.isTrialPeriod,
      },
    };
  },
});

// ============================================================
// Internal Queries
// ============================================================

/**
 * Get subscription by RevenueCat ID (for webhook processing)
 */
export const getByRevenueCatId = internalQuery({
  args: {
    revenuecatId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_revenuecat", (q) => q.eq("revenuecatId", args.revenuecatId))
      .first();
  },
});

/**
 * Sync subscription from RevenueCat API (for manual sync)
 */
export const syncFromRevenueCat = internalMutation({
  args: {
    userId: v.string(),
    customerInfo: v.any(),
  },
  handler: async (ctx, args) => {
    const { userId, customerInfo } = args;
    const now = Date.now();

    // Get active entitlements from customerInfo
    const activeEntitlements = Object.keys(customerInfo.entitlements?.active || {});

    if (activeEntitlements.length === 0) {
      // No active subscription
      const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      if (existing && existing.status === "active") {
        await ctx.db.patch(existing._id, {
          status: "expired",
          lastSyncedAt: now,
        });
      }
      return { synced: true, hasActiveSubscription: false };
    }

    // Get the first active entitlement details
    const firstEntitlement = customerInfo.entitlements.active[activeEntitlements[0]];

    const subscriptionData = {
      userId,
      revenuecatId: customerInfo.originalAppUserId,
      status: "active" as const,
      store: (firstEntitlement.store || "APP_STORE") as any,
      productId: firstEntitlement.productIdentifier,
      entitlements: activeEntitlements,
      purchasedAt: new Date(firstEntitlement.originalPurchaseDate).getTime(),
      expiresAt: firstEntitlement.expirationDate
        ? new Date(firstEntitlement.expirationDate).getTime()
        : undefined,
      willRenew: firstEntitlement.willRenew ?? true,
      isTrialPeriod: firstEntitlement.periodType === "trial",
      lastSyncedAt: now,
    };

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, subscriptionData);
    } else {
      await ctx.db.insert("subscriptions", subscriptionData as any);
    }

    return { synced: true, hasActiveSubscription: true };
  },
});
