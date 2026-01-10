/**
 * Provider Registry
 *
 * Creates and manages AI providers using Vercel AI SDK.
 * Supports multiple providers with fallback chains.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModel, LanguageModel, RerankingModel } from "ai";
import type { AdapterType, LlmProvider } from "./types";
import { createQwenEmbeddingModel, QWEN_EMBEDDING_MODEL } from "../deepinfraEmbedding";
import { createDeepInfraRerankingModel } from "../deepinfraRerank";

// ============================================================================
// DEFAULT PROVIDER CONFIGS
// ============================================================================

export const DEFAULT_PROVIDERS: Record<string, Omit<LlmProvider, "enabled">> = {
  openrouter: {
    slug: "openrouter",
    displayName: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnv: "OPENROUTER_API_KEY",
    adapterType: "openrouter",
    supportsStreaming: true,
    priority: 1,
  },
  deepinfra: {
    slug: "deepinfra",
    displayName: "DeepInfra",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    apiKeyEnv: "DEEPINFRA_API_KEY",
    adapterType: "vercel-deepinfra",
    supportsStreaming: true,
    priority: 2,
  },
  "deepinfra-openai": {
    slug: "deepinfra-openai",
    displayName: "DeepInfra (OpenAI-compat)",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    apiKeyEnv: "DEEPINFRA_API_KEY",
    adapterType: "deepinfra-openai",
    supportsStreaming: true,
    priority: 3,
  },
  anthropic: {
    slug: "anthropic",
    displayName: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    adapterType: "vercel-anthropic",
    supportsStreaming: true,
    priority: 3,
  },
  openai: {
    slug: "openai",
    displayName: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKeyEnv: "OPENAI_API_KEY",
    adapterType: "vercel-openai",
    supportsStreaming: true,
    priority: 4,
  },
  google: {
    slug: "google",
    displayName: "Google AI",
    baseUrl: "https://generativelanguage.googleapis.com",
    apiKeyEnv: "GOOGLE_API_KEY",
    adapterType: "vercel-google",
    supportsStreaming: true,
    priority: 5,
  },
};

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

interface ProviderInstance {
  chat: (model: string) => LanguageModel;
  embedding?: (model: string) => EmbeddingModel;
  reranking?: (model: string) => RerankingModel;
}

const providerCache = new Map<string, ProviderInstance>();

function getApiKey(envVar: string): string | undefined {
  return process.env[envVar];
}

export function createProviderInstance(
  adapterType: AdapterType,
  baseUrl: string,
  apiKeyEnv: string
): ProviderInstance | null {
  const apiKey = getApiKey(apiKeyEnv);
  if (!apiKey) {
    console.warn(`API key not found for env var: ${apiKeyEnv}`);
    return null;
  }

  switch (adapterType) {
    case "vercel-openai": {
      const provider = createOpenAI({ apiKey });
      return {
        chat: (model) => provider.chat(model),
        embedding: (model) => provider.embedding(model),
      };
    }

    case "vercel-anthropic": {
      const provider = createAnthropic({ apiKey });
      return {
        chat: (model) => provider.languageModel(model),
      };
    }

    case "vercel-google": {
      const provider = createGoogleGenerativeAI({ apiKey });
      return {
        chat: (model) => provider.languageModel(model),
        embedding: (model) => provider.textEmbeddingModel(model),
      };
    }

    case "vercel-deepinfra": {
      const provider = createDeepInfra({ apiKey });
      return {
        chat: (model) => provider.languageModel(model) as unknown as LanguageModel,
        embedding: (model) => {
          if (model === QWEN_EMBEDDING_MODEL) {
            return createQwenEmbeddingModel();
          }
          return provider.textEmbeddingModel(model) as unknown as EmbeddingModel;
        },
        reranking: (model) =>
          createDeepInfraRerankingModel({
            apiKey,
            modelId: model,
          }),
      };
    }

    case "openrouter": {
      const provider = createOpenAI({
        apiKey,
        baseURL: baseUrl,
        headers: {
          "HTTP-Referer": process.env["OPENROUTER_SITE_URL"] ?? "https://mythos.app",
          "X-Title": process.env["OPENROUTER_APP_NAME"] ?? "Saga AI",
        },
      });
      return {
        chat: (model) => provider.chat(model),
      };
    }

    case "deepinfra-openai": {
      const provider = createOpenAI({
        apiKey,
        baseURL: baseUrl,
      });
      return {
        chat: (model) => provider.chat(model),
        embedding: (model) => provider.embedding(model),
        reranking: (model) =>
          createDeepInfraRerankingModel({
            apiKey,
            modelId: model,
          }),
      };
    }

    case "custom-fetch":
      // Custom fetch providers need special handling
      return null;

    default:
      return null;
  }
}

export function getProvider(providerSlug: string): ProviderInstance | null {
  // Check cache first
  if (providerCache.has(providerSlug)) {
    return providerCache.get(providerSlug)!;
  }

  const config = DEFAULT_PROVIDERS[providerSlug];
  if (!config) {
    console.warn(`Unknown provider: ${providerSlug}`);
    return null;
  }

  const instance = createProviderInstance(config.adapterType, config.baseUrl, config.apiKeyEnv);

  if (instance) {
    providerCache.set(providerSlug, instance);
  }

  return instance;
}

// ============================================================================
// MODEL HELPERS
// ============================================================================

export function getLanguageModel(providerSlug: string, modelId: string): LanguageModel | null {
  const provider = getProvider(providerSlug);
  if (!provider) return null;

  try {
    return provider.chat(modelId);
  } catch (error) {
    console.error(`Failed to get language model ${modelId} from ${providerSlug}:`, error);
    return null;
  }
}

export function getEmbeddingModel(
  providerSlug: string,
  modelId: string
): EmbeddingModel | null {
  const provider = getProvider(providerSlug);
  if (!provider?.embedding) return null;

  try {
    return provider.embedding(modelId);
  } catch (error) {
    console.error(`Failed to get embedding model ${modelId} from ${providerSlug}:`, error);
    return null;
  }
}

export function getRerankingModel(
  providerSlug: string,
  modelId: string
): RerankingModel | null {
  const provider = getProvider(providerSlug);
  if (!provider?.reranking) return null;

  try {
    return provider.reranking(modelId);
  } catch (error) {
    console.error(`Failed to get reranking model ${modelId} from ${providerSlug}:`, error);
    return null;
  }
}

// ============================================================================
// FALLBACK CHAIN
// ============================================================================

export interface ModelWithFallback {
  model: LanguageModel;
  provider: string;
  modelId: string;
  isFallback: boolean;
  fallbackLevel: 0 | 1 | 2;
}

export interface EmbeddingModelWithFallback {
  model: EmbeddingModel;
  provider: string;
  modelId: string;
  isFallback: boolean;
  fallbackLevel: 0 | 1 | 2;
}

export interface RerankingModelWithFallback {
  model: RerankingModel;
  provider: string;
  modelId: string;
  isFallback: boolean;
  fallbackLevel: 0 | 1 | 2;
}

export function getEmbeddingModelWithFallback(
  directProvider: string,
  directModel: string,
  fallback1Provider?: string,
  fallback1Model?: string,
  fallback2Provider?: string,
  fallback2Model?: string
): EmbeddingModelWithFallback | null {
  const direct = getEmbeddingModel(directProvider, directModel);
  if (direct) {
    return {
      model: direct,
      provider: directProvider,
      modelId: directModel,
      isFallback: false,
      fallbackLevel: 0,
    };
  }

  if (fallback1Provider && fallback1Model) {
    const fallback = getEmbeddingModel(fallback1Provider, fallback1Model);
    if (fallback) {
      console.warn(`Using embedding fallback 1: ${fallback1Provider}/${fallback1Model}`);
      return {
        model: fallback,
        provider: fallback1Provider,
        modelId: fallback1Model,
        isFallback: true,
        fallbackLevel: 1,
      };
    }
  }

  if (fallback2Provider && fallback2Model) {
    const fallback = getEmbeddingModel(fallback2Provider, fallback2Model);
    if (fallback) {
      console.warn(`Using embedding fallback 2: ${fallback2Provider}/${fallback2Model}`);
      return {
        model: fallback,
        provider: fallback2Provider,
        modelId: fallback2Model,
        isFallback: true,
        fallbackLevel: 2,
      };
    }
  }

  return null;
}

export function getRerankingModelWithFallback(
  directProvider: string,
  directModel: string,
  fallback1Provider?: string,
  fallback1Model?: string,
  fallback2Provider?: string,
  fallback2Model?: string
): RerankingModelWithFallback | null {
  const direct = getRerankingModel(directProvider, directModel);
  if (direct) {
    return {
      model: direct,
      provider: directProvider,
      modelId: directModel,
      isFallback: false,
      fallbackLevel: 0,
    };
  }

  if (fallback1Provider && fallback1Model) {
    const fallback = getRerankingModel(fallback1Provider, fallback1Model);
    if (fallback) {
      console.warn(`Using reranking fallback 1: ${fallback1Provider}/${fallback1Model}`);
      return {
        model: fallback,
        provider: fallback1Provider,
        modelId: fallback1Model,
        isFallback: true,
        fallbackLevel: 1,
      };
    }
  }

  if (fallback2Provider && fallback2Model) {
    const fallback = getRerankingModel(fallback2Provider, fallback2Model);
    if (fallback) {
      console.warn(`Using reranking fallback 2: ${fallback2Provider}/${fallback2Model}`);
      return {
        model: fallback,
        provider: fallback2Provider,
        modelId: fallback2Model,
        isFallback: true,
        fallbackLevel: 2,
      };
    }
  }

  return null;
}

export function getModelWithFallback(
  directProvider: string,
  directModel: string,
  fallback1Provider?: string,
  fallback1Model?: string,
  fallback2Provider?: string,
  fallback2Model?: string
): ModelWithFallback | null {
  // Try direct model
  const directLM = getLanguageModel(directProvider, directModel);
  if (directLM) {
    return {
      model: directLM,
      provider: directProvider,
      modelId: directModel,
      isFallback: false,
      fallbackLevel: 0,
    };
  }

  // Try fallback 1
  if (fallback1Provider && fallback1Model) {
    const fallback1LM = getLanguageModel(fallback1Provider, fallback1Model);
    if (fallback1LM) {
      console.warn(`Using fallback 1: ${fallback1Provider}/${fallback1Model}`);
      return {
        model: fallback1LM,
        provider: fallback1Provider,
        modelId: fallback1Model,
        isFallback: true,
        fallbackLevel: 1,
      };
    }
  }

  // Try fallback 2
  if (fallback2Provider && fallback2Model) {
    const fallback2LM = getLanguageModel(fallback2Provider, fallback2Model);
    if (fallback2LM) {
      console.warn(`Using fallback 2: ${fallback2Provider}/${fallback2Model}`);
      return {
        model: fallback2LM,
        provider: fallback2Provider,
        modelId: fallback2Model,
        isFallback: true,
        fallbackLevel: 2,
      };
    }
  }

  return null;
}

// ============================================================================
// CLEAR CACHE (for testing)
// ============================================================================

export function clearProviderCache(): void {
  providerCache.clear();
}
