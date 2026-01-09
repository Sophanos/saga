/**
 * Centralized Tier Configuration
 *
 * Single source of truth for all tier-based limits.
 * Provides hardcoded defaults that can be overridden by database values.
 *
 * Usage:
 * - Use TIER_DEFAULTS for hardcoded fallback values
 * - Use getTierConfig() in Convex functions to get DB value with fallback
 * - Use tiers.ts queries for direct database access
 */

// ============================================================================
// TYPES
// ============================================================================

export type TierId = "free" | "pro" | "team" | "enterprise";
export type BillingMode = "byok" | "managed" | "anonymous_trial";

export interface TierAIConfig {
  tokensPerMonth: number | null;
  callsPerDay: number;
  concurrentRequests: number;
  models: string[];
}

export interface TierAIFeatures {
  chat: boolean;
  lint: boolean;
  coach: boolean;
  detect: boolean;
  search: boolean;
  webSearch: boolean;
  imageGeneration: boolean;
  styleAdaptation: boolean;
}

export interface TierMemoryConfig {
  retentionDays: number | null; // null = forever
  maxPerProject: number;
  maxPinned: number;
}

export interface TierEmbeddingsConfig {
  operationsPerDay: number;
  maxVectorsPerProject: number;
  queuePriority: number;
}

export interface TierProjectsConfig {
  maxProjects: number;
  maxDocumentsPerProject: number;
  maxEntitiesPerProject: number;
  maxWordsPerMonth: number | null;
  storageMB: number;
}

export interface TierCollaborationConfig {
  enabled: boolean;
  maxCollaboratorsPerProject: number | null;
}

export interface TierFeaturesConfig {
  prioritySupport: boolean;
  customModels: boolean;
  apiAccess: boolean;
  exportEnabled: boolean;
}

export interface TierConfig {
  id: TierId;
  name: string;
  description?: string;
  price: { monthly: number; yearly: number }; // in dollars
  ai: TierAIConfig;
  aiFeatures: TierAIFeatures;
  memory: TierMemoryConfig;
  embeddings: TierEmbeddingsConfig;
  projects: TierProjectsConfig;
  collaboration: TierCollaborationConfig;
  features: TierFeaturesConfig;
}

// ============================================================================
// TIER DEFAULTS (Hardcoded fallback)
// ============================================================================

