/**
 * Stripe webhook processing and subscription sync.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  type CanonicalSubscriptionStatus,
  type CanonicalSubscriptionUpdate,
} from "./lib/billingCore";

interface StripeEvent {
  id: string;
  type: string;
  created?: number;
  livemode?: boolean;
  data: { object: any };
}

const STRIPE_PRICE_ENTITLEMENTS = [
  { priceId: process.env["STRIPE_PRICE_PRO_MONTHLY"], entitlements: ["pro"] },
  { priceId: process.env["STRIPE_PRICE_PRO_ANNUAL"], entitlements: ["pro"] },
  { priceId: process.env["STRIPE_PRICE_TEAM_MONTHLY"], entitlements: ["team"] },
  { priceId: process.env["STRIPE_PRICE_TEAM_ANNUAL"], entitlements: ["team"] },
].filter((entry) => Boolean(entry.priceId));

export const processWebhookEvent = internalMutation({
  args: { event: v.any() },
  handler: async (ctx, args) => {
    const event = args.event as StripeEvent;
    const now = Date.now();
    const eventTimeMs = event.created ? event.created * 1000 : now;

    const existingEvent = await ctx.db
      .query("subscriptionEvents")
      .withIndex("by_event_id", (q: any) => q.eq("eventId", event.id))
      .first();
    if (existingEvent) {
      return { success: true, eventType: event.type, duplicate: true };
    }

    const stripeObject = event.data?.object ?? {};
    const customerId = resolveStripeId(stripeObject.customer);

    let update: CanonicalSubscriptionUpdate | null = null;
    let userId: string | null = null;
    let productId = "unknown";

    switch (event.type) {
      case "checkout.session.completed": {
        const session = stripeObject;
        userId = resolveUserId(session.metadata, session.client_reference_id);
        productId = String(session.metadata?.priceId ?? session.metadata?.productId ?? "unknown");
        if (userId && customerId) {
          await upsertBillingCustomer(ctx, userId, customerId, now);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = stripeObject;
        const metadata = subscription.metadata ?? {};
        userId = resolveUserId(metadata);
        if (!userId && customerId) {
          userId = await resolveUserIdFromCustomer(ctx, customerId);
        }

        if (userId && customerId) {
          await upsertBillingCustomer(ctx, userId, customerId, now);
          update = buildSubscriptionUpdate({
            subscription,
            userId,
            customerId,
            eventId: event.id,
            eventTimeMs,
            rawEvent: event,
          });
          productId = update.productId;
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = stripeObject;
        userId = resolveUserId(invoice.metadata);
        if (!userId && customerId) {
          userId = await resolveUserIdFromCustomer(ctx, customerId);
        }
        if (userId && customerId) {
          update = await applyInvoiceStatus(ctx, {
            userId,
            customerId,
            status: event.type === "invoice.paid" ? "active" : "past_due",
            eventId: event.id,
            eventTimeMs,
            rawEvent: event,
          });
          if (update) {
            productId = update.productId;
          }
        }
        break;
      }

      default:
        break;
    }

    const logUserId = userId ?? customerId ?? "unknown";
    await ctx.db.insert("subscriptionEvents", {
      userId: logUserId,
      revenuecatId: customerId ?? undefined,
      eventId: event.id,
      eventType: event.type,
      store: "STRIPE",
      productId,
      transactionId: stripeObject?.payment_intent ?? stripeObject?.id,
      environment: event.livemode ? "PRODUCTION" : "SANDBOX",
      rawEvent: event,
      eventTimeMs,
      processedAt: now,
    });

    if (update) {
      await upsertStripeSubscription(ctx, update, now);
    }

    return { success: true, eventType: event.type };
  },
});

function buildSubscriptionUpdate(input: {
  subscription: any;
  userId: string;
  customerId: string;
  eventId: string;
  eventTimeMs: number;
  rawEvent: unknown;
}): CanonicalSubscriptionUpdate {
  const { subscription, userId, customerId, eventId, eventTimeMs, rawEvent } = input;

  const status = mapStripeStatus(subscription.status);
  const priceId =
    subscription.items?.data?.[0]?.price?.id ?? subscription.plan?.id ?? "unknown";
  const entitlements = resolveEntitlements(subscription.metadata, priceId);

  return {
    userId,
    store: "STRIPE",
    providerCustomerId: customerId,
    productId: String(priceId),
    entitlements,
    status,
    purchasedAt: (subscription.start_date ?? subscription.created ?? 0) * 1000,
    expiresAt: subscription.current_period_end
      ? subscription.current_period_end * 1000
      : undefined,
    willRenew: !subscription.cancel_at_period_end && status !== "canceled",
    isTrialPeriod: status === "trialing",
    rawEvent,
    eventId,
    eventTimeMs,
  };
}

async function applyInvoiceStatus(
  ctx: any,
  input: {
    userId: string;
    customerId: string;
    status: CanonicalSubscriptionStatus;
    eventId: string;
    eventTimeMs: number;
    rawEvent: unknown;
  }
): Promise<CanonicalSubscriptionUpdate | null> {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", input.userId))
    .first();

  if (!existing) {
    return null;
  }

  const entitlements = existing.entitlements ?? [];

  return {
    userId: input.userId,
    store: "STRIPE",
    providerCustomerId: input.customerId,
    productId: existing.productId,
    entitlements,
    status: input.status,
    purchasedAt: existing.purchasedAt,
    expiresAt: existing.expiresAt,
    willRenew: existing.willRenew,
    isTrialPeriod: existing.isTrialPeriod,
    rawEvent: input.rawEvent,
    eventId: input.eventId,
    eventTimeMs: input.eventTimeMs,
  };
}

async function upsertStripeSubscription(
  ctx: any,
  update: CanonicalSubscriptionUpdate,
  now: number
) {
  const existing = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q: any) => q.eq("userId", update.userId))
    .first();

  if (existing?.lastEventTimeMs && update.eventTimeMs < existing.lastEventTimeMs) {
    return;
  }

  const subscriptionData = {
    userId: update.userId,
    revenuecatId: update.providerCustomerId,
    providerCustomerId: update.providerCustomerId,
    status: update.status,
    store: update.store,
    productId: update.productId,
    entitlements: update.entitlements,
    purchasedAt: update.purchasedAt,
    expiresAt: update.expiresAt,
    gracePeriodExpiresAt: undefined,
    canceledAt: update.status === "canceled" ? update.eventTimeMs : undefined,
    willRenew: update.willRenew,
    isTrialPeriod: update.isTrialPeriod,
    trialExpiresAt: update.isTrialPeriod ? update.expiresAt : undefined,
    lastSyncedAt: now,
    lastEventTimeMs: update.eventTimeMs,
    rawEvent: update.rawEvent,
  };

  if (existing) {
    await ctx.db.patch(existing._id, subscriptionData);
  } else {
    await ctx.db.insert("subscriptions", subscriptionData as any);
  }
}

async function upsertBillingCustomer(
  ctx: any,
  userId: string,
  stripeCustomerId: string,
  now: number
): Promise<void> {
  const existing = await ctx.db
    .query("billingCustomers")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (existing) {
    if (existing.stripeCustomerId !== stripeCustomerId) {
      await ctx.db.patch(existing._id, {
        stripeCustomerId,
        updatedAt: now,
      });
    }
    return;
  }

  await ctx.db.insert("billingCustomers", {
    userId,
    stripeCustomerId,
    createdAt: now,
    updatedAt: now,
  });
}

async function resolveUserIdFromCustomer(
  ctx: any,
  stripeCustomerId: string
): Promise<string | null> {
  const record = await ctx.db
    .query("billingCustomers")
    .withIndex("by_stripe_customer", (q: any) =>
      q.eq("stripeCustomerId", stripeCustomerId)
    )
    .first();
  return record?.userId ?? null;
}

function resolveEntitlements(
  metadata: Record<string, string> | null | undefined,
  priceId?: string | null
): string[] {
  const entitlement = normalizeEntitlement(metadata?.["entitlement"] ?? metadata?.["tier"]);
  if (entitlement) {
    return [entitlement];
  }

  if (!priceId) return [];

  const match = STRIPE_PRICE_ENTITLEMENTS.find(
    (entry) => entry.priceId === priceId
  );
  return match?.entitlements ?? [];
}

function normalizeEntitlement(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "pro" || normalized === "team" || normalized === "enterprise") {
    return normalized;
  }
  return null;
}

function resolveUserId(
  metadata?: Record<string, string> | null,
  fallbackId?: string | null
): string | null {
  const userId = metadata?.["userId"] ?? metadata?.["userid"] ?? metadata?.["user_id"];
  return userId ?? fallbackId ?? null;
}

function resolveStripeId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof (value as any).id === "string") {
    return (value as any).id as string;
  }
  return null;
}

function mapStripeStatus(status: string | null | undefined): CanonicalSubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    default:
      return "canceled";
  }
}
