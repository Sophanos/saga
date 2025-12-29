/**
 * Anonymous Session Edge Function
 *
 * POST /anon-session
 *
 * Creates or refreshes an anonymous session token.
 * Returns the token and current trial quota status.
 *
 * Request Body:
 * {
 *   fingerprintHash?: string  // Optional coarse browser fingerprint hash
 * }
 *
 * Response:
 * {
 *   anonToken: string,
 *   deviceId: string,
 *   trial: { limit: number, used: number, remaining: number },
 *   isNew: boolean
 * }
 *
 * Headers (for refresh):
 *   x-anon-token: <existing-token>  // Optional, for token refresh
 */

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { handleCorsPreFlight, getCorsHeaders } from "../_shared/cors.ts";
import { createErrorResponse, ErrorCode, createSuccessResponse } from "../_shared/errors.ts";
import { createSupabaseClient } from "../_shared/billing.ts";
import {
  createAnonToken,
  verifyAnonToken,
  registerAnonSession,
  getTrialStatus,
  checkSessionCreateLimit,
  hashIpPrefix,
  AnonErrorCode,
} from "../_shared/anonymous.ts";

interface AnonSessionRequest {
  fingerprintHash?: string;
}

interface AnonSessionResponse {
  anonToken: string;
  deviceId: string;
  trial: {
    limit: number;
    used: number;
    remaining: number;
  };
  isNew: boolean;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreFlight(req);
  }

  // Only accept POST
  if (req.method !== "POST") {
    return createErrorResponse(
      ErrorCode.BAD_REQUEST,
      "Method not allowed. Use POST.",
      origin
    );
  }

  const supabase = createSupabaseClient();

  try {
    // Check for existing token (refresh flow)
    const existingToken = req.headers.get("x-anon-token");
    if (existingToken) {
      const payload = await verifyAnonToken(existingToken);
      if (payload) {
        // Token is valid, get current status and issue fresh token
        const status = await getTrialStatus(supabase, payload.sub);
        if (status) {
          const newToken = await createAnonToken(payload.sub, payload.fp);
          const response: AnonSessionResponse = {
            anonToken: newToken,
            deviceId: payload.sub,
            trial: {
              limit: status.limit,
              used: status.used,
              remaining: status.remaining,
            },
            isNew: false,
          };
          return createSuccessResponse(response, origin);
        }
        // Status not found, fall through to create new session
      }
    }

    // Rate limit new session creation
    const rateLimit = await checkSessionCreateLimit(supabase, req);
    if (!rateLimit.allowed) {
      console.warn("[anon-session] Rate limit exceeded for session creation");
      return createErrorResponse(
        ErrorCode.RATE_LIMITED,
        "Too many session requests. Please try again later.",
        origin,
        {
          code: AnonErrorCode.RATE_LIMITED,
          retryAfter: Math.ceil((rateLimit.resetsAt.getTime() - Date.now()) / 1000),
        }
      );
    }

    // Parse request body
    let body: AnonSessionRequest = {};
    try {
      const rawBody = await req.text();
      if (rawBody) {
        body = JSON.parse(rawBody);
      }
    } catch {
      // Empty body is OK
    }

    // Register new device session
    const session = await registerAnonSession(
      supabase,
      req,
      body.fingerprintHash
    );

    // Create token
    const token = await createAnonToken(
      session.deviceId,
      body.fingerprintHash
    );

    const response: AnonSessionResponse = {
      anonToken: token,
      deviceId: session.deviceId,
      trial: session.trial,
      isNew: session.isNew,
    };

    console.log(
      `[anon-session] ${session.isNew ? "Created" : "Reused"} session:`,
      session.deviceId.substring(0, 8),
      `remaining: ${session.trial.remaining}`
    );

    return createSuccessResponse(response, origin);
  } catch (error) {
    console.error("[anon-session] Error:", error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      "Failed to create anonymous session",
      origin
    );
  }
});
