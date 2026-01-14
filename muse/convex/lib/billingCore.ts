/**
 * Billing core helpers shared across providers.
 */

import type { TierId } from "./tierConfig";

export type ProviderStore =
  | "APP_STORE"
  | "MAC_APP_STORE"
  | "PLAY_STORE"
  | "STRIPE"
  | "PROMOTIONAL";

export type CanonicalSubscriptionStatus =
  | "active"
  | "trialing"
  | "grace_period"
  | "paused"
  | "past_due"
  | "canceled"
  | "expired"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export interface CanonicalSubscriptionUpdate {
  userId: string;
  store: ProviderStore;
  providerCustomerId: string;
  productId: string;
  entitlements: string[];
  status: CanonicalSubscriptionStatus;
  purchasedAt: number;
  expiresAt?: number;
  willRenew: boolean;
  isTrialPeriod: boolean;
  rawEvent: unknown;
  eventId: string;
  eventTimeMs: number;
}

export function entitlementsToTier(entitlements: string[]): TierId {
  const normalized = entitlements.map((value) => value.toLowerCase());
  if (normalized.includes("enterprise")) return "enterprise";
  if (normalized.includes("team")) return "team";
  if (normalized.includes("pro")) return "pro";
  return "free";
}

export function resolveTierFromSubscription(input: {
  entitlements?: string[] | null;
  productId?: string | null;
}): TierId {
  const entitlements = input.entitlements ?? [];
  if (entitlements.length > 0) {
    return entitlementsToTier(entitlements);
  }

  const productId = (input.productId ?? "").toLowerCase();
  if (productId.includes("enterprise")) return "enterprise";
  if (productId.includes("team")) return "team";
  if (productId.includes("pro")) return "pro";
  return "free";
}

export function normalizeSubscriptionStatus(
  status?: string | null
): CanonicalSubscriptionStatus {
  if (!status) return "active";

  const normalized = status.toLowerCase();

  switch (normalized) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "grace_period":
      return "grace_period";
    case "paused":
      return "paused";
    case "past_due":
      return "past_due";
    case "expired":
      return "expired";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "incomplete_expired";
    case "unpaid":
      return "unpaid";
    default:
      return "canceled";
  }
}

export function isStatusActive(status: CanonicalSubscriptionStatus): boolean {
  return status === "active" || status === "trialing" || status === "grace_period";
}
