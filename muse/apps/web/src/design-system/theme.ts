/**
 * Theme provider and hook
 * Automatically switches based on system preference
 */

import { useColorScheme } from 'react-native';
import { colors, entityColors, statusColors, type ThemeColors } from './colors';
import { spacing, sizing, radii, typography, icons } from './tokens';

export function useTheme() {
  const colorScheme = useColorScheme() ?? 'dark';
  const themeColors = colors[colorScheme];

  return {
    // Current scheme
    colorScheme,
    isDark: colorScheme === 'dark',

    // Colors
    colors: themeColors,
    entityColors,
    statusColors,

    // Tokens
    spacing,
    sizing,
    radii,
    typography,
    icons,
  };
}

// For static access (non-hook contexts)
export function getTheme(colorScheme: 'light' | 'dark') {
  return {
    colorScheme,
    isDark: colorScheme === 'dark',
    colors: colors[colorScheme],
    entityColors,
    statusColors,
    spacing,
    sizing,
    radii,
    typography,
    icons,
  };
}

export type Theme = ReturnType<typeof useTheme>;

// Re-export everything for convenience
export { colors, entityColors, statusColors } from './colors';
export { spacing, sizing, radii, typography, icons } from './tokens';
