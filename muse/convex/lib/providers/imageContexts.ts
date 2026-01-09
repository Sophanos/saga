/**
 * Image Generation Contexts
 *
 * Context-aware defaults for image generation based on where/how images are used.
 * Determines aspect ratio, style, quality tier, and storage target.
 */

// ============================================================================
// IMAGE QUALITY TIERS
// ============================================================================

export const IMAGE_TIERS = {
  inline: {
    model: "google/gemini-2.0-flash-preview-image-generation",
    provider: "openrouter",
    supportsEditing: false,
    description: "Cheapest - for chat inline images",
    pricePerImage: 0.003,
  },
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
    pricePerImage: 0.01,
  },
  premium: {
    model: "google/gemini-2.0-flash-preview-image-generation",
    provider: "openrouter",
    supportsEditing: false,
    description: "High quality, complex prompts",
    pricePerImage: 0.02,
  },
  ultra: {
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
// STORAGE TARGETS
// ============================================================================

export const IMAGE_STORAGE_TARGETS = ["document", "entity", "project"] as const;
export type ImageStorageTarget = (typeof IMAGE_STORAGE_TARGETS)[number];

// ============================================================================
// IMAGE CONTEXTS
// ============================================================================

export const IMAGE_CONTEXTS = {
  // Editor inline - embedded in chapter/scene text
  inline: {
    description: "Embedded in chapter/scene text",
    defaultAspect: "16:9" as const,
    defaultStyle: "concept_art" as const,
    defaultTier: "inline" as ImageTier,
    storageTarget: "document" as ImageStorageTarget,
  },

  // Character images
  character_portrait: {
    description: "Character profile headshot",
    defaultAspect: "3:4" as const,
    defaultStyle: "portrait_photo" as const,
    defaultTier: "standard" as ImageTier,
    storageTarget: "entity" as ImageStorageTarget,
  },
  character_full: {
    description: "Full character illustration",
    defaultAspect: "2:3" as const,
    defaultStyle: "fantasy_art" as const,
    defaultTier: "premium" as ImageTier,
    storageTarget: "entity" as ImageStorageTarget,
  },

  // Location images
  location_scene: {
    description: "Location/environment scene",
    defaultAspect: "16:9" as const,
    defaultStyle: "concept_art" as const,
    defaultTier: "standard" as ImageTier,
    storageTarget: "entity" as ImageStorageTarget,
  },
  location_map: {
    description: "Area/world map",
    defaultAspect: "1:1" as const,
    defaultStyle: "concept_art" as const,
    defaultTier: "premium" as ImageTier,
    storageTarget: "entity" as ImageStorageTarget,
  },

  // Item images
  item: {
    description: "Object/artifact illustration",
    defaultAspect: "1:1" as const,
    defaultStyle: "concept_art" as const,
    defaultTier: "fast" as ImageTier,
    storageTarget: "entity" as ImageStorageTarget,
  },

  // Faction/organization images
  faction_emblem: {
    description: "Faction emblem/logo",
    defaultAspect: "1:1" as const,
    defaultStyle: "concept_art" as const,
    defaultTier: "standard" as ImageTier,
    storageTarget: "entity" as ImageStorageTarget,
  },

  // Project-level images
  cover: {
    description: "Book/project cover",
    defaultAspect: "2:3" as const,
    defaultStyle: "fantasy_art" as const,
    defaultTier: "ultra" as ImageTier,
    storageTarget: "project" as ImageStorageTarget,
  },
  world_map: {
    description: "Full world map",
    defaultAspect: "4:3" as const,
    defaultStyle: "concept_art" as const,
    defaultTier: "ultra" as ImageTier,
    storageTarget: "project" as ImageStorageTarget,
  },
} as const;

export type ImageContext = keyof typeof IMAGE_CONTEXTS;

export interface ImageContextConfig {
  description: string;
  defaultAspect: AspectRatio;
  defaultStyle: ImageStyle;
  defaultTier: ImageTier;
  storageTarget: ImageStorageTarget;
}

// ============================================================================
// IMAGE STYLES
// ============================================================================

export const IMAGE_STYLES = [
  "fantasy_art",
  "dark_fantasy",
  "high_fantasy",
  "manga",
  "anime",
  "light_novel",
  "visual_novel",
  "realistic",
  "oil_painting",
  "watercolor",
  "concept_art",
  "portrait_photo",
  "sci_fi",
  "horror",
  "romance",
  "noir",
  "comic_book",
  "pixel_art",
  "chibi",
] as const;

export type ImageStyle = (typeof IMAGE_STYLES)[number];

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

export function getContextConfig(context: ImageContext): ImageContextConfig {
  return IMAGE_CONTEXTS[context];
}

export function getTierConfig(tier: ImageTier): ImageTierConfig {
  return IMAGE_TIERS[tier];
}

export function getStylePromptPrefix(style: ImageStyle): string {
  const prefixes: Record<ImageStyle, string> = {
    fantasy_art: "Epic fantasy art style, detailed illustration,",
    dark_fantasy: "Dark fantasy, grimdark aesthetic, gothic atmosphere,",
    high_fantasy: "High fantasy illustration, magical, Tolkien-inspired,",
    manga: "Black and white manga style, expressive lines,",
    anime: "Anime art style, vibrant colors,",
    light_novel: "Light novel illustration style, soft lighting,",
    visual_novel: "Visual novel character portrait, clean lines,",
    realistic: "Photorealistic, highly detailed,",
    oil_painting: "Classical oil painting style, rich textures,",
    watercolor: "Soft watercolor illustration, delicate washes,",
    concept_art: "Professional concept art, game/film design,",
    portrait_photo: "Studio portrait photography, professional lighting,",
    sci_fi: "Science fiction aesthetic, futuristic design,",
    horror: "Dark horror atmosphere, unsettling mood,",
    romance: "Romantic illustration, soft warm lighting,",
    noir: "Film noir style, high contrast, dramatic shadows,",
    comic_book: "Western comic book style, bold colors,",
    pixel_art: "Pixel art style, retro aesthetic,",
    chibi: "Cute chibi style, simplified proportions,",
  };
  return prefixes[style];
}

export interface ImageTierSelectionOptions {
  needsEditing?: boolean;
  quality?: "fast" | "standard" | "high" | "max";
  inline?: boolean;
}

export function selectImageTier(options: ImageTierSelectionOptions): ImageTier {
  if (options.inline) return "inline";
  if (options.needsEditing && options.quality === "max") return "ultra";
  if (options.needsEditing) return "standard";
  if (options.quality === "max") return "ultra";
  if (options.quality === "high") return "premium";
  if (options.quality === "fast") return "fast";
  return "standard";
}

export function getDefaultsForContext(context: ImageContext): {
  aspectRatio: AspectRatio;
  style: ImageStyle;
  tier: ImageTier;
  storageTarget: ImageStorageTarget;
} {
  const config = IMAGE_CONTEXTS[context];
  return {
    aspectRatio: config.defaultAspect,
    style: config.defaultStyle,
    tier: config.defaultTier,
    storageTarget: config.storageTarget,
  };
}

// ============================================================================
// ENTITY TYPE → IMAGE CONTEXT MAPPING
// ============================================================================

export function getImageContextForEntityType(
  entityType: string,
  variant?: "portrait" | "full" | "scene" | "map" | "emblem"
): ImageContext {
  switch (entityType) {
    case "character":
      return variant === "full" ? "character_full" : "character_portrait";
    case "location":
      return variant === "map" ? "location_map" : "location_scene";
    case "item":
      return "item";
    case "faction":
      return "faction_emblem";
    default:
      return "inline";
  }
}
