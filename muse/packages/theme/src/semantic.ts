/**
 * Semantic Design Tokens
 *
 * Higher-level tokens for entity colors, severity indicators,
 * and status colors used throughout the application.
 */

import { accent, entity, entityExtended, relationship, text } from "./colors";

// ============================================================================
// SEVERITY COLORS
// ============================================================================

/**
 * Severity levels for linter issues and alerts
 */
export const severity = {
  error: {
    color: accent.red,
    bg: `${accent.red}1a`, // 10% opacity
    border: accent.red,
    text: accent.red,
  },
  warning: {
    color: accent.amber,
    bg: `${accent.amber}1a`, // 10% opacity
    border: accent.amber,
    text: accent.amber,
  },
  info: {
    color: accent.cyan,
    bg: `${accent.cyan}1a`, // 10% opacity
    border: accent.cyan,
    text: accent.cyan,
  },
  success: {
    color: accent.green,
    bg: `${accent.green}1a`, // 10% opacity
    border: accent.green,
    text: accent.green,
  },
} as const;

/**
 * Get severity color by level name
 */
export function getSeverityColor(level: keyof typeof severity) {
  return severity[level];
}

// ============================================================================
// TENSION COLORS (for dynamics graphs)
// ============================================================================

/**
 * Tension level colors for story dynamics visualization
 */
export const tension = {
  low: {
    fill: accent.green,
    stroke: accent.green,
  },
  medium: {
    fill: accent.amber,
    stroke: accent.amber,
  },
  high: {
    fill: accent.red,
    stroke: accent.red,
  },
} as const;

/**
 * Get tension color based on numeric value (0-100)
 */
export function getTensionColor(value: number): (typeof tension)[keyof typeof tension] {
  if (value < 33) return tension.low;
  if (value < 66) return tension.medium;
  return tension.high;
}

// ============================================================================
// ENTITY COLORS
// ============================================================================

/**
 * Core entity colors for editor highlighting
 * These match the Tailwind entity classes
 */
export const coreEntityColors = entity;

/**
 * All entity kind colors from templates
 */
export const allEntityColors = entityExtended;

/**
 * Get entity color by kind
 * Falls back to muted text color if kind is unknown
 */
export function getEntityColor(kind: string): string {
  if (kind in entityExtended) {
    return entityExtended[kind as keyof typeof entityExtended];
  }
  // Check core entities as fallback
  if (kind in entity) {
    return entity[kind as keyof typeof entity];
  }
  return text.muted;
}

/**
 * Get entity color with opacity for backgrounds
 */
export function getEntityBgColor(kind: string, opacity: number = 0.1): string {
  const color = getEntityColor(kind);
  // Convert opacity to hex (0.1 = 1a, 0.2 = 33, etc.)
  const hexOpacity = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, "0");
  return `${color}${hexOpacity}`;
}

// ============================================================================
// RELATIONSHIP COLORS
// ============================================================================

/**
 * Relationship category colors
 */
export const relationshipColors = relationship;

/**
 * Get relationship color by category
 */
export function getRelationshipColor(category: string): string {
  if (category in relationship) {
    return relationship[category as keyof typeof relationship];
  }
  return text.muted;
}

// ============================================================================
// STATUS COLORS
// ============================================================================

/**
 * Status indicator colors
 */
export const status = {
  active: accent.green,
  inactive: text.muted,
  pending: accent.amber,
  error: accent.red,
  success: accent.green,
  loading: accent.cyan,
} as const;

/**
 * Character/entity status colors (alive, dead, etc.)
 */
export const entityStatus = {
  alive: accent.green,
  dead: text.muted,
  missing: accent.amber,
  unknown: text.secondary,
  injured: accent.orange,
  transformed: accent.purple,
} as const;

// ============================================================================
// ROLE COLORS
// ============================================================================

/**
 * Character role colors from templates
 */
export const characterRole = {
  protagonist: accent.green,
  antagonist: accent.red,
  deuteragonist: accent.blue,
  supporting: accent.purple,
  minor: text.muted,
} as const;

/**
 * Rarity/tier colors for items
 */
export const rarity = {
  common: text.muted,
  uncommon: accent.green,
  rare: accent.blue,
  legendary: accent.purple,
  unique: accent.amber,
} as const;

// ============================================================================
// UI SEMANTIC COLORS
// ============================================================================

/**
 * Interactive element colors
 */
export const interactive = {
  primary: accent.cyan,
  secondary: accent.purple,
  destructive: accent.red,
  ghost: "transparent",
  muted: text.muted,
} as const;

/**
 * Border colors for UI elements
 */
export const border = {
  default: `${text.muted}33`, // 20% opacity
  focus: accent.cyan,
  error: accent.red,
  success: accent.green,
} as const;

/**
 * Selection and highlight colors
 */
export const selection = {
  bg: `${accent.cyan}4d`, // 30% opacity
  text: text.primary,
} as const;

/**
 * Export all semantic tokens
 */
export const semantic = {
  severity,
  tension,
  entity: coreEntityColors,
  entityExtended: allEntityColors,
  relationship: relationshipColors,
  status,
  entityStatus,
  characterRole,
  rarity,
  interactive,
  border,
  selection,
} as const;

export type Severity = keyof typeof severity;
export type Tension = keyof typeof tension;
export type Status = keyof typeof status;
export type EntityStatus = keyof typeof entityStatus;
export type CharacterRole = keyof typeof characterRole;
export type Rarity = keyof typeof rarity;