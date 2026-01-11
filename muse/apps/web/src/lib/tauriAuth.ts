/**
 * Tauri Auth Adapter
 *
 * Handles OAuth in Tauri context (deep links + system browser).
 * Only imported when running in Tauri.
 */

// Type declarations for Tauri APIs (dynamically imported at runtime)
// These modules only exist in Tauri builds
interface TauriShell {
  open(url: string): Promise<void>;
}
interface TauriEvent {
  listen<T>(
    event: string,
    handler: (event: { payload: T }) => void | Promise<void>
  ): Promise<() => void>;
}

const SCHEME = "mythos";

/**
 * Check if running in Tauri
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Open URL in system browser (Tauri only)
 */
export async function openInBrowser(url: string): Promise<void> {
  if (!isTauri()) return;
  // @ts-expect-error - Tauri module only exists in Tauri builds
  const mod = await import("@tauri-apps/plugin-shell") as TauriShell;
  await mod.open(url);
}

/**
 * Get OAuth callback URL for current platform
 */
export function getOAuthCallbackUrl(): string {
  if (isTauri()) {
    return `${SCHEME}://auth/callback`;
  }
  return `${window.location.origin}/auth/callback`;
}

/**
 * Handle auth callback from deep link
 */
export async function handleAuthCallback(
  url: string,
  refreshSession: () => Promise<unknown>
): Promise<boolean> {
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname === "/auth/callback") {
      await refreshSession();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Setup deep link listener for OAuth callbacks (Tauri only)
 */
export async function setupAuthDeepLinks(
  refreshSession: () => Promise<unknown>,
  onAuthComplete?: () => void
): Promise<() => void> {
  if (!isTauri()) {
    return () => {};
  }

  try {
    // @ts-expect-error - Tauri module only exists in Tauri builds
    const mod = await import("@tauri-apps/api/event") as TauriEvent;
    const unlisten = await mod.listen<string>("deep-link://new-url", async (event) => {
      const url = event.payload;
      const handled = await handleAuthCallback(url, refreshSession);
      if (handled && onAuthComplete) {
        onAuthComplete();
      }
    });
    return unlisten;
  } catch (error) {
    console.error("[tauriAuth] Failed to setup deep link listener:", error);
    return () => {};
  }
}
