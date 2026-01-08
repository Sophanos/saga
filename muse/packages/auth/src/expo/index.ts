/**
 * Expo Auth Client
 *
 * Better Auth client configured for Expo (React Native).
 * Uses SecureStore for token storage and deep links for OAuth.
 */

import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { expoClient } from "@better-auth/expo/client";
import { getAuthConfig, getPlatform } from "../config";

// These are imported dynamically to avoid issues on non-Expo platforms
let Constants: any;
let SecureStore: any;

/**
 * Initialize Expo-specific imports
 */
async function initExpoModules() {
  if (!Constants) {
    Constants = (await import("expo-constants")).default;
  }
  if (!SecureStore) {
    SecureStore = await import("expo-secure-store");
  }
}

/**
 * Create Expo auth client
 */
export async function createExpoAuthClient() {
  await initExpoModules();

  const config = getAuthConfig();
  const scheme = Constants?.expoConfig?.scheme || config.scheme;

  return createAuthClient({
    baseURL: config.convexSiteUrl,
    plugins: [
      expoClient({
        scheme,
        storagePrefix: scheme,
        storage: SecureStore,
      }),
      convexClient(),
    ],
  });
}

/**
 * Singleton Expo auth client
 */
let _expoAuthClient: Awaited<ReturnType<typeof createExpoAuthClient>> | null = null;

export async function getExpoAuthClient() {
  if (!_expoAuthClient) {
    _expoAuthClient = await createExpoAuthClient();
  }
  return _expoAuthClient;
}

/**
 * Sign in with email/password (Expo)
 */
export async function signInWithEmail(email: string, password: string) {
  const client = await getExpoAuthClient();
  return client.signIn.email({ email, password });
}

/**
 * Sign up with email/password (Expo)
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
) {
  const client = await getExpoAuthClient();
  return client.signUp.email({ email, password, name: name || "" });
}

/**
 * Sign in with social provider (Expo)
 * Opens browser for OAuth flow, returns via deep link
 */
export async function signInWithSocial(
  provider: "apple" | "google",
  callbackPath: string = "/auth/callback"
) {
  const client = await getExpoAuthClient();
  const config = getAuthConfig();

  // Construct the callback URL with deep link scheme
  const callbackURL = `${config.scheme}://${callbackPath}`;

  return client.signIn.social({
    provider,
    callbackURL,
  });
}

/**
 * Sign out (Expo)
 */
export async function signOut() {
  const client = await getExpoAuthClient();
  return client.signOut();
}

/**
 * Get current session (Expo)
 */
export async function getSession() {
  const client = await getExpoAuthClient();
  return client.getSession();
}

/**
 * Hook to use session in Expo components
 */
export function useExpoSession() {
  // This will be used with React Query or the Better Auth hook
  // The actual implementation depends on the Better Auth version
  return {
    useSession: async () => {
      const client = await getExpoAuthClient();
      return client.useSession();
    },
  };
}
