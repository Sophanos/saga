// Re-export all providers
export { google, models, type ModelType } from "./gemini";
export { openrouter, openrouterModels, type OpenRouterModelType } from "./openrouter";

// Unified model selector with fallback support
import { models } from "./gemini";
import { openrouterModels } from "./openrouter";

export type UnifiedModelType =
  | "analysis"
  | "fast"
  | "thinking"
  | "creative"
  | "grammar"
  | "image";

/**
 * Get the best available model for a task type.
 * OpenRouter is primary, direct Gemini is fallback.
 */
export function getModel(type: UnifiedModelType) {
  const hasOpenRouter = !!process.env["OPENROUTER_API_KEY"];
  const hasGemini = !!process.env["GOOGLE_GENERATIVE_AI_API_KEY"];

  switch (type) {
    case "analysis":
      // Large context, deep analysis
      if (hasOpenRouter) return openrouterModels.analysis;
      if (hasGemini) return models.analysis;
      throw new Error("No AI provider configured for analysis");

    case "fast":
      // Quick responses, autocomplete
      if (hasOpenRouter) return openrouterModels.fast;
      if (hasGemini) return models.fast;
      throw new Error("No AI provider configured for fast tasks");

    case "thinking":
      // Complex reasoning, chain-of-thought
      if (hasOpenRouter) return openrouterModels.thinking;
      if (hasGemini) return models.analysis; // fallback to Gemini 3 Pro
      throw new Error("No AI provider configured for thinking tasks");

    case "creative":
      // Creative writing assistance
      if (hasOpenRouter) return openrouterModels.creative;
      if (hasGemini) return models.analysis;
      throw new Error("No AI provider configured for creative tasks");

    case "grammar":
      // Grammar and spelling checks
      if (hasOpenRouter) return openrouterModels.grammar;
      if (hasGemini) return models.grammar;
      throw new Error("No AI provider configured for grammar tasks");

    case "image":
      // Image generation (Nano Banana Pro)
      if (hasOpenRouter) return openrouterModels.image;
      if (hasGemini) return models.image;
      throw new Error("No AI provider configured for image generation");

    default:
      if (hasOpenRouter) return openrouterModels.analysis;
      if (hasGemini) return models.analysis;
      throw new Error("No AI provider configured");
  }
}

/**
 * Check which AI providers are available
 */
export function getAvailableProviders(): { openrouter: boolean; gemini: boolean } {
  return {
    openrouter: !!process.env["OPENROUTER_API_KEY"],
    gemini: !!process.env["GOOGLE_GENERATIVE_AI_API_KEY"],
  };
}
