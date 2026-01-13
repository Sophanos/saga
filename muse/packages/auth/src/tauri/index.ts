/**
 * Tauri Auth Client
 *
 * Convex Auth configured for Tauri (desktop).
 * Handles OAuth via system browser with deep link callbacks.
 */

// Re-export Convex Auth hooks
export { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
export { useConvexAuth, Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export type AuthProvider = "github" | "google" | "apple" | "resend";

/**
 * Sign in with OAuth provider in Tauri
 * Opens system browser for OAuth, handles callback via deep link
 */
export async function signInWithOAuth(
  signIn: (provider: string) => Promise<{ redirect?: URL }>,
  provider: AuthProvider
): Promise<void> {
  const result = await signIn(provider);

  // If there's a redirect URL, open it in the system browser
  if (result?.redirect) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(result.redirect.toString());
  }
}

/**
 * Sign in with magic link in Tauri
 */
export async function signInWithMagicLink(
  signIn: (provider: string, data: FormData) => Promise<void>,
  email: string
): Promise<void> {
  const formData = new FormData();
  formData.append("email", email);
  await signIn("resend", formData);
}

/**
 * Handle deep link callback from OAuth
 * Call this when receiving a deep link URL
 */
export function isAuthCallback(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.includes("/auth/callback") || urlObj.pathname.includes("/api/auth");
  } catch {
    return false;
  }
}

/**
 * Setup deep link listener for Tauri OAuth callbacks
 * Returns cleanup function
 */
export async function setupDeepLinkListener(
  onAuthCallback?: (url: string) => void
): Promise<() => void> {
  try {
    const { listen } = await import("@tauri-apps/api/event");

    const unlisten = await listen<string>("deep-link://new-url", (event) => {
      const url = event.payload;

      if (isAuthCallback(url) && onAuthCallback) {
        onAuthCallback(url);
      }
    });

    return unlisten;
  } catch (error) {
    console.error("[tauri/auth] Failed to setup deep link listener:", error);
    return () => {};
  }
}

/**
 * Create localStorage adapter for Tauri
 * Tauri webview has localStorage, but this provides a consistent interface
 */
export function createTauriStorage() {
  return {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
}
