/**
 * Expo Auth Client
 *
 * Convex Auth configured for Expo (React Native).
 * Uses SecureStore for token storage.
 */

// Re-export Convex Auth hooks
export { useAuthActions, useAuthToken } from "@convex-dev/auth/react";
export { useConvexAuth, Authenticated, Unauthenticated, AuthLoading } from "convex/react";

/**
 * Create SecureStore storage adapter for Convex Auth
 * Use this with ConvexAuthProvider's storage prop
 */
export async function createSecureStorage() {
  const SecureStore = await import("expo-secure-store");

  return {
    getItem: (key: string) => SecureStore.getItemAsync(key),
    setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

/**
 * Sign in helpers for Expo
 * These wrap useAuthActions for convenience
 */
export type AuthProvider = "github" | "google" | "apple" | "resend";

/**
 * Create a sign-in handler for OAuth providers
 */
export function createOAuthSignIn(
  signIn: (provider: string) => Promise<{ redirect?: URL }>,
  provider: AuthProvider
) {
  return async () => {
    const result = await signIn(provider);
    // For native, the redirect is handled automatically
    // The ConvexAuthProvider manages the OAuth flow
    return result;
  };
}

/**
 * Create a sign-in handler for magic link
 */
export function createMagicLinkSignIn(
  signIn: (provider: string, data: FormData) => Promise<void>
) {
  return async (email: string) => {
    const formData = new FormData();
    formData.append("email", email);
    await signIn("resend", formData);
  };
}
