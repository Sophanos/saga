/**
 * Core Color Palette
 *
 * Notion-inspired design system with light/dark mode support.
 * Uses warm grays (not cool/blue grays) for a comfortable reading experience.
 */

/**
 * Dark mode colors - Notion-style warm grays
 */
export const dark = {
  bg: {
    primary: "#191919",
    secondary: "#202020",
    tertiary: "#252526",
    hover: "rgba(255,255,255,0.04)",
  },
  text: {
    primary: "#E3E2E0",
    secondary: "#9B9A97",
    muted: "#6B6B64",
  },
  border: {
    default: "rgba(255,255,255,0.08)",
    subtle: "rgba(255,255,255,0.06)",
  },
  scrollbar: {
    thumb: "#000000",
    thumbHover: "#1a1a1a",
  },
} as const;

/**
 * Light mode colors - Notion-style warm whites
 */
export const light = {
  bg: {
    primary: "#FFFFFF",
    secondary: "#F7F6F3",
    tertiary: "#EFEEE9",
    hover: "rgba(0,0,0,0.03)",
  },
  text: {
    primary: "#37352F",
    secondary: "#6B6B64",
    muted: "#9B9A97",
  },
  border: {
    default: "rgba(0,0,0,0.08)",
    subtle: "rgba(0,0,0,0.06)",
  },
  scrollbar: {
    thumb: "#9b9a97",
    thumbHover: "#6b6b6b",
  },
} as const;

/**
 * Current theme colors - defaults to dark mode
 * Components should use these values which map to CSS variables
 */
export const bg = dark.bg;
export const text = dark.text;
export const border = dark.border;

/**
 * Accent colors - UI highlights and interactions
 * Primary accent is Notion's blue
 */
export const accent = {
  // Primary - Notion blue
  primary: "#2383E2",
  primaryHover: "#1a6fc2",
  primaryBg: "rgba(35, 131, 226, 0.15)",
  primaryGlow: "rgba(35, 131, 226, 0.12)",
  // Secondary accents
  cyan: "#22d3ee",
  purple: "#a855f7",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#2383E2",
  pink: "#ec4899",
  orange: "#f97316",
  teal: "#14b8a6",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  yellow: "#facc15",
  lime: "#84cc16",
} as const;

/**
 * Notion semantic colors - for tags, highlights, entity types
 * Each color has text and background variants for light/dark mode
 */
export const notion = {
  light: {
    default: { text: "#373530", bg: "#FFFFFF" },
    gray: { text: "#787774", bg: "#F1F1EF" },
    brown: { text: "#976D57", bg: "#F3EEEE" },
    orange: { text: "#CC782F", bg: "#F8ECDF" },
    yellow: { text: "#C29343", bg: "#FAF3DD" },
    green: { text: "#548164", bg: "#EEF3ED" },
    blue: { text: "#487CA5", bg: "#E9F3F7" },
    purple: { text: "#8A67AB", bg: "#F6F3F8" },
    pink: { text: "#B35488", bg: "#F9F2F5" },
    red: { text: "#C4554D", bg: "#FAECEC" },
  },
  dark: {
    default: { text: "#D4D4D4", bg: "#191919" },
    gray: { text: "#9B9B9B", bg: "#252525" },
    brown: { text: "#A27763", bg: "#2E2724" },
    orange: { text: "#CB7B37", bg: "#36291F" },
    yellow: { text: "#C19138", bg: "#372E20" },
    green: { text: "#4F9768", bg: "#242B26" },
    blue: { text: "#447ACB", bg: "#1F282D" },
    purple: { text: "#865DBB", bg: "#2A2430" },
    pink: { text: "#BA4A78", bg: "#2E2328" },
    red: { text: "#BE524B", bg: "#332523" },
  },
} as const;

export type NotionColorName = keyof typeof notion.light;

/**
 * Entity type to Notion color mapping
 * This is the DEFAULT mapping - entities can override with their own notionColor property
 */
export const entityToNotionColor: Record<string, NotionColorName> = {
  // Core entities
  character: 'blue',
  location: 'green',
  item: 'orange',
  magic_system: 'purple',
  faction: 'pink',
  event: 'red',
  concept: 'yellow',
  // Extended entities - map to closest Notion color
  prophecy: 'purple',
  language: 'green',
  culture: 'pink',
  artifact: 'orange',
  deity: 'yellow',
  spell: 'purple',
  magical_creature: 'blue',
  potion: 'green',
  pc: 'green',
  npc: 'blue',
  monster: 'red',
  quest: 'orange',
  encounter: 'red',
  technique: 'orange',
  arc: 'pink',
  theme: 'purple',
  symbol: 'blue',
  dilemma: 'red',
  technology: 'blue',
  species: 'blue',
  planet: 'green',
  starship: 'purple',
  creature: 'brown',
  curse: 'red',
  relationship_arc: 'pink',
  clue: 'yellow',
  suspect: 'red',
  crime: 'red',
  beat: 'orange',
  scene_entity: 'green',
  power_system: 'orange',
  skill: 'purple',
  route: 'pink',
  choice: 'blue',
  ending: 'green',
};

/**
 * Get Notion color for an entity type
 * @param entityType - The entity type (e.g., 'character', 'location')
 * @param override - Optional override Notion color name
 * @returns The Notion color name
 */
export function getNotionColorForEntity(entityType: string, override?: NotionColorName): NotionColorName {
  return override ?? entityToNotionColor[entityType] ?? 'gray';
}

/**
 * Get entity colors for a given entity type and theme
 * @param entityType - The entity type
 * @param theme - 'light' or 'dark'
 * @param override - Optional override Notion color name
 */
export function getEntityNotionColors(
  entityType: string,
  theme: 'light' | 'dark' = 'dark',
  override?: NotionColorName
): { text: string; bg: string } {
  const colorName = getNotionColorForEntity(entityType, override);
  return notion[theme][colorName];
}

/**
 * Get all entity Notion colors (both themes)
 */
export function getEntityNotionColorsFull(
  entityType: string,
  override?: NotionColorName
): { light: { text: string; bg: string }; dark: { text: string; bg: string } } {
  const colorName = getNotionColorForEntity(entityType, override);
  return {
    light: notion.light[colorName],
    dark: notion.dark[colorName],
  };
}

/**
 * Neutral grays - for reference, prefer using bg/text/border
 */
export const neutral = {
  // Light grays
  50: "#FFFFFF",
  100: "#F7F6F3",
  200: "#EFEEE9",
  300: "#E3E2E0",
  400: "#9B9A97",
  // Dark grays
  500: "#6B6B64",
  600: "#37352F",
  700: "#252526",
  800: "#202020",
  900: "#191919",
  950: "#111111",
} as const;

/**
 * Core entity colors - used for entity highlighting in the editor
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
  light,
  dark,
  bg,
  text,
  border,
  accent,
  neutral,
  notion,
  entity,
  entityExtended,
  entityToNotionColor,
  relationship,
} as const;

export type Colors = typeof colors;
export type BgColor = keyof typeof bg;
export type TextColor = keyof typeof text;
export type BorderColor = keyof typeof border;
export type AccentColor = keyof typeof accent;
export type EntityColor = keyof typeof entity;
export type EntityExtendedColor = keyof typeof entityExtended;
export type RelationshipColor = keyof typeof relationship;
