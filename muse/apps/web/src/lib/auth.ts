/**
 * Web Auth Configuration
 *
 * Initializes Convex Auth for web platform.
 */

import { useAuthActions } from "@convex-dev/auth/react";
import { initAuthConfig, setPlatform } from "@mythos/auth";
import { invalidateTokenCache } from "./tokenCache";
import { isTauri } from "./tauriAuth";

// Set platform
setPlatform("web");

// Environment variables
// Auth domain should match CONVEX_SITE_URL (Option A: single domain for sign-in/callbacks)
const CONVEX_SITE_URL = import.meta.env["VITE_CONVEX_SITE_URL"] || "https://rhei.team";
const CONVEX_URL = import.meta.env["VITE_CONVEX_URL"] || "https://convex.rhei.team";

function getAuthRedirectTo(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  // Use deep link callback for Tauri, web callback otherwise
  if (isTauri()) {
    return "rhei://auth/callback";
  }
  return `${window.location.origin}/callback`;
}

/**
 * Initialize auth configuration
 */
export function initAuth() {
  initAuthConfig({
    convexSiteUrl: CONVEX_SITE_URL,
    convexUrl: CONVEX_URL,
    scheme: "rhei",
    environment: import.meta.env.DEV ? "development" : "production",
  });
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
  return () => {
    const redirectTo = getAuthRedirectTo();
    if (redirectTo) {
      return signIn("github", { redirectTo });
    }
    return signIn("github");
  };
}

/**
 * Sign in with Apple
 */
export function useSignInWithApple() {
  const { signIn } = useAuthActions();
  return () => {
    const redirectTo = getAuthRedirectTo();
    if (redirectTo) {
      return signIn("apple", { redirectTo });
    }
    return signIn("apple");
  };
}

/**
 * Sign in with Google
 */
export function useSignInWithGoogle() {
  const { signIn } = useAuthActions();
  return () => {
    const redirectTo = getAuthRedirectTo();
    if (redirectTo) {
      return signIn("google", { redirectTo });
    }
    return signIn("google");
  };
}

/**
 * Sign out hook
 */
export function useSignOut() {
  const { signOut } = useAuthActions();
  return async () => {
    invalidateTokenCache();
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
} from "@mythos/auth/hooks";
