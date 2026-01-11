/**
 * Auth Store (Zustand)
 *
 * Central state management for authentication and subscriptions.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  User,
  Session,
  AuthState,
  Subscription,
  SubscriptionState,
} from "./types";

// ============================================================
// Auth Lifecycle Events
// ============================================================

/**
 * Lifecycle events emitted by the auth store.
 * Used by platform-specific code (e.g., web token cache) to react to auth changes.
 */
export type AuthLifecycleEvent =
  | { type: "reset" }
  | { type: "user_changed"; prevUserId: string | null; nextUserId: string | null }
  | { type: "session_changed"; prevSessionId: string | null; nextSessionId: string | null };

/** Set of lifecycle event subscribers */
const lifecycleSubscribers = new Set<(event: AuthLifecycleEvent) => void>();

/**
 * Emit an auth lifecycle event to all subscribers
 */
function emitLifecycleEvent(event: AuthLifecycleEvent) {
  for (const callback of lifecycleSubscribers) {
    try {
      callback(event);
    } catch (error) {
      console.error("[auth/store] Lifecycle subscriber error:", error);
    }
  }
}

/**
 * Subscribe to auth lifecycle events.
 *
 * Events are emitted on:
 * - `reset`: Store was reset (logout)
 * - `user_changed`: User ID changed (login/logout/switch)
 * - `session_changed`: Session ID changed (refresh/login/logout)
 *
 * @returns Unsubscribe function
 */
export function subscribeAuthLifecycle(
  callback: (event: AuthLifecycleEvent) => void
): () => void {
  lifecycleSubscribers.add(callback);
  return () => {
    lifecycleSubscribers.delete(callback);
  };
}

// ============================================================
// Auth Store
// ============================================================

interface AuthStore extends AuthState {
  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialAuthState: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialAuthState,

      setUser: (user) => {
        const prevUserId = get().user?.id ?? null;
        const nextUserId = user?.id ?? null;

        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        });

        // Emit lifecycle event if user ID changed
        if (prevUserId !== nextUserId) {
          emitLifecycleEvent({ type: "user_changed", prevUserId, nextUserId });
        }
      },

      setSession: (session) => {
        const prevSessionId = get().session?.id ?? null;
        const nextSessionId = session?.id ?? null;

        set({
          session,
          isAuthenticated: !!session,
        });

        // Emit lifecycle event if session ID changed
        if (prevSessionId !== nextSessionId) {
          emitLifecycleEvent({ type: "session_changed", prevSessionId, nextSessionId });
        }
      },

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error, isLoading: false }),

      reset: () => {
        set(initialAuthState);
        emitLifecycleEvent({ type: "reset" });
      },
    }),
    {
      name: "mythos-auth",
      storage: createJSONStorage(() => {
        // Use localStorage on web, or a no-op storage for native
        if (typeof window !== "undefined" && window.localStorage) {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// ============================================================
// Subscription Store
// ============================================================

interface SubscriptionStore extends SubscriptionState {
  // Actions
  setSubscription: (subscription: Subscription | null) => void;
  setLoading: (isLoading: boolean) => void;
  updateEntitlements: (entitlements: string[]) => void;
  reset: () => void;
}

const initialSubscriptionState: SubscriptionState = {
  subscription: null,
  isLoading: true,
  entitlements: [],
  hasProAccess: false,
};

/**
 * Pro entitlement ID in RevenueCat
 */
const PRO_ENTITLEMENT = "pro";

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set) => ({
      ...initialSubscriptionState,

      setSubscription: (subscription) =>
        set({
          subscription,
          entitlements: subscription?.entitlements || [],
          hasProAccess: subscription?.entitlements.includes(PRO_ENTITLEMENT) || false,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      updateEntitlements: (entitlements) =>
        set({
          entitlements,
          hasProAccess: entitlements.includes(PRO_ENTITLEMENT),
        }),

      reset: () => set(initialSubscriptionState),
    }),
    {
      name: "mythos-subscription",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined" && window.localStorage) {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        subscription: state.subscription,
        entitlements: state.entitlements,
        hasProAccess: state.hasProAccess,
      }),
    }
  )
);

// ============================================================
// Selectors
// ============================================================

/**
 * Get current user ID
 */
export const selectUserId = () => useAuthStore.getState().user?.id;

/**
 * Check if user is authenticated
 */
export const selectIsAuthenticated = () => useAuthStore.getState().isAuthenticated;

/**
 * Check if user has pro access
 */
export const selectHasProAccess = () => useSubscriptionStore.getState().hasProAccess;

/**
 * Check if user has specific entitlement
 */
export const selectHasEntitlement = (entitlement: string) =>
  useSubscriptionStore.getState().entitlements.includes(entitlement);