export const TIER_DEFAULTS: Record<TierId, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "Get started with basic features",
    price: { monthly: 0, yearly: 0 },
    ai: {
      tokensPerMonth: 10_000,
      callsPerDay: 20,
      concurrentRequests: 1,
      models: ["google/gemini-2.0-flash-001"],
    },
    aiFeatures: {
      chat: true,
      lint: false,
      coach: false,
      detect: true,
      search: true,
      webSearch: false,
      imageGeneration: false,
      styleAdaptation: false,
    },
    memory: {
      retentionDays: 90,
      maxPerProject: 100,
      maxPinned: 5,
    },
    embeddings: {
      operationsPerDay: 100,
      maxVectorsPerProject: 1_000,
      queuePriority: 1,
    },
    projects: {
      maxProjects: 3,
      maxDocumentsPerProject: 50,
      maxEntitiesPerProject: 100,
      maxWordsPerMonth: 10_000,
      storageMB: 100,
    },
    collaboration: {
      enabled: false,
      maxCollaboratorsPerProject: null,
    },
    features: {
      prioritySupport: false,
      customModels: false,
      apiAccess: false,
      exportEnabled: true,
    },
  },

  pro: {
    id: "pro",
    name: "Pro",
    description: "For serious writers",
    price: { monthly: 20, yearly: 192 },
    ai: {
      tokensPerMonth: 500_000,
      callsPerDay: 1000,
      concurrentRequests: 5,
      models: [
        "anthropic/claude-sonnet-4",
        "anthropic/claude-haiku",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "google/gemini-2.0-flash-001",
        "google/gemini-2.5-pro-preview",
      ],
    },
    aiFeatures: {
      chat: true,
      lint: true,
      coach: true,
      detect: true,
      search: true,
      webSearch: true,
      imageGeneration: true,
      styleAdaptation: true,
    },
    memory: {
      retentionDays: null, // forever
      maxPerProject: 1_000,
      maxPinned: 100,
    },
    embeddings: {
      operationsPerDay: 1_000,
      maxVectorsPerProject: 50_000,
      queuePriority: 5,
    },
    projects: {
      maxProjects: 20,
      maxDocumentsPerProject: 500,
      maxEntitiesPerProject: 1_000,
      maxWordsPerMonth: null, // unlimited
      storageMB: 2_000,
    },
    collaboration: {
      enabled: false,
      maxCollaboratorsPerProject: null,
    },
    features: {
      prioritySupport: false,
      customModels: true,
      apiAccess: false,
      exportEnabled: true,
    },
  },

  team: {
    id: "team",
    name: "Team",
    description: "For writing teams and studios",
    price: { monthly: 50, yearly: 480 },
    ai: {
      tokensPerMonth: 2_000_000,
      callsPerDay: 5000,
      concurrentRequests: 10,
      models: [
        "anthropic/claude-sonnet-4",
        "anthropic/claude-opus-4",
        "anthropic/claude-haiku",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "openai/o1",
        "google/gemini-2.0-flash-001",
        "google/gemini-2.5-pro-preview",
      ],
    },
    aiFeatures: {
      chat: true,
      lint: true,
      coach: true,
      detect: true,
      search: true,
      webSearch: true,
      imageGeneration: true,
      styleAdaptation: true,
    },
    memory: {
      retentionDays: null, // forever
      maxPerProject: 10_000,
      maxPinned: 1_000,
    },
    embeddings: {
      operationsPerDay: 10_000,
      maxVectorsPerProject: 500_000,
      queuePriority: 10,
    },
    projects: {
      maxProjects: 100,
      maxDocumentsPerProject: 2_000,
      maxEntitiesPerProject: 5_000,
      maxWordsPerMonth: null, // unlimited
      storageMB: 10_000,
    },
    collaboration: {
      enabled: true,
      maxCollaboratorsPerProject: 10,
    },
    features: {
      prioritySupport: true,
      customModels: true,
      apiAccess: true,
      exportEnabled: true,
    },
  },

  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large organizations",
    price: { monthly: 0, yearly: 0 }, // Custom pricing
    ai: {
      tokensPerMonth: null, // unlimited
      callsPerDay: 50000,
      concurrentRequests: 50,
      models: [
        "anthropic/claude-sonnet-4",
        "anthropic/claude-opus-4",
        "anthropic/claude-haiku",
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
        "openai/o1",
        "google/gemini-2.0-flash-001",
        "google/gemini-2.5-pro-preview",
      ],
    },
    aiFeatures: {
      chat: true,
      lint: true,
      coach: true,
      detect: true,
      search: true,
      webSearch: true,
      imageGeneration: true,
      styleAdaptation: true,
    },
    memory: {
      retentionDays: null,
      maxPerProject: 100_000,
      maxPinned: 10_000,
    },
    embeddings: {
      operationsPerDay: 100_000,
      maxVectorsPerProject: 5_000_000,
      queuePriority: 100,
    },
    projects: {
      maxProjects: 1000,
      maxDocumentsPerProject: 10_000,
      maxEntitiesPerProject: 50_000,
      maxWordsPerMonth: null,
      storageMB: 100_000,
    },
    collaboration: {
      enabled: true,
      maxCollaboratorsPerProject: 100,
    },
    features: {
      prioritySupport: true,
      customModels: true,
      apiAccess: true,
      exportEnabled: true,
    },
  },
};

// Backward compatibility alias
export const TIERS = TIER_DEFAULTS;

// ============================================================================
// BYOK OVERRIDES
// ============================================================================

