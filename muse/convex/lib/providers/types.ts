/**
 * AI Provider Types
 *
 * Central type definitions for AI modalities, tasks, and configurations.
 */

// ============================================================================
// MODALITIES
// ============================================================================

export const AI_MODALITIES = ["text", "image", "audio", "video", "world"] as const;
export type AIModality = (typeof AI_MODALITIES)[number];

// ============================================================================
// TASK CATEGORIES BY MODALITY
// ============================================================================

export const AI_TASK_CATEGORIES = {
  text: [
    "chat", // General conversation
    "lint", // Consistency checking
    "coach", // Writing feedback
    "detect", // Entity extraction
    "dynamics", // Character interactions
    "style", // Style learning
    "thinking", // Deep reasoning
    "creative", // Creative generation
    "summarize", // Text summarization
  ],
  image: [
    "image_generate", // Text → image
    "image_edit", // Inpaint, outpaint, remix
    "image_analyze", // Image → text (vision)
    "image_upscale", // Enhance resolution
  ],
  audio: [
    "tts", // Text → speech
    "stt", // Speech → text
    "voice_clone", // Voice cloning
  ],
  video: [
    "video_generate", // Text/image → video
    "video_edit", // Video manipulation
  ],
  world: [
    "world_generate", // World building
    "world_simulate", // Simulation/dynamics
  ],
} as const;

export type TextTask = (typeof AI_TASK_CATEGORIES.text)[number];
export type ImageTask = (typeof AI_TASK_CATEGORIES.image)[number];
export type AudioTask = (typeof AI_TASK_CATEGORIES.audio)[number];
export type VideoTask = (typeof AI_TASK_CATEGORIES.video)[number];
export type WorldTask = (typeof AI_TASK_CATEGORIES.world)[number];

export type AITaskSlug = TextTask | ImageTask | AudioTask | VideoTask | WorldTask;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getModalityForTask(task: AITaskSlug): AIModality {
  for (const [modality, tasks] of Object.entries(AI_TASK_CATEGORIES)) {
    if ((tasks as readonly string[]).includes(task)) {
      return modality as AIModality;
    }
  }
  return "text";
}

export function getTasksForModality(modality: AIModality): readonly string[] {
  return AI_TASK_CATEGORIES[modality] ?? [];
}

export function isValidTask(task: string): task is AITaskSlug {
  return Object.values(AI_TASK_CATEGORIES)
    .flat()
    .includes(task as AITaskSlug);
}

// ============================================================================
// PROVIDER ADAPTER TYPES
// ============================================================================

export const ADAPTER_TYPES = [
  "vercel-openai", // createOpenAI()
  "vercel-anthropic", // createAnthropic()
  "vercel-google", // createGoogleGenerativeAI()
  "vercel-deepinfra", // @ai-sdk/deepinfra
  "openrouter", // createOpenAI({ baseURL: openrouter })
  "deepinfra-openai", // createOpenAI({ baseURL: deepinfra }) - for reranker, etc.
  "custom-fetch", // Raw fetch for non-SDK (embeddings, reranker, custom APIs)
] as const;

export type AdapterType = (typeof ADAPTER_TYPES)[number];

// ============================================================================
// RESPONSE FORMATS
// ============================================================================

export const RESPONSE_FORMATS = ["text", "json_object", "json_schema"] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

// ============================================================================
// REASONING EFFORT (for thinking models)
// ============================================================================

export const REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

// ============================================================================
// TEXT VERBOSITY
// ============================================================================

export const TEXT_VERBOSITIES = ["low", "medium", "high"] as const;
export type TextVerbosity = (typeof TEXT_VERBOSITIES)[number];

// ============================================================================
// TIER IDS (re-export for convenience)
// ============================================================================

export type TierId = "free" | "pro" | "team" | "enterprise";

// ============================================================================
// PROVIDER CONFIG
// ============================================================================

export interface LlmProvider {
  slug: string;
  displayName: string;
  baseUrl: string;
  apiKeyEnv: string;
  adapterType: AdapterType;
  supportsStreaming: boolean;
  priority: number;
  enabled: boolean;
  markupPercent?: number;
}

// ============================================================================
// TASK CONFIG
// ============================================================================

export interface LlmTaskConfig {
  taskSlug: AITaskSlug;
  modality: AIModality;
  description?: string;

  // Model chain
  directModel: string;
  directProvider: string;
  fallback1Model?: string;
  fallback1Provider?: string;
  fallback2Model?: string;
  fallback2Provider?: string;

  // Limits
  maxTokensIn?: number;
  maxTokensOut?: number;
  maxTokensOutBrief?: number;
  maxTokensOutStandard?: number;
  maxTokensOutDeep?: number;
  maxCostUsd?: number;

  // Generation params
  temperature?: number;
  topP?: number;
  reasoningEffort?: ReasoningEffort;
  responseFormat: ResponseFormat;

  // Pricing (per 1M tokens)
  priceInPerM?: number;
  priceOutPerM?: number;
  fallback1PriceInPerM?: number;
  fallback1PriceOutPerM?: number;
  fallback2PriceInPerM?: number;
  fallback2PriceOutPerM?: number;

  // Access control
  minTier: TierId;
  enabled: boolean;
}

// ============================================================================
// RUNTIME MODEL RESULT
// ============================================================================

export interface ResolvedModel {
  model: string;
  provider: string;
  adapterType: AdapterType;
  config: LlmTaskConfig;
  isFallback: boolean;
  fallbackLevel: 0 | 1 | 2;
}
