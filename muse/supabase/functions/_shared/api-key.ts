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
