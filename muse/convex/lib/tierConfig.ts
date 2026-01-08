/**
 * Centralized Tier Configuration
 *
 * Single source of truth for all tier-based limits.
 * Lives in convex/lib/ so it's directly usable by Convex functions.
 *
 * For client-side usage, re-export from packages/tier-config or import directly.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TierId = "free" | "pro" | "team";
export type BillingMode = "byok" | "managed" | "anonymous_trial";

export interface TierConfig {
  id: TierId;
  name: string;
  price: { monthly: number; yearly: number };

  ai: {
    tokensPerMonth: number | null;
    callsPerDay: number;
    concurrentRequests: number;
    models: string[];
  };

  memory: {
    retentionDays: number | null; // null = forever
    maxPerProject: number;
    maxPinned: number;
  };

  embeddings: {
    operationsPerDay: number;
    maxVectorsPerProject: number;
    queuePriority: number;
  };

  projects: {
    maxProjects: number;
    maxDocumentsPerProject: number;
    maxEntitiesPerProject: number;
    storageMB: number;
  };

  features: {
    webSearch: boolean;
    imageGeneration: boolean;
    styleAdaptation: boolean;
    collaboration: boolean;
    prioritySupport: boolean;
    customModels: boolean;
  };
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

const DAYS_MS = 24 * 60 * 60 * 1000;

export const TIERS: Record<TierId, TierConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    ai: {
      tokensPerMonth: 10_000,
      callsPerDay: 20,
      concurrentRequests: 1,
      models: ["google/gemini-2.0-flash-001"],
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
      storageMB: 100,
    },
    features: {
      webSearch: false,
      imageGeneration: false,
      styleAdaptation: false,
      collaboration: false,
      prioritySupport: false,
      customModels: false,
    },
  },

  pro: {
    id: "pro",
    name: "Pro",
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
    memory: {
      retentionDays: null,
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
      storageMB: 2_000,
    },
    features: {
      webSearch: true,
      imageGeneration: true,
      styleAdaptation: true,
      collaboration: false,
      prioritySupport: false,
      customModels: true,
    },
  },

  team: {
    id: "team",
    name: "Team",
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
    memory: {
      retentionDays: null,
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
      storageMB: 10_000,
    },
    features: {
      webSearch: true,
      imageGeneration: true,
      styleAdaptation: true,
      collaboration: true,
      prioritySupport: true,
      customModels: true,
    },
  },
};

// ============================================================================
// BYOK OVERRIDES
// ============================================================================

export const BYOK_OVERRIDES: Partial<TierConfig["ai"]> = {
  tokensPerMonth: null,
  callsPerDay: 10_000,
  concurrentRequests: 10,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTierConfig(tierId: TierId): TierConfig {
  return TIERS[tierId];
}

export function getMemoryRetentionMs(tierId: TierId): number | null {
  const days = TIERS[tierId].memory.retentionDays;
  return days === null ? null : days * DAYS_MS;
}

export function calculateMemoryExpiry(
  tierId: TierId,
  createdAt: number = Date.now()
): number | null {
  const retentionMs = getMemoryRetentionMs(tierId);
  return retentionMs === null ? null : createdAt + retentionMs;
}

export function isModelAvailable(tierId: TierId, modelId: string): boolean {
  return TIERS[tierId].ai.models.includes(modelId);
}

export function isFeatureEnabled(
  tierId: TierId,
  feature: keyof TierConfig["features"]
): boolean {
  return TIERS[tierId].features[feature];
}

export function getEffectiveAIConfig(
  tierId: TierId,
  billingMode: BillingMode
): TierConfig["ai"] {
  const base = TIERS[tierId].ai;
  if (billingMode === "byok") {
    return { ...base, ...BYOK_OVERRIDES };
  }
  return base;
}

export function checkQuota(
  tierId: TierId,
  category: "ai" | "embeddings" | "projects" | "memory",
  current: number,
  field: string
): { allowed: boolean; limit: number; remaining: number } {
  const config = TIERS[tierId][category] as Record<string, number | null>;
  const limit = config[field];

  if (limit === null) {
    return { allowed: true, limit: Infinity, remaining: Infinity };
  }

  const remaining = Math.max(0, limit - current);
  return { allowed: current < limit, limit, remaining };
}
