/**
 * useBilling Hook
 * Provides billing management actions and state for subscription and usage
 */

import { useCallback, useEffect } from "react";
import {
  useBillingStore,
  useSubscription,
  useUsage,
  useBillingMode,
  usePreferredModel,
  useBillingLoading,
  useBillingError,
  type BillingMode,
  type BillingTier,
  type Subscription,
  type Usage,
} from "../stores/billing";
import { callEdgeFunction, ApiError } from "../services/api-client";

interface CheckoutResponse {
  url: string;
}

interface PortalResponse {
  url: string;
}

interface BillingPeriod {
  start: string;
  end: string;
}

interface BillingLimits {
  ai: {
    tokensPerMonth: number | null;
    callsPerDay: number;
    concurrentRequests: number;
  };
  memory: {
    retentionDays: number | null;
    maxPerProject: number;
    maxPinned: number;
  };
  embeddings: {
    operationsPerDay: number;
    maxVectorsPerProject: number;
  };
}

interface BillingUsageDetail {
  memories?: {
    used: number;
    limit: number;
    pinnedUsed: number;
    pinnedLimit: number;
  };
  vectors?: {
    used: number;
    limit: number;
    unavailable?: boolean;
  };
}

interface SubscriptionResponse {
  subscription: Subscription;
  usage: Usage;
  billingMode: BillingMode;
  preferredModel?: string;
  period?: BillingPeriod;
  limits?: BillingLimits;
  usageDetail?: BillingUsageDetail;
}

interface BillingModeResponse {
  success: boolean;
  billingMode: BillingMode;
}

interface PreferredModelResponse {
  success: boolean;
  preferredModel: string;
}

interface UseBillingResult {
  subscription: Subscription;
  usage: Usage;
  billingMode: BillingMode;
  preferredModel: string | null;
  isLoading: boolean;
  error: string | null;
  openCheckout: (tier: BillingTier, billingInterval?: "monthly" | "annual") => Promise<void>;
  openPortal: () => Promise<void>;
  switchBillingMode: (mode: BillingMode, byokKey?: string) => Promise<boolean>;
  setPreferredModel: (model: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

export function useBilling(): UseBillingResult {
  const store = useBillingStore();
  const subscription = useSubscription();
  const usage = useUsage();
  const billingMode = useBillingMode();
  const preferredModel = usePreferredModel();
  const isLoading = useBillingLoading();
  const error = useBillingError();

  /**
   * Refresh subscription and usage data from the server
   */
  const refresh = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);

    try {
      const response = await callEdgeFunction<
        Record<string, never>,
        SubscriptionResponse
      >("billing-subscription", {});

      store.setSubscription(response.subscription);
      store.setUsage(response.usage);
      store.setBillingMode(response.billingMode);
      store.setPreferredModel(response.preferredModel ?? null);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load billing data";
      store.setError(message);
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  /**
   * Open Stripe Checkout for a specific tier
   * @param tier - The subscription tier to checkout: 'pro' or 'team' (enterprise is custom)
   * @param billingInterval - The billing frequency: 'monthly' or 'annual' (defaults to 'monthly')
   */
  const openCheckout = useCallback(
    async (tier: BillingTier, billingInterval: "monthly" | "annual" = "monthly") => {
      store.setLoading(true);
      store.setError(null);

      try {
        const response = await callEdgeFunction<
          { tier: BillingTier; billingInterval: "monthly" | "annual" },
          CheckoutResponse
        >("stripe-checkout", {
          tier,
          billingInterval,
        });

        // Redirect to Stripe Checkout
        window.location.href = response.url;
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to open checkout";
        store.setError(message);
        store.setLoading(false);
      }
    },
    [store]
  );

  /**
   * Open Stripe Customer Portal in a new tab
   */
  const openPortal = useCallback(async () => {
    store.setLoading(true);
    store.setError(null);

    try {
      const response = await callEdgeFunction<
        Record<string, never>,
        PortalResponse
      >("stripe-portal", {});

      // Open portal in new tab
      window.open(response.url, "_blank");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to open billing portal";
      store.setError(message);
    } finally {
      store.setLoading(false);
    }
  }, [store]);

  /**
   * Switch between billing modes
   * @param mode - The billing mode: 'managed' (platform credits) or 'byok' (bring your own key)
   * @param byokKey - API key required when switching to 'byok' mode
   * @returns true if successful, false otherwise
   */
  const switchBillingMode = useCallback(
    async (mode: BillingMode, byokKey?: string): Promise<boolean> => {
      store.setLoading(true);
      store.setError(null);

      try {
        const response = await callEdgeFunction<
          { mode: BillingMode; byokKey?: string },
          BillingModeResponse
        >("billing-mode", { mode, byokKey });

        if (response.success) {
          store.setBillingMode(response.billingMode);
          return true;
        }
        return false;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to switch billing mode";
        store.setError(message);
        return false;
      } finally {
        store.setLoading(false);
      }
    },
    [store]
  );

  /**
   * Set preferred model for BYOK users
   * @param model - OpenRouter model ID (e.g., "anthropic/claude-sonnet-4")
   * @returns true if successful, false otherwise
   */
  const setPreferredModel = useCallback(
    async (model: string): Promise<boolean> => {
      store.setLoading(true);
      store.setError(null);

      try {
        const response = await callEdgeFunction<
          { model: string },
          PreferredModelResponse
        >("billing-preferred-model", { model });

        if (response.success) {
          store.setPreferredModel(response.preferredModel);
          return true;
        }
        return false;
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to set preferred model";
        store.setError(message);
        return false;
      } finally {
        store.setLoading(false);
      }
    },
    [store]
  );

  // Fetch billing data on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Expose clearError from store
  const clearError = useCallback(() => {
    store.clearError();
  }, [store]);

  return {
    // State
    subscription,
    usage,
    billingMode,
    preferredModel,
    isLoading,
    error,

    // Actions
    openCheckout,
    openPortal,
    switchBillingMode,
    setPreferredModel,
    refresh,
    clearError,
  };
}

export type { BillingMode, BillingTier, Subscription, Usage };
