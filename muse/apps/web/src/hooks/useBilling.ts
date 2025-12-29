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

interface SubscriptionResponse {
  subscription: Subscription;
  usage: Usage;
}

interface BillingModeResponse {
  success: boolean;
  billingMode: BillingMode;
}

export function useBilling() {
  const store = useBillingStore();
  const subscription = useSubscription();
  const usage = useUsage();
  const billingMode = useBillingMode();
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
   * @param tier - The subscription tier to checkout: 'pro', 'pro_plus', or 'team'
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
    isLoading,
    error,

    // Actions
    openCheckout,
    openPortal,
    switchBillingMode,
    refresh,
    clearError,
  };
}

export type { BillingMode, BillingTier, Subscription, Usage };
