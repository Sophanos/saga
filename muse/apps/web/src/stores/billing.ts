/**
 * Web Billing Store
 * Instance of the billing store configured for web platform
 */

import {
  createBillingStore,
  useSubscription as useSubscriptionSelector,
  useUsage as useUsageSelector,
  useBillingMode as useBillingModeSelector,
  useCanUseAI as useCanUseAISelector,
  useUsagePercentage as useUsagePercentageSelector,
  useIsSubscriptionActive as useIsSubscriptionActiveSelector,
  useBillingLoading as useBillingLoadingSelector,
  useBillingError as useBillingErrorSelector,
  type BillingStore,
  type BillingState,
  type BillingTier,
  type BillingMode,
  type SubscriptionStatus,
  type Subscription,
  type Usage,
} from "@mythos/state";
import { webStorage } from "@mythos/storage";

// Create the billing store with web storage adapter
export const useBillingStore = createBillingStore(webStorage);

// Bound selectors for convenience
export const useSubscription = () => useSubscriptionSelector(useBillingStore);
export const useUsage = () => useUsageSelector(useBillingStore);
export const useBillingMode = () => useBillingModeSelector(useBillingStore);
export const useCanUseAI = () => useCanUseAISelector(useBillingStore);
export const useUsagePercentage = () =>
  useUsagePercentageSelector(useBillingStore);
export const useIsSubscriptionActive = () =>
  useIsSubscriptionActiveSelector(useBillingStore);
export const useBillingLoading = () =>
  useBillingLoadingSelector(useBillingStore);
export const useBillingError = () => useBillingErrorSelector(useBillingStore);

// Re-export types for convenience
export type {
  BillingStore,
  BillingState,
  BillingTier,
  BillingMode,
  SubscriptionStatus,
  Subscription,
  Usage,
};
