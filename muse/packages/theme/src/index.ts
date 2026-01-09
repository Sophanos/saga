/**
 * @mythos/theme
 *
 * Centralized design tokens for the Mythos IDE design system.
 * This package provides all color, typography, spacing, and semantic tokens
 * used throughout the application.
 *
 * @example
 * ```ts
 * import { colors, typography, spacing, semantic } from '@mythos/theme';
 *
 * // Use background colors
 * const bgColor = colors.bg.primary;
 *
 * // Use entity colors
 * const characterColor = colors.entity.character;
 *
 * // Use semantic utilities
 * const entityColor = getEntityColor('character');
 * const severityStyle = getSeverityColor('error');
 * ```
 */

// Colors
export {
  colors,
  light,
  dark,
  bg,
  text,
  border,
  accent,
  neutral,
  entity,
  entityExtended,
  relationship,
  type Colors,
  type BgColor,
  type TextColor,
  type BorderColor,
  type AccentColor,
  type EntityColor,
  type EntityExtendedColor,
  type RelationshipColor,
} from "./colors";

// Typography
export {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  typography,
  type FontFamily,
  type FontSize,
  type FontWeight,
  type LineHeight,
  type LetterSpacing,
  type TypographyPreset,
} from "./typography";

// Spacing
export {
  SPACING_UNIT,
  spacing,
  semanticSpacing,
  maxWidth,
  borderRadius,
  borderWidth,
  zIndex,
  type Spacing,
  type SemanticSpacing,
  type MaxWidth,
  type BorderRadius,
  type BorderWidth,
  type ZIndex,
} from "./spacing";

// Semantic tokens
export {
  semantic,
  severity,
  tension,
  coreEntityColors,
  allEntityColors,
  relationshipColors,
  status,
  entityStatus,
  characterRole,
  rarity,
  interactive,
  border as semanticBorder,
  selection,
  // Utility functions
  getSeverityColor,
  getTensionColor,
  getEntityColor,
  getEntityBgColor,
  getRelationshipColor,
  // Types
  type Severity,
  type Tension,
  type Status,
  type EntityStatus,
  type CharacterRole,
  type Rarity,
} from "./semantic";

// Shadows
export {
  shadows,
  getNativeShadow,
  getWebShadow,
  type Shadow,
  type ShadowDefinition,
} from "./shadows";

// Theme utilities
export {
  getTheme,
  type ColorScheme,
  type Theme,
} from "./theme";