/**
 * Tauri Auth Configuration
 *
 * Better Auth client for Tauri desktop app.
 * Uses deep links for OAuth callbacks.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import { initAuthConfig } from "@mythos/auth";

// Environment variables (from Vite)
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL || "https://cascada.vision";
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://convex.cascada.vision";
const SCHEME = "mythos";

/**
 * Better Auth client for Tauri
 */
export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [
    convexClient(),
    crossDomainClient(),
  ],
});

/**
 * Initialize auth configuration
 */
export function initAuth() {
  initAuthConfig({
    convexSiteUrl: CONVEX_SITE_URL,
    convexUrl: CONVEX_URL,
    scheme: SCHEME,
    environment: import.meta.env.DEV ? "development" : "production",
  });
}

/**
 * Sign in with email
 */
export async function signInWithEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password });
}

/**
 * Sign up with email
 */
export async function signUpWithEmail(email: string, password: string, name?: string) {
  return authClient.signUp.email({ email, password, name: name || "" });
}

/**
 * Sign in with Apple (opens system browser)
 */
export async function signInWithApple() {
  const result = await authClient.signIn.social({
    provider: "apple",
    callbackURL: `${SCHEME}://auth/callback`,
  });

  // Open the authorization URL in system browser
  if (result.data?.url) {
    await open(result.data.url);
  }

  return result;
}

/**
 * Sign in with Google (opens system browser)
 */
export async function signInWithGoogle() {
  const result = await authClient.signIn.social({
    provider: "google",
    callbackURL: `${SCHEME}://auth/callback`,
  });

  // Open the authorization URL in system browser
  if (result.data?.url) {
    await open(result.data.url);
  }

  return result;
}

/**
 * Sign out
 */
export async function signOut() {
  return authClient.signOut();
}

/**
 * Get current session
 */
export function useSession() {
  return authClient.useSession();
}

/**
 * Handle auth callback from deep link
 */
export async function handleAuthCallback(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);

    if (urlObj.pathname === "/auth/callback") {
      // Refresh session after OAuth callback
      await authClient.getSession();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Setup deep link listener for OAuth callbacks
 */
export async function setupAuthDeepLinks(onAuthComplete?: () => void): Promise<() => void> {
  try {
    const unlisten = await listen("deep-link://new-url", async (event) => {
      const url = event.payload as string;
      const handled = await handleAuthCallback(url);

      if (handled && onAuthComplete) {
        onAuthComplete();
      }
    });

    return unlisten;
  } catch (error) {
    console.error("[auth] Failed to setup deep link listener:", error);
    return () => {};
  }
}

// Re-export hooks from @mythos/auth
export {
  useUser,
  useIsAuthenticated,
  useAuthLoading,
  useSubscription,
  useHasProAccess,
} from "@mythos/auth/hooks";
