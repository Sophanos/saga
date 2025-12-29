/**
 * Stripe Customer Portal Edge Function
 *
 * POST /stripe-portal
 *
 * Creates a Stripe Customer Portal session for subscription management.
 * Requires an authenticated user with an existing Stripe customer ID.
 *
 * Request Body: (empty or optional)
 * {
 *   returnUrl?: string  // Optional custom return URL
 * }
 *
 * Response:
 * {
 *   url: string  // Stripe Customer Portal session URL
 * }
 *
 * Environment Variables:
 * - STRIPE_SECRET_KEY: Stripe API secret key
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_ANON_KEY: Supabase anon key for auth verification
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";
import { handleCorsPreFlight } from "../_shared/cors.ts";
import {
  createErrorResponse,
  createSuccessResponse,
  ErrorCode,
} from "../_shared/errors.ts";

// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

/**
 * Portal request interface
 */
interface PortalRequest {
  returnUrl?: string;
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
    throw new Error("No authorization header");
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
    throw new Error("Invalid or expired token");
  }

  return { user, supabase };
}

/**
 * Get Stripe customer ID for user
 */
async function getCustomerId(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return profile?.stripe_customer_id ?? null;
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
    // Authenticate user
    const { user, supabase } = await getAuthenticatedUser(req);

    // Parse request body (optional)
    let request: PortalRequest = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        request = JSON.parse(text) as PortalRequest;
      }
    } catch {
      // Ignore parse errors - body is optional
    }

    // Get the user's Stripe customer ID
    const customerId = await getCustomerId(supabase, user.id);

    if (!customerId) {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        "No subscription found. Please subscribe first.",
        origin
      );
    }

    // Get the app URL for return
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";
    const returnUrl = request.returnUrl ?? `${appUrl}/settings/subscription`;

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return createSuccessResponse({ url: session.url }, origin);
  } catch (error) {
    console.error("[stripe-portal] Error:", error);

    // Handle authentication errors
    if (error instanceof Error) {
      if (
        error.message.includes("authorization") ||
        error.message.includes("token")
      ) {
        return createErrorResponse(
          ErrorCode.UNAUTHORIZED,
          error.message,
          origin
        );
      }
    }

    // Handle Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        error.message,
        origin
      );
    }

    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to create portal session",
      origin
    );
  }
});
