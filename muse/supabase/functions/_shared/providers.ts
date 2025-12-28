/**
 * Dynamic Provider Factory for Supabase Edge Functions
 *
 * Creates AI provider instances at runtime with provided API keys.
 * This is essential for BYOK support where each request may use a different key.
 */

// Deno imports for ai-sdk
import { createOpenAI } from "https://esm.sh/@ai-sdk/openai@1.0.0";
import { createGoogleGenerativeAI } from "https://esm.sh/@ai-sdk/google@1.0.0";

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
 * Get a model instance for the specified type using OpenRouter
 *
 * @param apiKey - The OpenRouter API key
 * @param type - The model type
 * @returns The model instance
 */
export function getOpenRouterModel(apiKey: string, type: ModelType) {
  const provider = createDynamicOpenRouter(apiKey);
  const modelId = OPENROUTER_MODELS[type];
  return provider(modelId);
}

/**
 * Get a model instance for the specified type using Gemini
 *
 * @param apiKey - The Google AI API key
 * @param type - The model type
 * @returns The model instance
 */
export function getGeminiModel(apiKey: string, type: ModelType) {
  const provider = createDynamicGemini(apiKey);
  const modelId = GEMINI_MODELS[type];
  return provider(modelId);
}

/**
 * Get the best available model based on provided keys
 *
 * @param openRouterKey - OpenRouter API key (optional)
 * @param geminiKey - Gemini API key (optional)
 * @param type - The model type
 * @returns The model instance
 */
export function getBestModel(
  openRouterKey: string | null,
  geminiKey: string | null,
  type: ModelType
) {
  if (openRouterKey) {
    return getOpenRouterModel(openRouterKey, type);
  }

  if (geminiKey) {
    return getGeminiModel(geminiKey, type);
  }

  throw new Error(
    "No AI provider configured. Provide an API key via header or configure environment variables."
  );
}
