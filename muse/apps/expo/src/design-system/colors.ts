/**
 * Centralized color palette - light/dark mode support
 * Notion-inspired neutral dark grays
 */
import { notion, entityToNotionColor, type NotionColorName } from '@mythos/theme';

export const palette = {
  // Neutrals
  white: '#ffffff',
  black: '#000000',

  // Grays - Notion-inspired neutral dark tones
  gray: {
    // Light mode
    50: '#ffffff',
    100: '#f7f7f5',    // Notion light bg
    150: '#f1f1ef',    // Notion light surface
    200: '#e8e8e6',    // Notion light hover
    300: '#d4d4d2',    // Notion light active
    400: '#9b9a97',    // Secondary text
    500: '#6b6b6b',    // Muted text
    // Dark mode - Notion colors
    600: '#4a4a4a',    // Dark muted
    700: '#373737',    // Dark active
    750: '#2f2f2f',    // Dark hover
    800: '#252525',    // Dark elevated/menus
    850: '#202020',    // Dark sidebar/panels
    900: '#191919',    // Dark main editor bg
    950: '#121212',    // Dark deepest
  },

  // Accent - Notion blue
  blue: {
    400: '#529cca',    // Notion blue light
    500: '#2eaadc',    // Notion blue
    600: '#0077b5',    // Notion blue dark
  },

  // Entity colors
  purple: { 400: '#a78bfa', 500: '#8b5cf6' },
  green: { 400: '#34d399', 500: '#10b981' },
  amber: { 400: '#fbbf24', 500: '#f59e0b' },
  red: { 400: '#f87171', 500: '#ef4444' },
  cyan: { 400: '#22d3ee', 500: '#06b6d4' },
  orange: { 400: '#fb923c', 500: '#f97316' },
} as const;

export const colors = {
  light: {
    // Backgrounds
    bgApp: palette.gray[50],
    bgSurface: palette.gray[100],
    bgElevated: palette.white,
    bgHover: palette.gray[150],
    bgActive: palette.gray[200],

    // Borders
    border: palette.gray[200],
    borderSubtle: palette.gray[150],

    // Text
    text: '#37352f',                    // Notion dark text
    textSecondary: '#6b6b6b',
    textMuted: palette.gray[400],
    textGhost: '#c7c7c5',

    // Accent
    accent: palette.blue[500],
    accentHover: palette.blue[600],
    accentSubtle: 'rgba(46, 170, 220, 0.1)',

    // Scrollbar - grey in light mode
    scrollbar: '#9b9a97',
    scrollbarHover: '#6b6b6b',

    // Sidebar specific
    sidebarBg: palette.gray[100],
    sidebarBorder: palette.gray[200],
    sidebarItemHover: palette.gray[150],
    sidebarItemActive: palette.gray[200],

    // Editor specific
    editorBg: palette.white,
  },

  dark: {
    // Backgrounds - Notion dark theme
    bgApp: palette.gray[900],           // #191919 - main editor
    bgSurface: palette.gray[850],       // #202020 - sidebar/panels
    bgElevated: palette.gray[800],      // #252525 - menus/dropdowns
    bgHover: palette.gray[750],         // #2f2f2f - hover states
    bgActive: palette.gray[700],        // #373737 - active/pressed

    // Borders - very subtle in Notion
    border: '#2d2d2d',
    borderSubtle: '#252525',

    // Text - Notion uses warm off-whites
    text: '#ffffffcf',                  // ~80% white - primary
    textSecondary: '#ffffff9c',         // ~60% white - secondary
    textMuted: '#ffffff5c',             // ~36% white - muted
    textGhost: '#ffffff3d',             // ~24% white - placeholder

    // Accent
    accent: palette.blue[400],
    accentHover: palette.blue[500],
    accentSubtle: 'rgba(82, 156, 202, 0.15)',

    // Scrollbar - black in dark mode
    scrollbar: '#000000',
    scrollbarHover: '#1a1a1a',

    // Sidebar specific (darker than main content in Notion)
    sidebarBg: palette.gray[850],       // #202020
    sidebarBorder: '#2d2d2d',
    sidebarItemHover: palette.gray[750],
    sidebarItemActive: palette.gray[700],

    // Editor specific (slightly lighter main area)
    editorBg: palette.gray[900],        // #191919
  },
} as const;

/**
 * Entity colors derived from Notion semantic colors (dark mode)
 * Use getEntityColor() for theme-aware colors with override support
 */
export const entityColors = {
  character: notion.dark[entityToNotionColor['character']].text,
  location: notion.dark[entityToNotionColor['location']].text,
  item: notion.dark[entityToNotionColor['item']].text,
  faction: notion.dark[entityToNotionColor['faction']].text,
  magic: notion.dark[entityToNotionColor['magic_system']].text,
  event: notion.dark[entityToNotionColor['event']].text,
  concept: notion.dark[entityToNotionColor['concept']].text,
} as const;

/**
 * Get entity color with theme and override support
 */
export function getEntityColor(
  type: string,
  theme: 'light' | 'dark' = 'dark',
  override?: NotionColorName
): string {
  const colorName = override ?? entityToNotionColor[type] ?? 'gray';
  return notion[theme][colorName].text;
}

/**
 * Get entity background color with theme and override support
 */
export function getEntityBgColor(
  type: string,
  theme: 'light' | 'dark' = 'dark',
  override?: NotionColorName
): string {
  const colorName = override ?? entityToNotionColor[type] ?? 'gray';
  return notion[theme][colorName].bg;
}

// Re-export Notion color utilities for convenience
export { notion, entityToNotionColor, type NotionColorName };

// Status colors (same for both themes)
export const statusColors = {
  success: palette.green[400],
  warning: palette.amber[400],
  error: palette.red[400],
  info: palette.cyan[400],
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof colors.dark;
