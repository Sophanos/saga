/**
 * Tauri Auth Client
 *
 * Better Auth client configured for Tauri (desktop).
 * Uses crossDomainClient for webview auth.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { getAuthConfig } from "../config";

/**
 * Create Tauri auth client
 */
export function createTauriAuthClient() {
  const config = getAuthConfig();

  return createAuthClient({
    baseURL: config.convexSiteUrl,
    plugins: [
      convexClient(),
      crossDomainClient(),
    ],
  });
}

/**
 * Singleton Tauri auth client
 */
let _tauriAuthClient: ReturnType<typeof createTauriAuthClient> | null = null;

export function getTauriAuthClient() {
  if (!_tauriAuthClient) {
    _tauriAuthClient = createTauriAuthClient();
  }
  return _tauriAuthClient;
}

/**
 * Sign in with email/password (Tauri)
 */
export function signInWithEmail(email: string, password: string) {
  const client = getTauriAuthClient();
  return client.signIn.email({ email, password });
}

/**
 * Sign up with email/password (Tauri)
 */
export function signUpWithEmail(
  email: string,
  password: string,
  name?: string
) {
  const client = getTauriAuthClient();
  return client.signUp.email({ email, password, name: name || "" });
}

/**
 * Sign in with social provider (Tauri)
 * Opens system browser for OAuth flow
 */
export async function signInWithSocial(provider: "apple" | "google") {
  const client = getTauriAuthClient();
  const config = getAuthConfig();

  // For Tauri, we use the system browser and handle callback via deep link
  const result = await client.signIn.social({
    provider,
    callbackURL: `${config.scheme}://auth/callback`,
  });

  // Open the authorization URL in system browser
  if (result.data?.url) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(result.data.url);
  }

  return result;
}

/**
 * Sign out (Tauri)
 */
export function signOut() {
  const client = getTauriAuthClient();
  return client.signOut();
}

/**
 * Get current session (Tauri)
 */
export function getSession() {
  const client = getTauriAuthClient();
  return client.getSession();
}

/**
 * Handle deep link callback from OAuth
 */
export async function handleAuthCallback(url: string): Promise<boolean> {
  try {
    const urlObj = new URL(url);

    // Check if this is an auth callback
    if (urlObj.pathname === "/auth/callback") {
      // The Better Auth client handles the callback automatically
      // Just trigger a session refresh
      const client = getTauriAuthClient();
      await client.getSession();
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Setup deep link listener for Tauri
 */
export async function setupDeepLinkListener(
  onAuthComplete?: () => void
) {
  try {
    const { listen } = await import("@tauri-apps/api/event");

    const unlisten = await listen<string>("deep-link://new-url", async (event) => {
      const url = event.payload as string;
      const handled = await handleAuthCallback(url);

      if (handled && onAuthComplete) {
        onAuthComplete();
      }
    });

    return unlisten;
  } catch (error) {
    console.error("[tauri/auth] Failed to setup deep link listener:", error);
    return () => {};
  }
}
