/**
 * Better Auth Client
 *
 * Base client configuration used by all platforms.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";
import { getAuthConfig } from "../config";

export type AuthClient = ReturnType<typeof createBaseAuthClient>;

/**
 * Create base auth client (for web/Tauri)
 */
export function createBaseAuthClient() {
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
 * Auth client instance
 * Initialize with initAuthConfig() before using
 */
let _authClient: AuthClient | null = null;

export function getAuthClient(): AuthClient {
  if (!_authClient) {
    _authClient = createBaseAuthClient();
  }
  return _authClient;
}

/**
 * Reset auth client (useful for testing or logout)
 */
export function resetAuthClient(): void {
  _authClient = null;
}

// Re-export types
export type { Session, User } from "better-auth/types";
