/**
 * @mythos/tier-config
 *
 * Re-exports tier configuration from convex/lib/tierConfig.ts
 * This allows both Convex functions and client code to use the same config.
 *
 * Convex functions: import directly from '../lib/tierConfig'
 * Client code: import from '@mythos/tier-config'
 */

export {
  // Types
  type TierId,
  type BillingMode,
  type TierConfig,
  // Config
  TIERS,
  BYOK_OVERRIDES,
  // Functions
  getTierConfig,
  getMemoryRetentionMs,
  calculateMemoryExpiry,
  isModelAvailable,
  isFeatureEnabled,
  getEffectiveAIConfig,
  checkQuota,
} from "../../convex/lib/tierConfig";
