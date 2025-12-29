/**
 * Spacing Design Tokens
 *
 * Consistent spacing scale for margins, paddings, and gaps.
 * Based on a 4px base unit (Tailwind default).
 */

/**
 * Base spacing unit in pixels
 */
export const SPACING_UNIT = 4;

/**
 * Spacing scale (multipliers of the base unit)
 * Values are in rem for responsive sizing
 */
export const spacing = {
  0: "0",
  px: "1px",
  0.5: "0.125rem", // 2px
  1: "0.25rem", // 4px
  1.5: "0.375rem", // 6px
  2: "0.5rem", // 8px
  2.5: "0.625rem", // 10px
  3: "0.75rem", // 12px
  3.5: "0.875rem", // 14px
  4: "1rem", // 16px
  5: "1.25rem", // 20px
  6: "1.5rem", // 24px
  7: "1.75rem", // 28px
  8: "2rem", // 32px
  9: "2.25rem", // 36px
  10: "2.5rem", // 40px
  11: "2.75rem", // 44px
  12: "3rem", // 48px
  14: "3.5rem", // 56px
  16: "4rem", // 64px
  20: "5rem", // 80px
  24: "6rem", // 96px
  28: "7rem", // 112px
  32: "8rem", // 128px
  36: "9rem", // 144px
  40: "10rem", // 160px
  44: "11rem", // 176px
  48: "12rem", // 192px
  52: "13rem", // 208px
  56: "14rem", // 224px
  60: "15rem", // 240px
  64: "16rem", // 256px
  72: "18rem", // 288px
  80: "20rem", // 320px
  96: "24rem", // 384px
} as const;

/**
 * Semantic spacing for common UI patterns
 */
export const semanticSpacing = {
  /** Tight spacing for compact UI elements */
  xs: spacing[1], // 4px
  /** Small spacing for related elements */
  sm: spacing[2], // 8px
  /** Default spacing for most elements */
  md: spacing[4], // 16px
  /** Larger spacing for section separation */
  lg: spacing[6], // 24px
  /** Extra large spacing for major sections */
  xl: spacing[8], // 32px
  /** Maximum spacing for page sections */
  "2xl": spacing[12], // 48px
} as const;

/**
 * Container max widths
 */
export const maxWidth = {
  none: "none",
  xs: "20rem", // 320px
  sm: "24rem", // 384px
  md: "28rem", // 448px
  lg: "32rem", // 512px
  xl: "36rem", // 576px
  "2xl": "42rem", // 672px
  "3xl": "48rem", // 768px
  "4xl": "56rem", // 896px
  "5xl": "64rem", // 1024px
  "6xl": "72rem", // 1152px
  "7xl": "80rem", // 1280px
  full: "100%",
  prose: "65ch",
  screen: "100vw",
} as const;

/**
 * Border radius values
 */
export const borderRadius = {
  none: "0",
  sm: "0.125rem", // 2px
  DEFAULT: "0.25rem", // 4px
  md: "0.375rem", // 6px
  lg: "0.5rem", // 8px
  xl: "0.75rem", // 12px
  "2xl": "1rem", // 16px
  "3xl": "1.5rem", // 24px
  full: "9999px",
} as const;

/**
 * Border widths
 */
export const borderWidth = {
  0: "0",
  DEFAULT: "1px",
  2: "2px",
  4: "4px",
  8: "8px",
} as const;

/**
 * Z-index layers
 */
export const zIndex = {
  auto: "auto",
  0: "0",
  10: "10",
  20: "20",
  30: "30",
  40: "40",
  50: "50",
  dropdown: "100",
  sticky: "200",
  overlay: "300",
  modal: "400",
  popover: "500",
  tooltip: "600",
  toast: "700",
} as const;

export type Spacing = keyof typeof spacing;
export type SemanticSpacing = keyof typeof semanticSpacing;
export type MaxWidth = keyof typeof maxWidth;
export type BorderRadius = keyof typeof borderRadius;
export type BorderWidth = keyof typeof borderWidth;
export type ZIndex = keyof typeof zIndex;