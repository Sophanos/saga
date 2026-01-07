/**
 * Centralized color palette - light/dark mode support
 * All colors in one place, nothing hardcoded elsewhere
 */

export const palette = {
  // Neutrals
  white: '#ffffff',
  black: '#000000',

  // Grays (dark mode primary)
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    850: '#1f1f23',
    900: '#18181b',
    950: '#0f0f10',
  },

  // Accent
  blue: {
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
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
    bgApp: palette.white,
    bgSurface: palette.gray[50],
    bgElevated: palette.white,
    bgHover: palette.gray[100],
    bgActive: palette.gray[200],

    // Borders
    border: palette.gray[200],
    borderSubtle: palette.gray[100],

    // Text
    text: palette.gray[900],
    textSecondary: palette.gray[600],
    textMuted: palette.gray[400],

    // Accent
    accent: palette.blue[600],
    accentHover: palette.blue[500],

    // Sidebar specific
    sidebarBg: palette.gray[50],
    sidebarBorder: palette.gray[200],
    sidebarItemHover: palette.gray[100],
    sidebarItemActive: palette.gray[200],
  },

  dark: {
    // Backgrounds
    bgApp: palette.gray[950],
    bgSurface: palette.gray[900],
    bgElevated: palette.gray[850],
    bgHover: palette.gray[800],
    bgActive: palette.gray[700],

    // Borders
    border: palette.gray[800],
    borderSubtle: palette.gray[850],

    // Text
    text: palette.gray[50],
    textSecondary: palette.gray[400],
    textMuted: palette.gray[600],

    // Accent
    accent: palette.blue[400],
    accentHover: palette.blue[500],

    // Sidebar specific
    sidebarBg: palette.gray[900],
    sidebarBorder: palette.gray[800],
    sidebarItemHover: palette.gray[800],
    sidebarItemActive: palette.gray[700],
  },
} as const;

// Entity colors (same for both themes)
export const entityColors = {
  character: palette.purple[400],
  location: palette.green[400],
  item: palette.amber[400],
  faction: palette.red[400],
  magic: palette.cyan[400],
  event: palette.orange[400],
  concept: palette.blue[400],
} as const;

// Status colors (same for both themes)
export const statusColors = {
  success: palette.green[400],
  warning: palette.amber[400],
  error: palette.red[400],
  info: palette.cyan[400],
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof colors.dark;
