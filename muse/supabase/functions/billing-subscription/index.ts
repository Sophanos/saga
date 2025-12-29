/**
 * Billing Subscription Edge Function
 *
 * POST /billing-subscription
 *
 * Fetches subscription and usage data for the authenticated user.
 * For unauthenticated users, returns free tier defaults.
 *
 * Request Body: (empty)
 *
 * Response:
 * {
 *   subscription: {
 *     tier: 'free' | 'pro' | 'pro_plus' | 'team';
 *     status: 'active' | 'trialing' | 'past_due' | 'canceled' | ...;
 *     currentPeriodEnd: string | null;
 *     cancelAtPeriodEnd: boolean;
 *   };
 *   usage: {
 *     tokensUsed: number;
 *     tokensIncluded: number;
 *     tokensRemaining: number;
 *     wordsWritten: number;
 *   };
 * }
 *
 * Environment Variables:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anon key for auth verification
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  ErrorCode,
} from "../_shared/errors.ts";

/**
 * Subscription tier types
 */
type BillingTier = "free" | "pro" | "pro_plus" | "team";

/**
 * Subscription status types
 */
type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/**
 * Billing context from the database function get_billing_context(p_user_id)
 */
interface BillingContextRow {
  subscription_id: string | null;
  tier: string;
  billing_mode: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  tokens_included: number;
  tokens_used: number;
  tokens_remaining: number;
  words_written: number;
  ai_chat_calls: number;
  ai_lint_calls: number;
  ai_coach_calls: number;
  ai_detect_calls: number;
  ai_search_calls: number;
  tier_name: string;
  ai_chat_enabled: boolean;
  ai_lint_enabled: boolean;
  ai_coach_enabled: boolean;
  ai_detect_enabled: boolean;
  ai_search_enabled: boolean;
  max_projects: number;
  is_over_limit: boolean;
}

/**
 * Subscription response structure
 */
interface Subscription {
  tier: BillingTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Usage response structure
 */
interface Usage {
  tokensUsed: number;
  tokensIncluded: number;
  tokensRemaining: number;
  wordsWritten: number;
}

/**
 * Combined response structure
 */
interface SubscriptionResponse {
  subscription: Subscription;
  usage: Usage;
}

/**
 * Default response for unauthenticated users (free tier)
 */
const FREE_TIER_DEFAULTS: SubscriptionResponse = {
  subscription: {
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  },
  usage: {
    tokensUsed: 0,
    tokensIncluded: 0,
    tokensRemaining: 0,
    wordsWritten: 0,
  },
};

/**
 * Map database tier to API tier
 */
function mapTier(tier: string): BillingTier {
  switch (tier?.toLowerCase()) {
    case "pro":
      return "pro";
    case "pro_plus":
    case "proplus":
      return "pro_plus";
    case "team":
      return "team";
    default:
      return "free";
  }
}

/**
 * Map database status to API status
 */
function mapStatus(status: string): SubscriptionStatus {
  const validStatuses: SubscriptionStatus[] = [
    "active",
    "trialing",
    "past_due",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "unpaid",
    "paused",
  ];

  const normalized = status?.toLowerCase() as SubscriptionStatus;
  return validStatuses.includes(normalized) ? normalized : "active";
}

/**
 * Get authenticated user from request
 */
async function getAuthenticatedUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return { user: null, supabase: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, supabase: null };
  }

  return { user, supabase };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.BAD_REQUEST,
      "Method not allowed. Use POST.",
      origin
    );
  }

  try {
    // Try to authenticate user
    const { user, supabase } = await getAuthenticatedUser(req);

    // Return free tier defaults for unauthenticated users
    if (!user || !supabase) {
      console.log("[billing-subscription] Unauthenticated user, returning free tier defaults");
      return createSuccessResponse(FREE_TIER_DEFAULTS, origin);
    }

    // Call the get_billing_context DB function
    const { data, error } = await supabase.rpc("get_billing_context", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("[billing-subscription] Error fetching billing context:", error);
      // Return free tier defaults on error
      return createSuccessResponse(FREE_TIER_DEFAULTS, origin);
    }

    // The RPC returns a single row or null
    const context = data as BillingContextRow | null;

    if (!context) {
      console.log("[billing-subscription] No billing context found, returning free tier defaults");
      return createSuccessResponse(FREE_TIER_DEFAULTS, origin);
    }

    // Map database response to API response
    const response: SubscriptionResponse = {
      subscription: {
        tier: mapTier(context.tier),
        status: mapStatus(context.status),
        currentPeriodEnd: context.period_end,
        cancelAtPeriodEnd: false, // This would come from Stripe subscription metadata
      },
      usage: {
        tokensUsed: context.tokens_used ?? 0,
        tokensIncluded: context.tokens_included ?? 0,
        tokensRemaining: context.tokens_remaining ?? 0,
        wordsWritten: context.words_written ?? 0,
      },
    };

    return createSuccessResponse(response, origin);
  } catch (error) {
    console.error("[billing-subscription] Error:", error);

    // Handle authentication errors gracefully
    if (error instanceof Error) {
      if (
        error.message.includes("authorization") ||
        error.message.includes("token") ||
        error.message.includes("Supabase")
      ) {
        // Return free tier defaults for auth errors
        return createSuccessResponse(FREE_TIER_DEFAULTS, origin);
      }
    }

    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to fetch subscription data",
      origin
    );
  }
});
