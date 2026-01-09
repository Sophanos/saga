/**
 * Expo Auth Configuration
 *
 * Initializes Better Auth and RevenueCat for Expo.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { initAuthConfig, setPlatform } from "@mythos/auth";
import { initRevenueCat as initRC } from "@mythos/auth/revenuecat";

// Set platform for auth package using expo-constants (web-safe)
const expoOS = Constants.platform?.ios ? "ios"
  : Constants.platform?.android ? "android"
  : typeof window !== "undefined" && typeof document !== "undefined" ? "web"
  : "web";
setPlatform(expoOS as "ios" | "android" | "web");

// Environment variables
const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || "https://cascada.vision";
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || "https://convex.cascada.vision";
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

// Get app scheme from Expo config
const scheme = Constants.expoConfig?.scheme || "mythos";

/**
 * Better Auth client for Expo
 */
export const authClient = createAuthClient({
  baseURL: CONVEX_SITE_URL,
  plugins: [
    expoClient({
      scheme,
      storagePrefix: scheme,
      storage: SecureStore,
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
    scheme,
    revenueCatApiKey: REVENUECAT_API_KEY,
    environment: __DEV__ ? "development" : "production",
  });
}

/**
 * Initialize RevenueCat
 */
export async function initRevenueCat() {
  if (!REVENUECAT_API_KEY) {
    console.warn("[auth] RevenueCat API key not configured");
    return;
  }

  try {
    await initRC();
    console.log("[auth] RevenueCat initialized");
  } catch (error) {
    console.error("[auth] RevenueCat init failed:", error);
  }
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
 * Sign in with Apple
 */
export async function signInWithApple() {
  return authClient.signIn.social({
    provider: "apple",
    callbackURL: `${scheme}://auth/callback`,
  });
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  return authClient.signIn.social({
    provider: "google",
    callbackURL: `${scheme}://auth/callback`,
  });
}

/**
 * Sign out
 */
export async function signOut() {
  const { logoutRevenueCat } = await import("@mythos/auth/revenuecat");
  await logoutRevenueCat();
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
  useHasEntitlement,
} from "@mythos/auth/hooks";
