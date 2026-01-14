/**
 * OpenRouter API Key Resolution
 *
 * Handles BYOK (Bring Your Own Key) vs managed key resolution.
 * BYOK users provide their own OpenRouter key via x-openrouter-key header.
 */

export type ApiKeyResolution = {
  apiKey: string;
  isByok: boolean;
};

/**
 * Resolves the OpenRouter API key to use.
 *
 * Priority:
 * 1. BYOK key (if provided) - user pays, unlimited interactive AI
 * 2. Platform key (env var) - managed quota applies
 *
 * @param byokKey - Optional BYOK key from x-openrouter-key header
 * @returns API key and whether it's BYOK
 * @throws Error if no key available
 */
export function resolveOpenRouterKey(byokKey?: string | null): ApiKeyResolution {
  // BYOK takes priority - user provides their own key
  if (byokKey && byokKey.length > 0) {
    return {
      apiKey: byokKey,
      isByok: true,
    };
  }

  // Fall back to platform key
  const platformKey = process.env["OPENROUTER_API_KEY"];
  if (!platformKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  return {
    apiKey: platformKey,
    isByok: false,
  };
}

/**
 * Checks if a BYOK key is provided.
 * Used to skip quota checks for BYOK users.
 */
export function isByokRequest(byokKey?: string | null): boolean {
  return Boolean(byokKey && byokKey.length > 0);
}
