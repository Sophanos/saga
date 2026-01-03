/**
 * Dynamic Provider Factory for Supabase Edge Functions
 *
 * Creates AI provider instances at runtime with provided API keys.
 * This is essential for BYOK support where each request may use a different key.
 *
 * DevTools Integration:
 * Set ENABLE_AI_DEVTOOLS=true to enable debugging middleware that logs:
 * - Request/response timing
 * - Token usage
 * - Model parameters
 * - Streaming chunks (optional)
 *
 * Note: The official @ai-sdk/devtools package is Node.js-only.
 * This module provides Edge-compatible logging middleware instead.
 */

// Deno imports for ai-sdk v6
import { createOpenAI } from "./deps/ai-providers.ts";
import { createGoogleGenerativeAI } from "./deps/ai-providers.ts";
import { maybeWrapWithDevTools, type DevToolsConfig } from "./devtools.ts";

/**
 * Model type definitions matching the main application
 */
export type ModelType = "analysis" | "fast" | "thinking" | "creative" | "grammar";

/**
 * OpenRouter model mapping
 */
const OPENROUTER_MODELS: Record<ModelType, string> = {
  analysis: "google/gemini-3-pro-preview",
  fast: "google/gemini-3-flash-preview",
  thinking: "moonshotai/kimi-k2-thinking",
  creative: "moonshotai/kimi-k2-thinking",
  grammar: "google/gemini-3-flash-preview",
};

/**
 * Gemini model mapping (fallback)
 */
const GEMINI_MODELS: Record<ModelType, string> = {
  analysis: "gemini-3-pro-preview",
  fast: "gemini-3-flash-preview",
  thinking: "gemini-3-pro-preview", // Fallback to Pro for thinking
  creative: "gemini-3-pro-preview",
  grammar: "gemini-3-flash-preview",
};

/**
 * Create a dynamic OpenRouter provider instance
 *
 * @param apiKey - The OpenRouter API key
 * @returns OpenRouter provider instance
 */
export function createDynamicOpenRouter(apiKey: string) {
  return createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": "https://mythos.dev",
      "X-Title": "Mythos IDE",
    },
    // OpenRouter expects Chat Completions-style payloads.
    // Use compatible mode to avoid Responses API validation errors for assistant history.
    compatibility: "compatible",
  });
}

/**
 * Create a dynamic Gemini provider instance
 *
 * @param apiKey - The Google AI API key
 * @returns Gemini provider instance
 */
export function createDynamicGemini(apiKey: string) {
  return createGoogleGenerativeAI({
    apiKey,
  });
}

/**
 * DevTools options for model wrapping
 */
export interface ModelDevToolsOptions {
  /** Enable DevTools debugging (checks ENABLE_AI_DEVTOOLS env var) */
  devTools?: boolean | DevToolsConfig;
}

/**
 * Get a model instance for the specified type using OpenRouter
 *
 * @param apiKey - The OpenRouter API key
 * @param type - The model type
 * @param options - Optional DevTools configuration
 * @returns The model instance (optionally wrapped with DevTools)
 *
 * @example
 * ```typescript
 * // Basic usage
 * const model = getOpenRouterModel(apiKey, "analysis");
 *
 * // With DevTools enabled (requires ENABLE_AI_DEVTOOLS=true)
 * const model = getOpenRouterModel(apiKey, "analysis", { devTools: true });
 *
 * // With DevTools config
 * const model = getOpenRouterModel(apiKey, "analysis", {
 *   devTools: { verbose: true, logPrompts: true }
 * });
 * ```
 */
export function getOpenRouterModel(
  apiKey: string,
  type: ModelType,
  options?: ModelDevToolsOptions
) {
  const provider = createDynamicOpenRouter(apiKey);
  const modelId = OPENROUTER_MODELS[type];
  const model = provider(modelId);

  // Apply DevTools wrapper if requested
  if (options?.devTools) {
    const config = typeof options.devTools === "object" ? options.devTools : {};
    return maybeWrapWithDevTools(model, {
      logPrefix: `[ai-devtools:${type}]`,
      ...config,
    });
  }

  return model;
}

/**
 * Get a model instance for the specified type using Gemini
 *
 * @param apiKey - The Google AI API key
 * @param type - The model type
 * @param options - Optional DevTools configuration
 * @returns The model instance (optionally wrapped with DevTools)
 */
export function getGeminiModel(
  apiKey: string,
  type: ModelType,
  options?: ModelDevToolsOptions
) {
  const provider = createDynamicGemini(apiKey);
  const modelId = GEMINI_MODELS[type];
  const model = provider(modelId);

  // Apply DevTools wrapper if requested
  if (options?.devTools) {
    const config = typeof options.devTools === "object" ? options.devTools : {};
    return maybeWrapWithDevTools(model, {
      logPrefix: `[ai-devtools:gemini:${type}]`,
      ...config,
    });
  }

  return model;
}

/**
 * Get the best available model based on provided keys
 *
 * @param openRouterKey - OpenRouter API key (optional)
 * @param geminiKey - Gemini API key (optional)
 * @param type - The model type
 * @param options - Optional DevTools configuration
 * @returns The model instance (optionally wrapped with DevTools)
 */
export function getBestModel(
  openRouterKey: string | null,
  geminiKey: string | null,
  type: ModelType,
  options?: ModelDevToolsOptions
) {
  if (openRouterKey) {
    return getOpenRouterModel(openRouterKey, type, options);
  }

  if (geminiKey) {
    return getGeminiModel(geminiKey, type, options);
  }

  throw new Error(
    "No AI provider configured. Provide an API key via header or configure environment variables."
  );
}

// Re-export DevTools utilities for direct use
export { isDevToolsEnabled, wrapWithDevTools, maybeWrapWithDevTools } from "./devtools.ts";
export type { DevToolsConfig } from "./devtools.ts";
