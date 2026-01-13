/**
 * Tauri Auth Adapter
 *
 * Handles OAuth in Tauri context (deep links + system browser).
 * Uses window.__TAURI__ directly to avoid import resolution issues.
 */

const SCHEME = "rhei";

// Type for Tauri's global object
declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
      event: {
        listen: <T>(
          event: string,
          handler: (event: { payload: T }) => void
        ) => Promise<() => void>;
      };
    };
    __TAURI_INTERNALS__?: unknown;
  }
}

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
  if (!isTauri() || !window.__TAURI__) return;
  try {
    // Use Tauri's shell plugin via invoke
    await window.__TAURI__.core.invoke("plugin:shell|open", {
      path: url,
    });
  } catch (err) {
    console.error("[tauriAuth] Failed to open browser:", err);
  }
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
 * Listen for deep link events (Tauri only)
 */
export async function listenForDeepLinks(
  callback: (url: string) => void
): Promise<() => void> {
  if (!isTauri() || !window.__TAURI__) {
    return () => {};
  }

  try {
    const unlisten = await window.__TAURI__.event.listen<string>(
      "deep-link://new-url",
      (event) => {
        callback(event.payload);
      }
    );
    return unlisten;
  } catch (err) {
    console.error("[tauriAuth] Failed to setup deep link listener:", err);
    return () => {};
  }
}
