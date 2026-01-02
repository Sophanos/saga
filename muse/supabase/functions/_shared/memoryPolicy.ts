/**
 * Memory Policy Configuration (MLP 2.x)
 *
 * Configurable TTL and decay policies for memory categories.
 * Enables automatic expiration and score decay for relevance ranking.
 */

// =============================================================================
// Types
// =============================================================================

export interface MemoryCategoryPolicy {
  /** Hard TTL in milliseconds (memory expires after this time) */
  ttlMs?: number;
  /** Half-life in milliseconds for decay curve */
  halfLifeMs?: number;
}

export interface MemoryPolicyConfig {
  decision: MemoryCategoryPolicy;
  style: MemoryCategoryPolicy;
  preference: MemoryCategoryPolicy;
  session: MemoryCategoryPolicy;
}

export interface MemoryPolicyOverrides {
  decision?: Partial<MemoryCategoryPolicy>;
  style?: Partial<MemoryCategoryPolicy>;
  preference?: Partial<MemoryCategoryPolicy>;
  session?: Partial<MemoryCategoryPolicy>;
}

// =============================================================================
// Constants
// =============================================================================

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Default policy configuration.
 * - Decisions: Long-lived canon (6 month half-life, no hard TTL)
 * - Style: Personal preferences (3 month half-life)
 * - Preference: Accept/reject patterns (90 day half-life)
 * - Session: Ephemeral continuity (24 hour TTL)
 */
const DEFAULT_POLICY: MemoryPolicyConfig = {
  decision: {
    halfLifeMs: 180 * MS_PER_DAY, // 6 months
    ttlMs: undefined, // No hard expiration
  },
  style: {
    halfLifeMs: 90 * MS_PER_DAY, // 3 months
    ttlMs: undefined,
  },
  preference: {
    halfLifeMs: 90 * MS_PER_DAY, // 3 months
    ttlMs: undefined,
  },
  session: {
    halfLifeMs: 6 * MS_PER_HOUR, // 6 hours
    ttlMs: 24 * MS_PER_HOUR, // 24 hours hard TTL
  },
};

// =============================================================================
// Configuration Loading
// =============================================================================

/**
 * Parse duration environment variable.
 * Supports: "24h", "7d", "90d", raw milliseconds
 */
function parseDurationEnv(value: string | undefined): number | undefined {
  if (!value) return undefined;

  const trimmed = value.trim().toLowerCase();

  // Raw number (milliseconds)
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Hours: "24h"
  const hoursMatch = trimmed.match(/^(\d+)h$/);
  if (hoursMatch) {
    return parseInt(hoursMatch[1], 10) * MS_PER_HOUR;
  }

  // Days: "7d" or "90d"
  const daysMatch = trimmed.match(/^(\d+)d$/);
  if (daysMatch) {
    return parseInt(daysMatch[1], 10) * MS_PER_DAY;
  }

  console.warn(`[memoryPolicy] Invalid duration format: ${value}`);
  return undefined;
}

/**
 * Get memory policy configuration from environment variables.
 *
 * Environment variables:
 * - MEMORY_SESSION_TTL: TTL for session memories (default: "24h")
 * - MEMORY_SESSION_HALF_LIFE: Half-life for session decay (default: "6h")
 * - MEMORY_STYLE_HALF_LIFE: Half-life for style memories (default: "90d")
 * - MEMORY_PREFERENCE_HALF_LIFE: Half-life for preference memories (default: "90d")
 * - MEMORY_DECISION_HALF_LIFE: Half-life for decision memories (default: "180d")
 */
export function getMemoryPolicyConfig(
  overrides?: MemoryPolicyOverrides
): MemoryPolicyConfig {
  const base: MemoryPolicyConfig = {
    decision: {
      halfLifeMs:
        parseDurationEnv(Deno.env.get("MEMORY_DECISION_HALF_LIFE")) ??
        DEFAULT_POLICY.decision.halfLifeMs,
      ttlMs: parseDurationEnv(Deno.env.get("MEMORY_DECISION_TTL")),
    },
    style: {
      halfLifeMs:
        parseDurationEnv(Deno.env.get("MEMORY_STYLE_HALF_LIFE")) ??
        DEFAULT_POLICY.style.halfLifeMs,
      ttlMs: parseDurationEnv(Deno.env.get("MEMORY_STYLE_TTL")),
    },
    preference: {
      halfLifeMs:
        parseDurationEnv(Deno.env.get("MEMORY_PREFERENCE_HALF_LIFE")) ??
        DEFAULT_POLICY.preference.halfLifeMs,
      ttlMs: parseDurationEnv(Deno.env.get("MEMORY_PREFERENCE_TTL")),
    },
    session: {
      halfLifeMs:
        parseDurationEnv(Deno.env.get("MEMORY_SESSION_HALF_LIFE")) ??
        DEFAULT_POLICY.session.halfLifeMs,
      ttlMs:
        parseDurationEnv(Deno.env.get("MEMORY_SESSION_TTL")) ??
        DEFAULT_POLICY.session.ttlMs,
    },
  };

  if (!overrides) {
    return base;
  }

  return {
    decision: { ...base.decision, ...overrides.decision },
    style: { ...base.style, ...overrides.style },
    preference: { ...base.preference, ...overrides.preference },
    session: { ...base.session, ...overrides.session },
  };
}

// =============================================================================
// Expiration Logic
// =============================================================================

/**
 * Check if a memory is expired based on policy.
 *
 * @param params.category - Memory category
 * @param params.createdAtTs - Creation timestamp in milliseconds
 * @param params.expiresAtTs - Explicit expiration timestamp (optional)
 * @param params.nowMs - Current time in milliseconds
 * @param params.policy - Category policy
 */
