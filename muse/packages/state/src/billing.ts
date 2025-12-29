/**
 * Billing state store
 * Platform-agnostic billing and subscription state
 */

import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StorageAdapter } from "@mythos/storage";

/**
 * Subscription tiers
 */
export type BillingTier = "free" | "pro" | "pro_plus" | "team";

/**
 * Billing modes for AI usage
 * - managed: Platform manages AI credits (included in subscription or purchased)
 * - byok: Bring Your Own Key (user provides their own API keys)
 */
export type BillingMode = "managed" | "byok";

/**
 * Subscription status
 */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/**
 * Subscription details
 */
export interface Subscription {
  tier: BillingTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Usage tracking
 */
export interface Usage {
  tokensUsed: number;
  tokensIncluded: number;
  tokensRemaining: number;
  wordsWritten: number;
}

export interface BillingState {
  // Subscription
  tier: BillingTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;

  // Usage
  tokensUsed: number;
  tokensIncluded: number;
  tokensRemaining: number;
  wordsWritten: number;

  // Billing mode
  billingMode: BillingMode;

  // Loading state
  isLoading: boolean;
  error: string | null;
}

export interface BillingActions {
  setSubscription: (subscription: Subscription) => void;
  setUsage: (usage: Usage) => void;
  setBillingMode: (mode: BillingMode) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  refresh: () => void;
  reset: () => void;
}

export type BillingStore = BillingState & BillingActions;

const initialState: BillingState = {
  tier: "free",
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  tokensUsed: 0,
  tokensIncluded: 0,
  tokensRemaining: 0,
  wordsWritten: 0,
  billingMode: "managed",
  isLoading: true,
  error: null,
};

/**
 * Create billing store with platform-specific storage
 */
export function createBillingStore(storage: StorageAdapter) {
  return create<BillingStore>()(
    persist(
      (set) => ({
        ...initialState,

        setSubscription: (subscription) =>
          set({
            tier: subscription.tier,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            isLoading: false,
            error: null,
          }),

        setUsage: (usage) =>
          set({
            tokensUsed: usage.tokensUsed,
            tokensIncluded: usage.tokensIncluded,
            tokensRemaining: usage.tokensRemaining,
            wordsWritten: usage.wordsWritten,
          }),

        setBillingMode: (billingMode) => set({ billingMode }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error, isLoading: false }),

        clearError: () => set({ error: null }),

        refresh: () => set({ isLoading: true, error: null }),

        reset: () => set(initialState),
      }),
      {
        name: "billing",
        storage: createJSONStorage(() => ({
          getItem: async (key) => storage.getItem(key),
          setItem: async (key, value) => storage.setItem(key, value),
          removeItem: async (key) => storage.removeItem(key),
        })),
        partialize: (state) => ({
          billingMode: state.billingMode,
        }),
      }
    )
  );
}

// Type for the created store
type BillingStoreType = UseBoundStore<StoreApi<BillingStore>>;

/**
 * Selector: Get subscription details
 */
export function useSubscription(store: BillingStoreType) {
  return store((state) => ({
    tier: state.tier,
    status: state.status,
    currentPeriodEnd: state.currentPeriodEnd,
    cancelAtPeriodEnd: state.cancelAtPeriodEnd,
  }));
}

/**
 * Selector: Get usage details
 */
export function useUsage(store: BillingStoreType) {
  return store((state) => ({
    tokensUsed: state.tokensUsed,
    tokensIncluded: state.tokensIncluded,
    tokensRemaining: state.tokensRemaining,
    wordsWritten: state.wordsWritten,
  }));
}

/**
 * Selector: Get billing mode
 */
export function useBillingMode(store: BillingStoreType) {
  return store((state) => state.billingMode);
}

/**
 * Selector: Check if user can use AI features
 * Returns true if user has tokens remaining or is using BYOK
 */
export function useCanUseAI(store: BillingStoreType) {
  return store((state) => {
    // BYOK users always have access
    if (state.billingMode === "byok") return true;

    // Check subscription status
    if (state.status !== "active" && state.status !== "trialing") {
      return false;
    }

    // Check token availability
    return state.tokensRemaining > 0 || state.tokensIncluded === 0; // Unlimited if tokensIncluded is 0
  });
}

/**
 * Selector: Get usage percentage (0-100)
 */
export function useUsagePercentage(store: BillingStoreType) {
  return store((state) => {
    if (state.tokensIncluded === 0) return 0; // Unlimited
    return Math.min(100, (state.tokensUsed / state.tokensIncluded) * 100);
  });
}

/**
 * Selector: Check if subscription is active
 */
export function useIsSubscriptionActive(store: BillingStoreType) {
  return store(
    (state) => state.status === "active" || state.status === "trialing"
  );
}

/**
 * Selector: Get loading state
 */
export function useBillingLoading(store: BillingStoreType) {
  return store((state) => state.isLoading);
}

/**
 * Selector: Get error state
 */
export function useBillingError(store: BillingStoreType) {
  return store((state) => state.error);
}
