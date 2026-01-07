/**
 * HTTP Auth Utilities for Convex HTTP Actions
 *
 * Validates Supabase JWT tokens passed in Authorization header.
 * Works with both authenticated users and anonymous trial users.
 */

import type { ActionCtx } from "../_generated/server";

export interface AuthResult {
  isValid: boolean;
  userId?: string;
  error?: string;
  /** Anonymous device ID for trial users */
  anonDeviceId?: string;
  /** API key for AI providers (from header or user profile) */
  apiKey?: string;
}

/**
 * Validate authentication from HTTP request
 *
 * Supports:
 * - Supabase JWT in Authorization: Bearer <token>
 * - Anonymous trial via x-anon-device-id header
 * - Custom OpenRouter key via x-openrouter-key header
 */
export async function validateAuth(
  ctx: ActionCtx,
  request: Request
): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");
  const anonDeviceId = request.headers.get("x-anon-device-id");
  const customApiKey = request.headers.get("x-openrouter-key");

  // Try to get user identity from Convex auth (uses JWT from header)
  try {
    const identity = await ctx.auth.getUserIdentity();

    if (identity) {
      return {
        isValid: true,
        userId: identity.subject,
        apiKey: customApiKey ?? process.env.OPENROUTER_API_KEY,
      };
    }
  } catch (error) {
    // Auth failed, continue to check anonymous
    console.warn("[httpAuth] Auth check failed:", error);
  }

  // Allow anonymous trial if device ID provided
  if (anonDeviceId) {
    return {
      isValid: true,
      anonDeviceId,
      apiKey: process.env.OPENROUTER_API_KEY, // Use managed key for anonymous
    };
  }

  // No valid auth
  return {
    isValid: false,
    error: "Authentication required. Provide Authorization header or x-anon-device-id.",
  };
}

/**
 * Get the effective owner ID for data isolation
 * Returns userId if authenticated, or anonDeviceId for trial users
 */
export function getOwnerId(auth: AuthResult): string | null {
  return auth.userId ?? auth.anonDeviceId ?? null;
}

/**
 * Check if the auth result represents an authenticated (non-anonymous) user
 */
export function isAuthenticated(auth: AuthResult): boolean {
  return auth.isValid && !!auth.userId;
}

/**
 * Check if the auth result represents an anonymous trial user
 */
export function isAnonymousTrial(auth: AuthResult): boolean {
  return auth.isValid && !auth.userId && !!auth.anonDeviceId;
}
