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
  getTierDefaults,
  getMemoryRetentionMs,
  calculateMemoryExpiry,
  isModelAvailable,
  isAIFeatureEnabled,
  isFeatureEnabled,
  getEffectiveAIConfig,
  checkQuota,
  dbToTierConfig,
  getTierOrder,
  isTierHigher,
  getNextTier,
} from "../../../convex/lib/tierConfig";

export { getTierDefaults as getTierConfig } from "../../../convex/lib/tierConfig";