export function isExpired(params: {
  category: string;
  createdAtTs: number;
  expiresAtTs?: number | null;
  nowMs: number;
  policy: MemoryCategoryPolicy;
}): boolean {
  const { createdAtTs, expiresAtTs, nowMs, policy } = params;

  // Explicit expiration takes precedence
  if (expiresAtTs && nowMs >= expiresAtTs) {
    return true;
  }

  // Check policy TTL
  if (policy.ttlMs && nowMs - createdAtTs >= policy.ttlMs) {
    return true;
  }

  return false;
}

/**
 * Check if a memory is expired using category name.
 */
export function isMemoryExpired(params: {
  category: string;
  createdAtTs: number;
  expiresAtTs?: number | null;
  nowMs?: number;
  overrides?: MemoryPolicyOverrides;
}): boolean {
  const config = getMemoryPolicyConfig(params.overrides);
  const policy =
    config[params.category as keyof MemoryPolicyConfig] ?? DEFAULT_POLICY.preference;

  return isExpired({
    ...params,
    nowMs: params.nowMs ?? Date.now(),
    policy,
  });
}

// =============================================================================
// Decay Scoring
// =============================================================================

/**
 * Calculate decay factor based on age and half-life.
 * Uses exponential decay: factor = 0.5 ^ (age / halfLife)
 *
 * @param ageMs - Age in milliseconds
 * @param halfLifeMs - Half-life in milliseconds
 * @returns Decay factor between 0 and 1
 */
function calculateDecayFactor(ageMs: number, halfLifeMs: number): number {
  if (ageMs <= 0) return 1.0;
  if (halfLifeMs <= 0) return 1.0;

  return Math.pow(0.5, ageMs / halfLifeMs);
}

/**
 * Apply decay to a score based on memory age and policy.
 *
 * @param params.baseScore - Original score (e.g., from semantic search)
 * @param params.createdAtTs - Creation timestamp in milliseconds
 * @param params.nowMs - Current time in milliseconds
 * @param params.policy - Category policy
 * @returns Decayed score
 */
export function decayScore(params: {
  baseScore: number;
  createdAtTs: number;
  nowMs: number;
  policy: MemoryCategoryPolicy;
}): number {
  const { baseScore, createdAtTs, nowMs, policy } = params;

  if (!policy.halfLifeMs) {
    return baseScore; // No decay configured
  }

  const ageMs = nowMs - createdAtTs;
  const decayFactor = calculateDecayFactor(ageMs, policy.halfLifeMs);

  return baseScore * decayFactor;
}

/**
 * Apply decay to a score using category name.
 */
export function decayMemoryScore(params: {
  category: string;
  baseScore: number;
  createdAtTs: number;
  nowMs?: number;
  overrides?: MemoryPolicyOverrides;
}): number {
  const config = getMemoryPolicyConfig(params.overrides);
  const policy =
    config[params.category as keyof MemoryPolicyConfig] ?? DEFAULT_POLICY.preference;

  return decayScore({
    baseScore: params.baseScore,
    createdAtTs: params.createdAtTs,
    nowMs: params.nowMs ?? Date.now(),
    policy,
  });
}

/**
 * Calculate combined score with semantic similarity and decay.
 *
 * @param params.similarityScore - Semantic similarity score (0-1)
 * @param params.createdAtTs - Creation timestamp in milliseconds
 * @param params.category - Memory category
 * @param params.similarityWeight - Weight for similarity (0-1, default 0.8)
 * @param params.nowMs - Current time
 */
export function calculateCombinedScore(params: {
  similarityScore: number;
  createdAtTs: number;
  category: string;
  similarityWeight?: number;
  nowMs?: number;
  overrides?: MemoryPolicyOverrides;
}): number {
  const {
    similarityScore,
    createdAtTs,
    category,
    similarityWeight = 0.8,
    nowMs = Date.now(),
  } = params;

  const config = getMemoryPolicyConfig(params.overrides);
  const policy =
    config[category as keyof MemoryPolicyConfig] ?? DEFAULT_POLICY.preference;

  const decayFactor = policy.halfLifeMs
    ? calculateDecayFactor(nowMs - createdAtTs, policy.halfLifeMs)
    : 1.0;

  // Blend similarity and recency
  return similarityScore * similarityWeight + decayFactor * (1 - similarityWeight);
}

// =============================================================================
// TTL Calculation
// =============================================================================

/**
 * Calculate expiration timestamp for a new memory.
 *
 * @param category - Memory category
 * @param ttlMinutesOverride - Optional TTL override in minutes
 * @returns Expiration timestamp in milliseconds, or undefined if no TTL
 */
export function calculateExpiresAtTs(
  category: string,
  ttlMinutesOverride?: number,
  overrides?: MemoryPolicyOverrides
): number | undefined {
  // Override takes precedence
  if (ttlMinutesOverride !== undefined) {
    return Date.now() + ttlMinutesOverride * 60 * 1000;
  }

  const config = getMemoryPolicyConfig(overrides);
  const policy =
    config[category as keyof MemoryPolicyConfig] ?? DEFAULT_POLICY.preference;

  if (policy.ttlMs) {
    return Date.now() + policy.ttlMs;
  }

  return undefined;
}

/**
 * Calculate expiration ISO string for a new memory.
 */
export function calculateExpiresAt(
  category: string,
  ttlMinutesOverride?: number,
  overrides?: MemoryPolicyOverrides
): string | undefined {
  const ts = calculateExpiresAtTs(category, ttlMinutesOverride, overrides);
  return ts ? new Date(ts).toISOString() : undefined;
}
