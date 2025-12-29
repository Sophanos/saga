/**
 * API Key Extraction Helper for BYOK (Bring Your Own Key) Support
 *
 * Extracts API key from request header or falls back to environment variable.
 * This allows users to provide their own OpenRouter API key while
 * still supporting a default key for users without their own.
 */

/**
 * API Key sources in order of priority
 */
export type ApiKeySource = "header" | "environment" | "none";

export interface ApiKeyResult {
  key: string | null;
  source: ApiKeySource;
}

/**
 * Extract OpenRouter API key from request or environment
 *
 * Priority:
 * 1. x-openrouter-key header (BYOK)
 * 2. OPENROUTER_API_KEY environment variable
 *
 * @param request - The incoming request
 * @returns The API key and its source
 */
export function extractApiKey(request: Request): ApiKeyResult {
  // Check for BYOK header first
  const headerKey = request.headers.get("x-openrouter-key");
  if (headerKey && headerKey.trim().length > 0) {
    return {
      key: headerKey.trim(),
      source: "header",
    };
  }

  // Fall back to environment variable
  const envKey = Deno.env.get("OPENROUTER_API_KEY");
  if (envKey && envKey.trim().length > 0) {
    return {
      key: envKey.trim(),
      source: "environment",
    };
  }

  // No API key available
  return {
    key: null,
    source: "none",
  };
}

/**
 * Validate that an API key is available
 * Throws a descriptive error if not
 */
export function requireApiKey(request: Request): string {
  const result = extractApiKey(request);

  if (!result.key) {
    throw new Error(
      "No API key provided. Either set the OPENROUTER_API_KEY environment variable or provide a key via the x-openrouter-key header."
    );
  }

  return result.key;
}

/**
 * Extract Gemini API key from request or environment
 * For fallback support when OpenRouter is unavailable
 */
/**
 * Result of billing-aware API key extraction
 */
export interface ApiKeyWithBillingResult extends ApiKeyResult {
  /** Whether this is using the managed billing system */
  isManaged: boolean;
  /** User ID if authenticated (for usage tracking) */
  userId: string | null;
}

/**
 * Extract API key with billing system integration
 *
 * This is a convenience wrapper that combines BYOK extraction with
 * billing system awareness. Use checkBillingAndGetKey from billing.ts
 * for full billing context (including quota checks).
 *
 * Priority:
 * 1. x-openrouter-key header (BYOK - not managed)
 * 2. OPENROUTER_API_KEY environment variable (managed)
 *
 * @param request - The incoming request
 * @param userId - Optional authenticated user ID for tracking
 * @returns The API key, source, and billing info
 */
export function extractApiKeyWithBilling(
  request: Request,
  userId: string | null = null
): ApiKeyWithBillingResult {
  // Check for BYOK header first
  const headerKey = request.headers.get("x-openrouter-key");
  if (headerKey && headerKey.trim().length > 0) {
    return {
      key: headerKey.trim(),
      source: "header",
      isManaged: false,
      userId,
    };
  }

  // Fall back to environment variable (managed billing)
  const envKey = Deno.env.get("OPENROUTER_API_KEY");
  if (envKey && envKey.trim().length > 0) {
    return {
      key: envKey.trim(),
      source: "environment",
      isManaged: true,
      userId,
    };
  }

  // No API key available
  return {
    key: null,
    source: "none",
    isManaged: false,
    userId,
  };
}

export function extractGeminiKey(request: Request): ApiKeyResult {
  // Check for BYOK header
  const headerKey = request.headers.get("x-gemini-key");
  if (headerKey && headerKey.trim().length > 0) {
    return {
      key: headerKey.trim(),
      source: "header",
    };
  }

  // Fall back to environment variable
  const envKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
  if (envKey && envKey.trim().length > 0) {
    return {
      key: envKey.trim(),
      source: "environment",
    };
  }

  return {
    key: null,
    source: "none",
  };
}
