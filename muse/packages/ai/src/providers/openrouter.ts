import { createOpenAI } from "@ai-sdk/openai";

// OpenRouter provides access to multiple LLMs through a unified API
// https://openrouter.ai/docs
export const openrouter = createOpenAI({
  apiKey: process.env["OPENROUTER_API_KEY"],
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] || "http://localhost:3000",
    "X-Title": process.env["OPENROUTER_APP_NAME"] || "Mythos IDE",
  },
});

// Task-based model routing
export const openrouterModels = {
  // Gemini 3 models
  analysis: openrouter("google/gemini-3-pro-preview"),
  fast: openrouter("google/gemini-3-flash-preview"),
  grammar: openrouter("google/gemini-3-flash-preview"),
  image: openrouter("google/gemini-3-pro-image-preview"),

  // Kimi K2 for thinking & creative
  thinking: openrouter("moonshotai/kimi-k2-thinking"),
  creative: openrouter("moonshotai/kimi-k2-thinking"),
} as const;

export type OpenRouterModelType = keyof typeof openrouterModels;
