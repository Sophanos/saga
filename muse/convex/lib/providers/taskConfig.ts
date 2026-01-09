/**
 * Task Configuration
 *
 * Routes AI tasks to appropriate models based on tier and config.
 * Supports database-driven config with hardcoded fallbacks.
 */

import type { QueryCtx } from "../../_generated/server";
import type { AITaskSlug, TierId, LlmTaskConfig, AIModality, ResolvedModel } from "./types";
import { getModalityForTask } from "./types";
import { getModelWithFallback } from "./registry";
import { TIER_DEFAULTS, isTierHigher } from "../tierConfig";

// ============================================================================
// DEFAULT TASK CONFIGS (Hardcoded fallback)
// ============================================================================

export const DEFAULT_TASK_CONFIGS: Record<AITaskSlug, LlmTaskConfig> = {
  // Text tasks
  chat: {
    taskSlug: "chat",
    modality: "text",
    description: "General conversation and writing assistance",
    directModel: "anthropic/claude-sonnet-4",
    directProvider: "openrouter",
    fallback1Model: "google/gemini-2.0-flash-001",
    fallback1Provider: "openrouter",
    temperature: 0.7,
    responseFormat: "text",
    minTier: "free",
    enabled: true,
  },
  lint: {
    taskSlug: "lint",
    modality: "text",
    description: "Consistency checking and error detection",
    directModel: "anthropic/claude-sonnet-4",
    directProvider: "openrouter",
    fallback1Model: "google/gemini-2.0-flash-001",
    fallback1Provider: "openrouter",
    temperature: 0.2,
    responseFormat: "json_object",
    minTier: "pro",
    enabled: true,
  },
  coach: {
    taskSlug: "coach",
    modality: "text",
    description: "Writing feedback and coaching",
    directModel: "anthropic/claude-sonnet-4",
    directProvider: "openrouter",
    fallback1Model: "google/gemini-2.0-flash-001",
    fallback1Provider: "openrouter",
    temperature: 0.5,
    responseFormat: "text",
    minTier: "pro",
    enabled: true,
  },
  detect: {
    taskSlug: "detect",
    modality: "text",
    description: "Entity extraction from text",
    directModel: "anthropic/claude-sonnet-4",
    directProvider: "openrouter",
    fallback1Model: "google/gemini-2.0-flash-001",
    fallback1Provider: "openrouter",
    temperature: 0.1,
    responseFormat: "json_object",
    minTier: "free",
    enabled: true,
  },
  dynamics: {
    taskSlug: "dynamics",
    modality: "text",
    description: "Character interaction extraction",
    directModel: "anthropic/claude-sonnet-4",
    directProvider: "openrouter",
    fallback1Model: "google/gemini-2.0-flash-001",
    fallback1Provider: "openrouter",
    temperature: 0.3,
    responseFormat: "json_object",
    minTier: "free",
    enabled: true,
  },
  style: {
    taskSlug: "style",
    modality: "text",
    description: "Writing style analysis and learning",
    directModel: "anthropic/claude-sonnet-4",
    directProvider: "openrouter",
    fallback1Model: "google/gemini-2.0-flash-001",
    fallback1Provider: "openrouter",
    temperature: 0.3,
    responseFormat: "json_object",
    minTier: "pro",
    enabled: true,
  },
  thinking: {
    taskSlug: "thinking",
    modality: "text",
    description: "Deep reasoning and analysis",
    directModel: "moonshotai/kimi-k2-thinking",
    directProvider: "openrouter",
    fallback1Model: "anthropic/claude-sonnet-4",
    fallback1Provider: "openrouter",
    fallback2Model: "google/gemini-2.0-flash-001",
    fallback2Provider: "openrouter",
    temperature: 0.3,
    reasoningEffort: "high",
    responseFormat: "text",
    minTier: "pro",
    enabled: true,
  },
  creative: {
    taskSlug: "creative",
    modality: "text",
    description: "Creative writing generation",
    directModel: "moonshotai/kimi-k2-thinking",
    directProvider: "openrouter",
    fallback1Model: "anthropic/claude-sonnet-4",
    fallback1Provider: "openrouter",
    temperature: 0.9,
    responseFormat: "text",
    minTier: "pro",
    enabled: true,
  },
  summarize: {
    taskSlug: "summarize",
    modality: "text",
    description: "Text summarization",
    directModel: "google/gemini-2.0-flash-001",
    directProvider: "openrouter",
    fallback1Model: "anthropic/claude-haiku",
    fallback1Provider: "openrouter",
    temperature: 0.2,
    responseFormat: "text",
    minTier: "free",
    enabled: true,
  },

  // Image tasks
  image_generate: {
    taskSlug: "image_generate",
    modality: "image",
    description: "Generate images from text",
    directModel: "black-forest-labs/FLUX-1-dev",
    directProvider: "deepinfra",
    fallback1Model: "google/gemini-2.0-flash-preview-image-generation",
    fallback1Provider: "openrouter",
    responseFormat: "text",
    minTier: "pro",
    enabled: true,
  },
  image_edit: {
    taskSlug: "image_edit",
    modality: "image",
    description: "Edit existing images",
    directModel: "black-forest-labs/FLUX-1-dev",
    directProvider: "deepinfra",
    responseFormat: "text",
    minTier: "pro",
    enabled: true,
  },
  image_analyze: {
    taskSlug: "image_analyze",
    modality: "image",
    description: "Analyze images (vision)",
    directModel: "google/gemini-2.0-flash",
    directProvider: "openrouter",
    fallback1Model: "anthropic/claude-sonnet-4",
    fallback1Provider: "openrouter",
    temperature: 0.2,
    responseFormat: "text",
    minTier: "pro",
    enabled: true,
  },
  image_upscale: {
    taskSlug: "image_upscale",
    modality: "image",
    description: "Upscale image resolution",
    directModel: "black-forest-labs/FLUX-1.1-pro",
    directProvider: "deepinfra",
    responseFormat: "text",
    minTier: "team",
    enabled: true,
  },

  // Audio tasks (future)
  tts: {
    taskSlug: "tts",
    modality: "audio",
    description: "Text to speech",
    directModel: "elevenlabs/eleven_turbo_v2_5",
    directProvider: "custom-fetch",
    responseFormat: "text",
    minTier: "pro",
    enabled: false,
  },
  stt: {
    taskSlug: "stt",
    modality: "audio",
    description: "Speech to text",
    directModel: "openai/whisper-large-v3",
    directProvider: "deepinfra",
    responseFormat: "text",
    minTier: "pro",
    enabled: false,
  },
  voice_clone: {
    taskSlug: "voice_clone",
    modality: "audio",
    description: "Clone voice from sample",
    directModel: "elevenlabs/voice-clone",
    directProvider: "custom-fetch",
    responseFormat: "text",
    minTier: "team",
    enabled: false,
  },

  // Video tasks (future)
  video_generate: {
    taskSlug: "video_generate",
    modality: "video",
    description: "Generate video from text/image",
    directModel: "runway/gen-3",
    directProvider: "custom-fetch",
    responseFormat: "text",
    minTier: "team",
    enabled: false,
  },
  video_edit: {
    taskSlug: "video_edit",
    modality: "video",
    description: "Edit existing video",
    directModel: "runway/gen-3",
    directProvider: "custom-fetch",
    responseFormat: "text",
    minTier: "team",
    enabled: false,
  },

  // World tasks (future)
  world_generate: {
    taskSlug: "world_generate",
    modality: "world",
    description: "Generate world elements",
    directModel: "anthropic/claude-sonnet-4",
    directProvider: "openrouter",
    temperature: 0.8,
    responseFormat: "json_object",
    minTier: "pro",
    enabled: true,
  },
  world_simulate: {
    taskSlug: "world_simulate",
    modality: "world",
    description: "Simulate world interactions",
    directModel: "moonshotai/kimi-k2-thinking",
    directProvider: "openrouter",
    temperature: 0.5,
    reasoningEffort: "medium",
    responseFormat: "json_object",
    minTier: "team",
    enabled: false,
  },
};

