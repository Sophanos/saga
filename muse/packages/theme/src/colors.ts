/**
 * Core Color Palette
 *
 * All color constants for the Mythos IDE design system.
 * These values match the Tailwind configuration in tooling/tailwind/base.config.ts
 */

/**
 * Background colors - dark theme foundation
 */
export const bg = {
  primary: "#0a0a0f",
  secondary: "#12121a",
  tertiary: "#1a1a24",
} as const;

/**
 * Text colors - typography hierarchy
 */
export const text = {
  primary: "#e4e4e7",
  secondary: "#a1a1aa",
  muted: "#71717a",
} as const;

/**
 * Accent colors - UI highlights and interactions
 */
export const accent = {
  cyan: "#22d3ee",
  purple: "#a855f7",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  pink: "#ec4899",
  orange: "#f97316",
  teal: "#14b8a6",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  yellow: "#facc15",
  lime: "#84cc16",
} as const;

/**
 * Neutral grays for borders, dividers, and subtle UI
 */
export const neutral = {
  50: "#fafafa",
  100: "#f4f4f5",
  200: "#e4e4e7",
  300: "#d4d4d8",
  400: "#a1a1aa",
  500: "#71717a",
  600: "#52525b",
  700: "#3f3f46",
  800: "#27272a",
  900: "#18181b",
  950: "#09090b",
} as const;

/**
 * Core entity colors - used for entity highlighting in the editor
 * These are the primary entity types from the Tailwind config
 */
export const entity = {
  character: "#22d3ee",
  location: "#22c55e",
  item: "#f59e0b",
  magic: "#a855f7",
} as const;

/**
 * Extended entity colors - all entity kinds from builtin templates
 */
export const entityExtended = {
  // Core entities
  character: "#60a5fa",
  location: "#22c55e",
  item: "#f59e0b",
  faction: "#a855f7",
  event: "#ec4899",
  concept: "#06b6d4",

  // Fantasy entities
  magic_system: "#8b5cf6",
  prophecy: "#c084fc",
  language: "#14b8a6",
  culture: "#f472b6",
  artifact: "#fbbf24",
  deity: "#facc15",
  spell: "#a855f7",
  magical_creature: "#22d3ee",
  potion: "#84cc16",

  // D&D entities
  pc: "#22c55e",
  npc: "#60a5fa",
  monster: "#ef4444",
  quest: "#f59e0b",
  encounter: "#ef4444",

  // Manga/Anime entities
  technique: "#f97316",
  arc: "#ec4899",

  // Literary entities
  theme: "#8b5cf6",
  symbol: "#06b6d4",
  dilemma: "#ef4444",

  // Sci-Fi entities
  technology: "#3b82f6",
  species: "#22d3ee",
  planet: "#22c55e",
  starship: "#6366f1",

  // Horror entities
  creature: "#7c2d12",
  curse: "#991b1b",

  // Romance entities
  relationship_arc: "#ec4899",

  // Mystery entities
  clue: "#f59e0b",
  suspect: "#ef4444",
  crime: "#991b1b",

  // Screenplay entities
  beat: "#f97316",
  scene_entity: "#22c55e",

  // Webnovel entities
  power_system: "#f97316",
  skill: "#a855f7",

  // Visual Novel entities
  route: "#ec4899",
  choice: "#3b82f6",
  ending: "#22c55e",
} as const;

/**
 * Relationship category colors
 */
export const relationship = {
  familial: "#60a5fa",
  romantic: "#ec4899",
  social: "#6b7280",
  conflict: "#ef4444",
  professional: "#f59e0b",
  spatial: "#22c55e",
  ownership: "#f59e0b",
  magical: "#a855f7",
  mechanical: "#f97316",
  narrative: "#a855f7",
} as const;

/**
 * Complete color palette export
 */
export const colors = {
  bg,
  text,
  accent,
  neutral,
  entity,
  entityExtended,
  relationship,
} as const;

export type Colors = typeof colors;
export type BgColor = keyof typeof bg;
export type TextColor = keyof typeof text;
export type AccentColor = keyof typeof accent;
export type EntityColor = keyof typeof entity;
export type EntityExtendedColor = keyof typeof entityExtended;
export type RelationshipColor = keyof typeof relationship;