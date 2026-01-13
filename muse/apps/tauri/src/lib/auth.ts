/**
 * Tauri Auth Configuration
 *
 * Convex Auth client for Tauri desktop app.
 * Uses useAuthActions from @convex-dev/auth/react for auth operations.
 *
 * NOTE: OAuth providers (Google, Apple, GitHub) require a hosted redirect
 * landing page for desktop apps. Magic link (email) auth works directly.
 *
 * OAuth flow for desktop (TODO - Phase 2):
 * 1. App opens OAuth URL in system browser
 * 2. OAuth provider redirects to hosted landing page (e.g., https://rhei.team/auth/desktop-callback)
 * 3. Landing page redirects to mythos:// deep link with auth code
 * 4. Tauri handles deep link and completes auth
 */

import { useAuthActions } from "@convex-dev/auth/react";
import { listen } from "@tauri-apps/api/event";
import { initAuthConfig, setPlatform } from "@mythos/auth";

// Environment variables (from Vite)
// Auth domain should match CONVEX_SITE_URL (Option A: single domain)
const CONVEX_SITE_URL = import.meta.env.VITE_CONVEX_SITE_URL || "https://rhei.team";
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "https://convex.rhei.team";
const SCHEME = "mythos";

// Set platform for auth package
setPlatform("web"); // Tauri is web-based

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

type AuthCallbackParams = {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
};

function getAuthRedirectTo(): string {
  return `${SCHEME}://auth/callback`;
}

function parseAuthCallback(url: string): AuthCallbackParams | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const isCallback =
      pathname === "/callback" ||
      pathname === "/auth/callback" ||
      pathname.includes("/auth/callback");

    if (!isCallback) {
      return null;
    }

    return {
      code: urlObj.searchParams.get("code") ?? undefined,
      state: urlObj.searchParams.get("state") ?? undefined,
      error: urlObj.searchParams.get("error") ?? undefined,
      error_description: urlObj.searchParams.get("error_description") ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Hook to get auth actions
 */
export { useAuthActions };

/**
 * Sign in with magic link (email)
 * This is the recommended auth method for Tauri as it doesn't require OAuth redirects.
 */
export function useSignInWithEmail() {
  const { signIn } = useAuthActions();
  return async (email: string) => {
    const formData = new FormData();
    formData.append("email", email);
    formData.append("redirectTo", getAuthRedirectTo());
    return signIn("resend", formData);
  };
}

/**
 * Sign in with GitHub
 * NOTE: OAuth for desktop apps requires additional setup (Phase 2).
 * For now, this initiates the standard web OAuth flow.
 */
export function useSignInWithGitHub() {
  const { signIn } = useAuthActions();
  return () => {
    console.warn("[auth] GitHub OAuth on desktop requires hosted redirect page (Phase 2)");
    return signIn("github", { redirectTo: getAuthRedirectTo() });
  };
}

/**
 * Sign in with Apple
 * NOTE: OAuth for desktop apps requires additional setup (Phase 2).
 */
export function useSignInWithApple() {
  const { signIn } = useAuthActions();
  return () => {
    console.warn("[auth] Apple OAuth on desktop requires hosted redirect page (Phase 2)");
    return signIn("apple", { redirectTo: getAuthRedirectTo() });
  };
}

/**
 * Sign in with Google
 * NOTE: OAuth for desktop apps requires additional setup (Phase 2).
 */
export function useSignInWithGoogle() {
  const { signIn } = useAuthActions();
  return () => {
    console.warn("[auth] Google OAuth on desktop requires hosted redirect page (Phase 2)");
    return signIn("google", { redirectTo: getAuthRedirectTo() });
  };
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

/**
 * Setup deep link listener for OAuth callbacks
 */
export async function setupAuthDeepLinks(
  onAuthCallback?: (params: AuthCallbackParams) => void
): Promise<() => void> {
  try {
    const unlisten = await listen("deep-link://new-url", async (event) => {
      const url = event.payload as string;
      const params = parseAuthCallback(url);

      if (params && onAuthCallback) {
        onAuthCallback(params);
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