// ============================================================================
// TIER CHECKING
// ============================================================================

function isTierAtLeast(userTier: TierId, requiredTier: TierId): boolean {
  if (userTier === requiredTier) return true;
  return isTierHigher(userTier, requiredTier);
}

// ============================================================================
// TASK CONFIG HELPERS
// ============================================================================

/**
 * Get task config from database with fallback to defaults
 */
export async function getTaskConfig(
  ctx: QueryCtx,
  taskSlug: AITaskSlug
): Promise<LlmTaskConfig> {
  // Try database first
  const dbConfig = await ctx.db
    .query("llmTaskConfigs")
    .withIndex("by_task", (q) => q.eq("taskSlug", taskSlug))
    .first();

  if (dbConfig && dbConfig.enabled) {
    return {
      taskSlug: dbConfig.taskSlug as AITaskSlug,
      modality: dbConfig.modality as AIModality,
      description: dbConfig.description,
      directModel: dbConfig.directModel,
      directProvider: dbConfig.directProvider,
      fallback1Model: dbConfig.fallback1Model,
      fallback1Provider: dbConfig.fallback1Provider,
      fallback2Model: dbConfig.fallback2Model,
      fallback2Provider: dbConfig.fallback2Provider,
      maxTokensIn: dbConfig.maxTokensIn,
      maxTokensOut: dbConfig.maxTokensOut,
      maxTokensOutBrief: dbConfig.maxTokensOutBrief,
      maxTokensOutStandard: dbConfig.maxTokensOutStandard,
      maxTokensOutDeep: dbConfig.maxTokensOutDeep,
      maxCostUsd: dbConfig.maxCostUsd,
      temperature: dbConfig.temperature,
      topP: dbConfig.topP,
      reasoningEffort: dbConfig.reasoningEffort as LlmTaskConfig["reasoningEffort"],
      responseFormat: dbConfig.responseFormat as LlmTaskConfig["responseFormat"],
      priceInPerM: dbConfig.priceInPerM,
      priceOutPerM: dbConfig.priceOutPerM,
      fallback1PriceInPerM: dbConfig.fallback1PriceInPerM,
      fallback1PriceOutPerM: dbConfig.fallback1PriceOutPerM,
      fallback2PriceInPerM: dbConfig.fallback2PriceInPerM,
      fallback2PriceOutPerM: dbConfig.fallback2PriceOutPerM,
      minTier: dbConfig.minTier as TierId,
      enabled: dbConfig.enabled,
    };
  }

  // Fall back to defaults
  return DEFAULT_TASK_CONFIGS[taskSlug];
}

