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
   */
  const openCheckout = useCallback(
    async (tier: BillingTier) => {
      store.setLoading(true);
      store.setError(null);

      try {
        const response = await callEdgeFunction<
          { tier: BillingTier; billingMode: BillingMode },
          CheckoutResponse
        >("stripe-checkout", {
          tier,
          billingMode,
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
    [store, billingMode]
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
   */
  const switchBillingMode = useCallback(
    async (mode: BillingMode, byokKey?: string) => {
      store.setLoading(true);
      store.setError(null);

      try {
        const response = await callEdgeFunction<
          { mode: BillingMode; byokKey?: string },
          BillingModeResponse
        >("billing-mode", { mode, byokKey });

        if (response.success) {
          store.setBillingMode(response.billingMode);
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Failed to switch billing mode";
        store.setError(message);
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
  };
}

export type { BillingMode, BillingTier, Subscription, Usage };
