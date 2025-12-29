/**
 * Stripe Checkout Edge Function
 *
 * POST /stripe-checkout
 *
 * Creates a Stripe Checkout session for subscription purchases.
 * Requires an authenticated user.
 *
 * Request Body:
 * {
 *   tier: "pro" | "pro_plus" | "team",     // Subscription tier
 *   billingInterval: "monthly" | "annual"  // Billing frequency
 * }
 *
 * Response:
 * {
 *   url: string  // Stripe Checkout session URL
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
  validateRequestBody,
} from "../_shared/errors.ts";
import { getAuthenticatedUser, AuthenticatedUser } from "../_shared/auth.ts";

// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

/**
 * Price IDs for each tier and billing mode
 * These should be configured in Stripe Dashboard and stored in env vars
 */
const PRICE_IDS: Record<string, Record<string, string>> = {
  pro: {
    monthly: Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") ?? "",
    annual: Deno.env.get("STRIPE_PRICE_PRO_ANNUAL") ?? "",
  },
  pro_plus: {
    monthly: Deno.env.get("STRIPE_PRICE_PRO_PLUS_MONTHLY") ?? "",
    annual: Deno.env.get("STRIPE_PRICE_PRO_PLUS_ANNUAL") ?? "",
  },
  team: {
    monthly: Deno.env.get("STRIPE_PRICE_TEAM_MONTHLY") ?? "",
    annual: Deno.env.get("STRIPE_PRICE_TEAM_ANNUAL") ?? "",
  },
};

/**
 * Checkout request interface
 */
interface CheckoutRequest {
  tier: "pro" | "pro_plus" | "team";
  billingInterval: "monthly" | "annual";
}

/**
 * Get or create Stripe customer for user
 */
async function getOrCreateCustomer(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  email: string
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  // Create a new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  // Update the profile with the Stripe customer ID
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    console.error("Error updating profile with Stripe customer ID:", updateError);
    // Continue anyway - the customer was created
  }

  return customer.id;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader ?? "" },
      },
    });

    // Authenticate user
    const user = await getAuthenticatedUser(supabase, authHeader);

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(
        ErrorCode.BAD_REQUEST,
        "Invalid JSON in request body",
        origin
      );
    }

    // Validate required fields
    const validation = validateRequestBody(body, ["tier", "billingInterval"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as CheckoutRequest;

    // Validate tier
    if (!["pro", "pro_plus", "team"].includes(request.tier)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid tier. Must be 'pro', 'pro_plus', or 'team'.",
        origin
      );
    }

    // Validate billing interval
    if (!["monthly", "annual"].includes(request.billingInterval)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid billingInterval. Must be 'monthly' or 'annual'.",
        origin
      );
    }

    // Get the price ID
    const priceId = PRICE_IDS[request.tier]?.[request.billingInterval];

    if (!priceId) {
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Price not configured for this tier and billing interval",
        origin
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateCustomer(
      supabase,
      user.id,
      user.email ?? ""
    );

    // Get the app URL for redirects
    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/settings/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/settings/subscription?canceled=true`,
      subscription_data: {
        metadata: {
          tier: request.tier,
          billing_interval: request.billingInterval,
          user_id: user.id,
        },
      },
      metadata: {
        user_id: user.id,
        tier: request.tier,
        billing_interval: request.billingInterval,
      },
    });

    if (!session.url) {
      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Failed to create checkout session",
        origin
      );
    }

    return createSuccessResponse({ url: session.url }, origin);
  } catch (error) {
    console.error("[stripe-checkout] Error:", error);

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
      "Failed to create checkout session",
      origin
    );
  }
});