export const BYOK_OVERRIDES: Partial<TierAIConfig> = {
  tokensPerMonth: null, // unlimited
  callsPerDay: 10_000,
  concurrentRequests: 10,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const DAYS_MS = 24 * 60 * 60 * 1000;

/**
 * Get tier config from hardcoded defaults
 * Use this when you don't have database access
 */
export function getTierDefaults(tierId: TierId): TierConfig {
  return TIER_DEFAULTS[tierId] ?? TIER_DEFAULTS.free;
}

/**
 * Get memory retention in milliseconds
 */
export function getMemoryRetentionMs(tierId: TierId): number | null {
  const days = TIER_DEFAULTS[tierId]?.memory.retentionDays;
  return days === null || days === undefined ? null : days * DAYS_MS;
}

/**
 * Calculate memory expiry timestamp
 */
export function calculateMemoryExpiry(
  tierId: TierId,
  createdAt: number = Date.now()
): number | null {
  const retentionMs = getMemoryRetentionMs(tierId);
  return retentionMs === null ? null : createdAt + retentionMs;
}

/**
 * Check if a model is available for a tier
 */
export function isModelAvailable(tierId: TierId, modelId: string): boolean {
  return TIER_DEFAULTS[tierId]?.ai.models.includes(modelId) ?? false;
}

/**
 * Check if an AI feature is enabled for a tier
 */
export function isAIFeatureEnabled(
  tierId: TierId,
  feature: keyof TierAIFeatures
): boolean {
  return TIER_DEFAULTS[tierId]?.aiFeatures[feature] ?? false;
}

/**
 * Check if a general feature is enabled for a tier
 */
export function isFeatureEnabled(
  tierId: TierId,
  feature: keyof TierFeaturesConfig
): boolean {
  return TIER_DEFAULTS[tierId]?.features[feature] ?? false;
}

/**
 * Get effective AI config with BYOK overrides applied
 */
export function getEffectiveAIConfig(
  tierId: TierId,
  billingMode: BillingMode
): TierAIConfig {
  const base = TIER_DEFAULTS[tierId]?.ai ?? TIER_DEFAULTS.free.ai;
  if (billingMode === "byok") {
    return { ...base, ...BYOK_OVERRIDES };
  }
  return base;
}

/**
 * Check quota against tier limits
 */
export function checkQuota(
  tierId: TierId,
  category: "ai" | "embeddings" | "projects" | "memory",
  current: number,
  field: string
): { allowed: boolean; limit: number; remaining: number } {
  const tierConfig = TIER_DEFAULTS[tierId] ?? TIER_DEFAULTS.free;
  const config = tierConfig[category] as unknown as Record<string, number | null>;
  const limit = config[field];

  if (limit === null || limit === undefined) {
    return { allowed: true, limit: Infinity, remaining: Infinity };
  }

  const remaining = Math.max(0, limit - current);
  return { allowed: current < limit, limit, remaining };
}

/**
 * Convert database tier config to TierConfig type
 */
export function dbToTierConfig(dbConfig: {
  tier: string;
  name: string;
  description?: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  ai: {
    tokensPerMonth?: number;
    callsPerDay: number;
    concurrentRequests: number;
    models: string[];
  };
  aiFeatures: TierAIFeatures;
  memory: {
    retentionDays?: number;
    maxPerProject: number;
    maxPinned: number;
  };
  embeddings: TierEmbeddingsConfig;
  projects: {
    maxProjects: number;
    maxDocumentsPerProject: number;
    maxEntitiesPerProject: number;
    maxWordsPerMonth?: number;
    storageMB: number;
  };
  collaboration: {
    enabled: boolean;
    maxCollaboratorsPerProject?: number;
  };
  features: TierFeaturesConfig;
}): TierConfig {
  return {
    id: dbConfig.tier as TierId,
    name: dbConfig.name,
    description: dbConfig.description,
    price: {
      monthly: dbConfig.priceMonthlyCents / 100,
      yearly: dbConfig.priceYearlyCents / 100,
    },
    ai: {
      tokensPerMonth: dbConfig.ai.tokensPerMonth ?? null,
      callsPerDay: dbConfig.ai.callsPerDay,
      concurrentRequests: dbConfig.ai.concurrentRequests,
      models: dbConfig.ai.models,
    },
    aiFeatures: dbConfig.aiFeatures,
    memory: {
      retentionDays: dbConfig.memory.retentionDays ?? null,
      maxPerProject: dbConfig.memory.maxPerProject,
      maxPinned: dbConfig.memory.maxPinned,
    },
    embeddings: dbConfig.embeddings,
    projects: {
      maxProjects: dbConfig.projects.maxProjects,
      maxDocumentsPerProject: dbConfig.projects.maxDocumentsPerProject,
      maxEntitiesPerProject: dbConfig.projects.maxEntitiesPerProject,
      maxWordsPerMonth: dbConfig.projects.maxWordsPerMonth ?? null,
      storageMB: dbConfig.projects.storageMB,
    },
    collaboration: {
      enabled: dbConfig.collaboration.enabled,
      maxCollaboratorsPerProject: dbConfig.collaboration.maxCollaboratorsPerProject ?? null,
    },
    features: dbConfig.features,
  };
}

// ============================================================================
// TIER COMPARISON HELPERS
// ============================================================================

/**
 * Get all tiers in upgrade order
 */
export function getTierOrder(): TierId[] {
  return ["free", "pro", "team", "enterprise"];
}

/**
 * Check if tier A is higher than tier B
 */
export function isTierHigher(tierA: TierId, tierB: TierId): boolean {
  const order = getTierOrder();
  return order.indexOf(tierA) > order.indexOf(tierB);
}

/**
 * Get the next tier upgrade option
 */
export function getNextTier(currentTier: TierId): TierId | null {
  const order = getTierOrder();
  const currentIndex = order.indexOf(currentTier);
  if (currentIndex === -1 || currentIndex >= order.length - 1) {
    return null;
  }
  return order[currentIndex + 1];
}
