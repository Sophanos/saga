/**
 * Expo Auth Configuration
 *
 * Initializes Convex Auth and RevenueCat for Expo.
 */

import { useAuthActions } from "@convex-dev/auth/react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { initAuthConfig, setPlatform } from "@mythos/auth";
import { initRevenueCat as initRC } from "@mythos/auth/revenuecat";

// Set platform for auth package using expo-constants (web-safe)
function getExpoPlatform(): "ios" | "android" | "web" {
  if (Constants.platform?.ios) {
    return "ios";
  }
  if (Constants.platform?.android) {
    return "android";
  }
  return "web";
}

setPlatform(getExpoPlatform());

// Environment variables
// Auth domain should match CONVEX_SITE_URL (Option A: single domain for sign-in/callbacks)
const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL || "https://rhei.team";
const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL || "https://convex.rhei.team";
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;

// Get app scheme from Expo config
const schemeValue = Constants.expoConfig?.scheme;
const scheme = Array.isArray(schemeValue) ? schemeValue[0] : schemeValue ?? "mythos";

function getAuthRedirectTo(): string | undefined {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") {
      return undefined;
    }
    return `${window.location.origin}/callback`;
  }
  return Linking.createURL("/callback", { scheme });
}

async function openAuthRedirect(result: { redirect?: URL }): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  if (result.redirect) {
    await Linking.openURL(result.redirect.toString());
  }
}

async function signInWithOAuthProvider(
  signIn: (provider: string, params?: Record<string, string>) => Promise<{ redirect?: URL }>,
  provider: string
): Promise<void> {
  const redirectTo = getAuthRedirectTo();
  const params = redirectTo ? { redirectTo } : undefined;
  const result = await signIn(provider, params);
  await openAuthRedirect(result);
}

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
 * Hook to get auth actions
 */
export { useAuthActions };

/**
 * Sign in with magic link (email)
 */
export function useSignInWithEmail() {
  const { signIn } = useAuthActions();
  return async (email: string) => {
    const formData = new FormData();
    formData.append("email", email);
    const redirectTo = getAuthRedirectTo();
    if (redirectTo) {
      formData.append("redirectTo", redirectTo);
    }
    return signIn("resend", formData);
  };
}

/**
 * Sign in with GitHub
 */
export function useSignInWithGitHub() {
  const { signIn } = useAuthActions();
  return () => signInWithOAuthProvider(signIn, "github");
}

/**
 * Sign in with Apple
 */
export function useSignInWithApple() {
  const { signIn } = useAuthActions();
  return () => signInWithOAuthProvider(signIn, "apple");
}

/**
 * Sign in with Google
 */
export function useSignInWithGoogle() {
  const { signIn } = useAuthActions();
  return () => signInWithOAuthProvider(signIn, "google");
}

/**
 * Sign out hook
 */
export function useSignOut() {
  const { signOut } = useAuthActions();
  return async () => {
    const { logoutRevenueCat } = await import("@mythos/auth/revenuecat");
    await logoutRevenueCat();
    return signOut();
  };
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
