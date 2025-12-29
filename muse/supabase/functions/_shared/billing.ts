/**
 * Billing Helper for Supabase Edge Functions
 *
 * Handles billing context retrieval and token usage recording
 * for BYOK (Bring Your Own Key) and managed billing modes.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

/**
 * Billing modes
 */
export type BillingMode = "byok" | "managed";

/**
 * Result of billing check
 */
export interface BillingCheck {
  /** Whether the request can proceed */
  canProceed: boolean;
  /** The billing mode for this user */
  billingMode: BillingMode;
  /** The API key to use (from header for BYOK, from env for managed) */
  apiKey: string | null;
  /** Remaining tokens for managed billing (null for BYOK) */
  tokensRemaining: number | null;
  /** The authenticated user's ID */
  userId: string | null;
  /** Error message if canProceed is false */
  error?: string;
}

/**
 * Billing context from the database
 */
interface BillingContext {
  billing_mode: BillingMode;
  tokens_remaining: number | null;
  quota_limit: number | null;
  subscription_tier: string | null;
}

/**
 * Get user ID from the authorization header
 */
async function getUserFromAuth(
  request: Request,
  supabase: SupabaseClient
): Promise<string | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  // Extract token from "Bearer <token>" format
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      console.error("[billing] Auth error:", error?.message);
      return null;
    }
    return data.user.id;
  } catch (error) {
    console.error("[billing] Failed to get user:", error);
    return null;
  }
}

/**
 * Check billing context and get appropriate API key
 *
 * This function:
 * 1. Authenticates the user from the request
 * 2. Calls get_billing_context DB function to determine billing mode
 * 3. For BYOK: extracts key from x-openrouter-key header
 * 4. For Managed: uses OPENROUTER_API_KEY env var and checks quota
 *
 * @param request - The incoming request
 * @param supabase - Supabase client instance
 * @returns BillingCheck with apiKey and authorization status
 */
export async function checkBillingAndGetKey(
  request: Request,
  supabase: SupabaseClient
): Promise<BillingCheck> {
  // Get user from auth header
  const userId = await getUserFromAuth(request, supabase);

  if (!userId) {
    // Anonymous user - check for BYOK header
    const headerKey = request.headers.get("x-openrouter-key");
    if (headerKey && headerKey.trim().length > 0) {
      return {
        canProceed: true,
        billingMode: "byok",
        apiKey: headerKey.trim(),
        tokensRemaining: null,
        userId: null,
      };
    }

    // Fall back to environment key for anonymous users
    const envKey = Deno.env.get("OPENROUTER_API_KEY");
    if (envKey && envKey.trim().length > 0) {
      return {
        canProceed: true,
        billingMode: "managed",
        apiKey: envKey.trim(),
        tokensRemaining: null,
        userId: null,
      };
    }

    return {
      canProceed: false,
      billingMode: "byok",
      apiKey: null,
      tokensRemaining: null,
      userId: null,
      error: "No API key provided. Please sign in or provide your own API key.",
    };
  }

  // Get billing context from database
  try {
    const { data, error } = await supabase.rpc("get_billing_context", {
      p_user_id: userId,
    });

    if (error) {
      console.error("[billing] Failed to get billing context:", error);
      // Fall back to BYOK check
      const headerKey = request.headers.get("x-openrouter-key");
      if (headerKey && headerKey.trim().length > 0) {
        return {
          canProceed: true,
          billingMode: "byok",
          apiKey: headerKey.trim(),
          tokensRemaining: null,
          userId,
        };
      }
      return {
        canProceed: false,
        billingMode: "byok",
        apiKey: null,
        tokensRemaining: null,
        userId,
        error: "Failed to verify billing status. Please provide your own API key.",
      };
    }

    const context = data as BillingContext;

    if (context.billing_mode === "byok") {
      // BYOK mode - extract key from header
      const headerKey = request.headers.get("x-openrouter-key");
      if (!headerKey || headerKey.trim().length === 0) {
        return {
          canProceed: false,
          billingMode: "byok",
          apiKey: null,
          tokensRemaining: null,
          userId,
          error: "BYOK mode requires an API key in the x-openrouter-key header.",
        };
      }

      return {
        canProceed: true,
        billingMode: "byok",
        apiKey: headerKey.trim(),
        tokensRemaining: null,
        userId,
      };
    }

    // Managed mode - use environment key and check quota
    const envKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!envKey || envKey.trim().length === 0) {
      return {
        canProceed: false,
        billingMode: "managed",
        apiKey: null,
        tokensRemaining: context.tokens_remaining,
        userId,
        error: "Managed billing is not configured. Please contact support.",
      };
    }

    // Check if user has remaining quota
    if (context.tokens_remaining !== null && context.tokens_remaining <= 0) {
      return {
        canProceed: false,
        billingMode: "managed",
        apiKey: null,
        tokensRemaining: 0,
        userId,
        error: "Token quota exceeded. Please upgrade your plan or provide your own API key.",
      };
    }

    return {
      canProceed: true,
      billingMode: "managed",
      apiKey: envKey.trim(),
      tokensRemaining: context.tokens_remaining,
      userId,
    };
  } catch (error) {
    console.error("[billing] Unexpected error:", error);
    // Fall back to BYOK check
    const headerKey = request.headers.get("x-openrouter-key");
    if (headerKey && headerKey.trim().length > 0) {
      return {
        canProceed: true,
        billingMode: "byok",
        apiKey: headerKey.trim(),
        tokensRemaining: null,
        userId,
      };
    }
    return {
      canProceed: false,
      billingMode: "byok",
      apiKey: null,
      tokensRemaining: null,
      userId,
      error: "Failed to verify billing status.",
    };
  }
}

/**
 * Record token usage for managed billing
 *
 * Only records if billing mode is "managed". BYOK usage is not tracked.
 *
 * @param supabase - Supabase client instance
 * @param billing - The billing check result from checkBillingAndGetKey
 * @param tokensUsed - Number of tokens consumed
 * @param callType - Type of API call (e.g., "chat", "embed", "lint")
 * @returns True if usage was recorded (or skipped for BYOK), false on error
 */
export async function recordUsageIfManaged(
  supabase: SupabaseClient,
  billing: BillingCheck,
  tokensUsed: number,
  callType: string
): Promise<boolean> {
  // Only record for managed billing
  if (billing.billingMode !== "managed") {
    return true;
  }

  // Skip if no user ID (shouldn't happen for managed, but be safe)
  if (!billing.userId) {
    console.warn("[billing] Attempted to record usage without user ID");
    return true;
  }

  try {
    const { error } = await supabase.rpc("record_token_usage", {
      p_tokens: tokensUsed,
      p_call_type: callType,
      p_user_id: billing.userId,
    });

    if (error) {
      console.error("[billing] Failed to record token usage:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[billing] Unexpected error recording usage:", error);
    return false;
  }
}

/**
 * Create a Supabase client for edge functions
 *
 * Uses the service role key for server-side operations.
 */
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}
