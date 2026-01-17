/**
 * Image Generation Configuration
 *
 * Simplified tier-based image generation. Agent decides style/aspect from prompt.
 */

// ============================================================================
// IMAGE QUALITY TIERS (Subscription users - DeepInfra)
// ============================================================================

export const IMAGE_TIERS = {
  fast: {
    model: "black-forest-labs/FLUX-1-schnell",
    provider: "deepinfra",
    supportsEditing: false,
    description: "Fast iterations, drafts",
    pricePerImage: 0.003,
  },
  standard: {
    model: "black-forest-labs/FLUX-1-dev",
    provider: "deepinfra",
    supportsEditing: true,
    description: "Default - good balance",
    pricePerImage: 0.009, // $0.009 × (w/1024) × (h/1024) × (iters/25)
  },
  premium: {
    model: "black-forest-labs/FLUX-1.1-pro",
    provider: "deepinfra",
    supportsEditing: true,
    description: "Maximum quality + editing",
    pricePerImage: 0.04,
  },
} as const;

export type ImageTier = keyof typeof IMAGE_TIERS;

export interface ImageTierConfig {
  model: string;
  provider: string;
  supportsEditing: boolean;
  description: string;
  pricePerImage: number;
}

// ============================================================================
// BYOK DEFAULT (OpenRouter - Gemini)
// ============================================================================

export const BYOK_IMAGE_MODEL = "google/gemini-2.5-flash-image";

// ============================================================================
// ASPECT RATIOS
// ============================================================================

export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// ============================================================================
// EDIT MODES
// ============================================================================

export const EDIT_MODES = ["inpaint", "outpaint", "remix", "style_transfer"] as const;
export type EditMode = (typeof EDIT_MODES)[number];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getTierConfig(tier: ImageTier): ImageTierConfig {
  return IMAGE_TIERS[tier];
}

export function selectImageTier(options: {
  needsEditing?: boolean;
  quality?: "fast" | "standard" | "high";
}): ImageTier {
  if (options.needsEditing && options.quality === "high") return "premium";
  if (options.needsEditing) return "standard";
  if (options.quality === "high") return "premium";
  if (options.quality === "fast") return "fast";
  return "standard";
}
