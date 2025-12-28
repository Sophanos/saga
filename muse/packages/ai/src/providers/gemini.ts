import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Create Gemini provider
export const google = createGoogleGenerativeAI({
  apiKey: import.meta.env["VITE_GOOGLE_GENERATIVE_AI_API_KEY"],
});

// Model configurations (Gemini 3 models)
export const models = {
  // Primary model for analysis (large context window)
  analysis: google("gemini-3-pro-preview"),

  // Fast model for autocomplete and quick checks
  fast: google("gemini-3-flash-preview"),

  // Grammar checking (same as fast)
  grammar: google("gemini-3-flash-preview"),

  // Image generation (Nano Banana Pro)
  image: google("gemini-3-pro-image-preview"),
} as const;

export type ModelType = keyof typeof models;
