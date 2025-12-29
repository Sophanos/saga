/**
 * Billing Mode Edge Function
 *
 * POST /billing-mode
 *
 * Switches a user's billing mode between 'managed' and 'byok'.
 * Requires an authenticated user.
 *
 * Request Body:
 * {
 *   mode: "managed" | "byok",  // Target billing mode
 *   byokKey?: string           // Optional API key for BYOK validation
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   billingMode: "managed" | "byok"
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
  validateRequestBody,
} from "../_shared/errors.ts";
import type { BillingMode } from "../_shared/billing.ts";
import { getAuthenticatedUser, AuthenticatedUser } from "../_shared/auth.ts";

/**
 * Billing mode request interface
 */
interface BillingModeRequest {
  mode: BillingMode;
  byokKey?: string;
}

/**
 * Billing mode response interface
 */
interface BillingModeResponse {
  success: boolean;
  billingMode: BillingMode;
}

/**
 * Valid billing modes
 */
const VALID_BILLING_MODES: BillingMode[] = ["managed", "byok"];

/**
 * BYOK API key prefix for validation (OpenRouter format)
 */
const BYOK_KEY_PREFIX = "sk-or-";

/**
 * Validate BYOK API key format
 * Returns true if the key has a valid format, false otherwise
 */
function isValidByokKeyFormat(key: string): boolean {
  if (!key || typeof key !== "string") {
    return false;
  }

  const trimmedKey = key.trim();

  // Check if key is non-empty and starts with the expected prefix
  if (trimmedKey.length === 0) {
    return false;
  }

  // Optional: Check for OpenRouter key prefix
  // Keys should start with 'sk-or-' for OpenRouter
  if (!trimmedKey.startsWith(BYOK_KEY_PREFIX)) {
    return false;
  }

  // Ensure key has reasonable length after prefix
  const keyBody = trimmedKey.substring(BYOK_KEY_PREFIX.length);
  if (keyBody.length < 10) {
    return false;
  }

  return true;
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
    const validation = validateRequestBody(body, ["mode"]);
    if (!validation.valid) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `Missing required fields: ${validation.missing.join(", ")}`,
        origin
      );
    }

    const request = validation.data as unknown as BillingModeRequest;

    // Validate billing mode value
    if (!VALID_BILLING_MODES.includes(request.mode)) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "Invalid mode. Must be 'managed' or 'byok'.",
        origin
      );
    }

    // For BYOK mode, validate the API key format if provided
    if (request.mode === "byok" && request.byokKey) {
      if (!isValidByokKeyFormat(request.byokKey)) {
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          `Invalid API key format. Key must start with '${BYOK_KEY_PREFIX}' and be sufficiently long.`,
          origin
        );
      }
    }

    // Update the user's subscription billing_mode
    const { data: subscription, error: updateError } = await supabase
      .from("subscriptions")
      .update({ billing_mode: request.mode })
      .eq("user_id", user.id)
      .select("billing_mode")
      .single();

    if (updateError) {
      console.error("[billing-mode] Update error:", updateError);

      // Check if subscription doesn't exist
      if (updateError.code === "PGRST116") {
        // No rows returned - user doesn't have a subscription yet
        // Try to create one
        const { data: newSub, error: insertError } = await supabase
          .from("subscriptions")
          .insert({
            user_id: user.id,
            tier: "free",
            billing_mode: request.mode,
            status: "active",
          })
          .select("billing_mode")
          .single();

        if (insertError) {
          console.error("[billing-mode] Insert error:", insertError);
          return createErrorResponse(
            ErrorCode.INTERNAL_ERROR,
            "Failed to create subscription",
            origin
          );
        }

        const response: BillingModeResponse = {
          success: true,
          billingMode: newSub.billing_mode as BillingMode,
        };

        return createSuccessResponse(response, origin);
      }

      return createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        "Failed to update billing mode",
        origin
      );
    }

    const response: BillingModeResponse = {
      success: true,
      billingMode: subscription.billing_mode as BillingMode,
    };

    return createSuccessResponse(response, origin);
  } catch (error) {
    console.error("[billing-mode] Error:", error);

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

    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to switch billing mode",
      origin
    );
  }
});
