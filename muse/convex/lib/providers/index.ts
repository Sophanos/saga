/**
 * Provider System
 *
 * Central exports for AI provider management.
 */

// Types
export {
  // Modalities
  AI_MODALITIES,
  type AIModality,

  // Tasks
  AI_TASK_CATEGORIES,
  type AITaskSlug,
  type TextTask,
  type ImageTask,
  type AudioTask,
  type VideoTask,
  type WorldTask,
  getModalityForTask,
  getTasksForModality,
  isValidTask,

  // Adapters
  ADAPTER_TYPES,
  type AdapterType,

  // Response formats
  RESPONSE_FORMATS,
  type ResponseFormat,

  // Reasoning
  REASONING_EFFORTS,
  type ReasoningEffort,

  // Verbosity
  TEXT_VERBOSITIES,
  type TextVerbosity,

  // Config types
  type TierId,
  type LlmProvider,
  type LlmTaskConfig,
  type ResolvedModel,
} from "./types";

// Image contexts
export {
  // Tiers
  IMAGE_TIERS,
  type ImageTier,
  type ImageTierConfig,
  getTierConfig,
  selectImageTier,
  type ImageTierSelectionOptions,

  // Contexts
  IMAGE_CONTEXTS,
  type ImageContext,
  type ImageContextConfig,
  getContextConfig,
  getDefaultsForContext,
  getImageContextForEntityType,

  // Storage
  IMAGE_STORAGE_TARGETS,
  type ImageStorageTarget,

  // Styles
  IMAGE_STYLES,
  type ImageStyle,
  getStylePromptPrefix,

  // Aspect ratios
  ASPECT_RATIOS,
  type AspectRatio,

  // Edit modes
  EDIT_MODES,
  type EditMode,
} from "./imageContexts";

// Registry
export {
  DEFAULT_PROVIDERS,
  createProviderInstance,
  getProvider,
  getLanguageModel,
  getEmbeddingModel,
  getModelWithFallback,
  type ModelWithFallback,
  clearProviderCache,
} from "./registry";

// Task config
export {
  DEFAULT_TASK_CONFIGS,
  getTaskConfig,
  getTaskConfigSync,
  isTaskAvailable,
  checkTaskAccess,
  getTasksForModality as getEnabledTasksForModality,
  getAvailableTasksForTier,
  getModelForTask,
  getModelForTaskSync,
} from "./taskConfig";
