/**
 * Sign Out All
 *
 * Central sign-out orchestrator that:
 * 1. Signs out from the auth client
 * 2. Logs out from RevenueCat (on native)
 * 3. Resets all client state
 * 4. Optionally clears persisted storage
 */

import { isNativePlatform } from "./config";
import { useAuthStore, useSubscriptionStore } from "./store";

interface SignOutOptions {
  /** If true, also clears persisted storage keys */
  hard?: boolean;
}

/**
 * Sign out from all services and reset client state.
 *
 * @param authClient - The auth client instance
 * @param options - Sign out options
 */
export async function signOutAll(
  authClient: { signOut: () => Promise<unknown> },
  options?: SignOutOptions
): Promise<void> {
  const { hard = false } = options ?? {};

  // 1. Sign out from auth client
  try {
    await authClient.signOut();
  } catch (error) {
    console.error("[auth] Auth sign out failed:", error);
  }

  // 2. Reset auth stores
  useAuthStore.getState().reset();
  useSubscriptionStore.getState().reset();

  // 3. Log out from RevenueCat on native platforms
  if (isNativePlatform()) {
    try {
      const { logoutRevenueCat } = await import("./revenuecat");
      await logoutRevenueCat();
    } catch (error) {
      console.error("[auth] RevenueCat logout failed:", error);
    }
  }

  // 4. Reset all client state (import dynamically to avoid circular deps)
  try {
    const { resetAllClientState, clearAllPersistedStorage } = await import(
      "@mythos/state/resetAll"
    );
    resetAllClientState();

    if (hard) {
      await clearAllPersistedStorage();
    }
  } catch (error) {
    console.error("[auth] State reset failed:", error);
  }
}
