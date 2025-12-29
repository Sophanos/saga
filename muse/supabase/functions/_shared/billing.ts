/**
 * Billing Helper for Supabase Edge Functions
 *
 * Handles billing context retrieval and token usage recording
 * for BYOK (Bring Your Own Key) and managed billing modes.
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createErrorResponse, ErrorCode } from "./errors.ts";

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

    // Anonymous users cannot use managed billing - require auth or BYOK
    return {
      canProceed: false,
      billingMode: "managed",
      apiKey: null,
      tokensRemaining: null,
      userId: null,
      error: "Authentication required for AI features. Please sign in or provide your own API key.",
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
 * Check billing and return error response if not allowed
 */
export async function requireBilling(
  req: Request,
  supabase: SupabaseClient,
  origin: string | null
): Promise<{ billing: BillingCheck } | { error: Response }> {
  const billing = await checkBillingAndGetKey(req, supabase);
  if (!billing.canProceed) {
    return {
      error: createErrorResponse(
        ErrorCode.FORBIDDEN,
        billing.error ?? "Unable to process request",
        origin
      )
    };
  }
  return { billing };
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

// ============================================================================
// Usage Tracking
// ============================================================================

/**
 * Result of recording an AI request
 */
export interface RecordResult {
  /** Whether the recording was successful */
  success: boolean;
  /** The log ID if successful */
  logId: string | null;
  /** Error message if failed */
  error?: string;
}

/**
 * Token usage from AI provider response
 */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Extract token usage from Vercel AI SDK result
 */
export function extractTokenUsage(
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
): TokenUsage {
  return {
    promptTokens: usage?.promptTokens ?? 0,
    completionTokens: usage?.completionTokens ?? 0,
    totalTokens: usage?.totalTokens ?? (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0),
  };
}

/**
 * AI endpoint types
 */
export type AIEndpoint = "chat" | "lint" | "coach" | "detect" | "dynamics" | "search" | "agent" | "genesis" | "embed";

/**
 * Record AI request (detailed log + aggregate update)
 * Tracks BOTH managed AND byok for analytics
 */
export async function recordAIRequest(
  supabase: SupabaseClient,
  billing: BillingCheck,
  params: {
    endpoint: AIEndpoint;
    model: string;
    modelType?: string;
    usage: TokenUsage;
    latencyMs?: number;
    success?: boolean;
    errorCode?: string;
    errorMessage?: string;
    projectId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<RecordResult> {
  if (!billing.userId) {
    // Skip logging for anonymous users
    return {
      success: true,
      logId: null,
    };
  }

  try {
    const { data, error } = await supabase.rpc("record_ai_request", {
      p_user_id: billing.userId,
      p_endpoint: params.endpoint,
      p_model: params.model,
      p_model_type: params.modelType ?? null,
      p_prompt_tokens: params.usage.promptTokens,
      p_completion_tokens: params.usage.completionTokens,
      p_total_tokens: params.usage.totalTokens,
      p_latency_ms: params.latencyMs ?? null,
      p_billing_mode: billing.billingMode,
      p_success: params.success ?? true,
      p_error_code: params.errorCode ?? null,
      p_error_message: params.errorMessage ?? null,
      p_project_id: params.projectId ?? null,
      p_request_id: params.requestId ?? null,
      p_metadata: params.metadata ?? {},
    });

    if (error) {
      console.error("[billing] Failed to record AI request:", error);
      return {
        success: false,
        logId: null,
        error: `Failed to record AI request: ${error.message}`,
      };
    }

    return {
      success: true,
      logId: data as string,
    };
  } catch (error) {
    console.error("[billing] Unexpected error recording AI request:", error);
    return {
      success: false,
      logId: null,
      error: `Unexpected error recording AI request: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
