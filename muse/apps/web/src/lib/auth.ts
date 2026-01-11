/**
 * Web Auth Configuration
 *
 * Initializes Better Auth for web platform.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { initAuthConfig, setPlatform } from "@mythos/auth";

// Set platform
setPlatform("web");

// Environment variables
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL || "https://cascada.vision";
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://convex.cascada.vision";

/**
 * Better Auth client for Web
 * Uses crossDomainClient (localStorage + Better-Auth-Cookie header)
 */
export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [
    crossDomainClient({
      storagePrefix: "better-auth",
    }),
    convexClient(),
  ],
});

/**
 * Initialize auth configuration
 */
export function initAuth() {
  initAuthConfig({
    convexSiteUrl: CONVEX_SITE_URL,
    convexUrl: CONVEX_URL,
    scheme: "mythos",
    environment: import.meta.env.DEV ? "development" : "production",
  });
}

/**
 * Sign in with email
 */
export async function signInWithEmail(email: string, password: string) {
  return authClient.signIn.email({
    email,
    password,
    callbackURL: window.location.origin,
  });
}

/**
 * Sign up with email
 */
export async function signUpWithEmail(email: string, password: string, name?: string) {
  return authClient.signUp.email({
    email,
    password,
    name: name || "",
    callbackURL: window.location.origin,
  });
}

/**
 * Sign in with Apple
 */
export async function signInWithApple() {
  return authClient.signIn.social({
    provider: "apple",
    callbackURL: `${window.location.origin}/auth/callback`,
  });
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  return authClient.signIn.social({
    provider: "google",
    callbackURL: `${window.location.origin}/auth/callback`,
  });
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

// Re-export hooks from @mythos/auth
export {
  useUser,
  useIsAuthenticated,
  useAuthLoading,
  useSubscription,
  useHasProAccess,
} from "@mythos/auth/hooks";