/**
 * Get task config without database (sync version)
 */
export function getTaskConfigSync(taskSlug: AITaskSlug): LlmTaskConfig {
  return DEFAULT_TASK_CONFIGS[taskSlug];
}

/**
 * Check if task is available for a tier
 */
export function isTaskAvailable(taskSlug: AITaskSlug, userTier: TierId): boolean {
  const config = DEFAULT_TASK_CONFIGS[taskSlug];
  if (!config || !config.enabled) return false;
  return isTierAtLeast(userTier, config.minTier);
}

/**
 * Check task access with detailed response
 */
export function checkTaskAccess(
  taskSlug: AITaskSlug,
  userTier: TierId
): { allowed: boolean; reason?: string; upgradeRequired?: boolean; requiredTier?: TierId } {
  const config = DEFAULT_TASK_CONFIGS[taskSlug];

  if (!config) {
    return { allowed: false, reason: `Unknown task: ${taskSlug}` };
  }

  if (!config.enabled) {
    return { allowed: false, reason: `Task ${taskSlug} is not enabled` };
  }

  if (!isTierAtLeast(userTier, config.minTier)) {
    return {
      allowed: false,
      reason: `${taskSlug} requires ${config.minTier} tier`,
      upgradeRequired: true,
      requiredTier: config.minTier,
    };
  }

  return { allowed: true };
}

/**
 * Get all tasks for a modality
 */
export function getTasksForModality(modality: AIModality): LlmTaskConfig[] {
  return Object.values(DEFAULT_TASK_CONFIGS).filter(
    (config) => config.modality === modality && config.enabled
  );
}

/**
 * Get all available tasks for a user tier
 */
export function getAvailableTasksForTier(userTier: TierId): LlmTaskConfig[] {
  return Object.values(DEFAULT_TASK_CONFIGS).filter(
    (config) => config.enabled && isTierAtLeast(userTier, config.minTier)
  );
}

// ============================================================================
// MODEL RESOLUTION
// ============================================================================

/**
 * Get resolved model for a task with fallback chain
 */
export async function getModelForTask(
  ctx: QueryCtx,
  taskSlug: AITaskSlug,
  userTier: TierId
): Promise<ResolvedModel> {
  const config = await getTaskConfig(ctx, taskSlug);

  // Check tier access
  const access = checkTaskAccess(taskSlug, userTier);
  if (!access.allowed) {
    throw new Error(access.reason);
  }

  // Get model with fallback
  const resolved = getModelWithFallback(
    config.directProvider,
    config.directModel,
    config.fallback1Provider,
    config.fallback1Model,
    config.fallback2Provider,
    config.fallback2Model
  );

  if (!resolved) {
    throw new Error(`No available model for task: ${taskSlug}`);
  }

  return {
    model: resolved.modelId,
    provider: resolved.provider,
    adapterType: "openrouter", // Default, could be looked up from provider
    config,
    isFallback: resolved.isFallback,
    fallbackLevel: resolved.fallbackLevel,
  };
}

/**
 * Sync version for use outside Convex queries
 */
export function getModelForTaskSync(
  taskSlug: AITaskSlug,
  userTier: TierId
): { model: string; provider: string; config: LlmTaskConfig } {
  const config = getTaskConfigSync(taskSlug);

  // Check tier access
  const access = checkTaskAccess(taskSlug, userTier);
  if (!access.allowed) {
    throw new Error(access.reason);
  }

  return {
    model: config.directModel,
    provider: config.directProvider,
    config,
  };
}
