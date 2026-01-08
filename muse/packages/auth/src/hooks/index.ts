/**
 * Auth Hooks
 *
 * React hooks for authentication and subscription state.
 */

import { useEffect, useCallback } from "react";
import { useAuthStore, useSubscriptionStore } from "../store";
import { getPlatform, isNativePlatform } from "../config";
import type { User, Subscription } from "../types";

/**
 * Hook: Get current user
 */
export function useUser(): User | null {
  return useAuthStore((s) => s.user);
}

/**
 * Hook: Check if authenticated
 */
export function useIsAuthenticated(): boolean {
  return useAuthStore((s) => s.isAuthenticated);
}

/**
 * Hook: Check if auth is loading
 */
export function useAuthLoading(): boolean {
  return useAuthStore((s) => s.isLoading);
}

/**
 * Hook: Get auth error
 */
export function useAuthError(): string | null {
  return useAuthStore((s) => s.error);
}

/**
 * Hook: Get current subscription
 */
export function useSubscription(): Subscription | null {
  return useSubscriptionStore((s) => s.subscription);
}

/**
 * Hook: Check if user has pro access
 */
export function useHasProAccess(): boolean {
  return useSubscriptionStore((s) => s.hasProAccess);
}

/**
 * Hook: Check if user has specific entitlement
 */
export function useHasEntitlement(entitlement: string): boolean {
  const entitlements = useSubscriptionStore((s) => s.entitlements);
  return entitlements.includes(entitlement);
}

/**
 * Hook: Get all user entitlements
 */
export function useEntitlements(): string[] {
  return useSubscriptionStore((s) => s.entitlements);
}

/**
 * Hook: Auth state with actions
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setError = useAuthStore((s) => s.setError);
  const reset = useAuthStore((s) => s.reset);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    setUser,
    setLoading,
    setError,
    signOut: reset,
  };
}

/**
 * Hook: Initialize auth sync
 * Call this at app root to sync Better Auth session with store
 */
export function useAuthSync(authClient: any) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const setError = useAuthStore((s) => s.setError);

  const sync = useCallback(async () => {
    setLoading(true);
    try {
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser(session.data.user as User);
      } else {
        setUser(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Auth sync failed");
      setUser(null);
    }
  }, [authClient, setUser, setLoading, setError]);

  useEffect(() => {
    sync();
  }, [sync]);

  return { sync };
}

/**
 * Hook: Initialize RevenueCat sync
 * Call this at app root to sync RevenueCat with Better Auth user
 */
export function useRevenueCatSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSubscription = useSubscriptionStore((s) => s.setSubscription);
  const setSubscriptionLoading = useSubscriptionStore((s) => s.setLoading);

  useEffect(() => {
    if (!isNativePlatform()) return;

    const syncRevenueCat = async () => {
      setSubscriptionLoading(true);
      try {
        const { loginRevenueCat, logoutRevenueCat, refreshCustomerInfo } =
          await import("../revenuecat");

        if (isAuthenticated && userId) {
          await loginRevenueCat(userId);
        } else {
          await logoutRevenueCat();
        }
      } catch (error) {
        console.error("[useRevenueCatSync] Error:", error);
        setSubscription(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    syncRevenueCat();
  }, [userId, isAuthenticated, setSubscription, setSubscriptionLoading]);
}

/**
 * Hook: Feature gating
 * Returns whether user can access a feature based on their subscription
 */
export function useFeatureAccess(feature: string): {
  hasAccess: boolean;
  reason: "authenticated" | "entitlement" | "free" | "not_authenticated";
} {
  const isAuthenticated = useIsAuthenticated();
  const hasProAccess = useHasProAccess();
  const hasEntitlement = useHasEntitlement(feature);

  if (!isAuthenticated) {
    return { hasAccess: false, reason: "not_authenticated" };
  }

  // Check specific entitlement first
  if (hasEntitlement) {
    return { hasAccess: true, reason: "entitlement" };
  }

  // Check pro access for premium features
  if (hasProAccess) {
    return { hasAccess: true, reason: "entitlement" };
  }

  // Free tier access
  return { hasAccess: true, reason: "free" };
}

/**
 * Hook: Platform info
 */
export function usePlatform() {
  return {
    platform: getPlatform(),
    isNative: isNativePlatform(),
  };
}
