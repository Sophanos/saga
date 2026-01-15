/**
 * Theme provider and hook
 * Automatically switches based on system preference
 */

import { useState, useEffect } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { colors, entityColors, statusColors, type ThemeColors } from './colors';
import { spacing, sizing, radii, typography, icons, shadows } from './tokens';

/**
 * Hook to get color scheme with immediate media query updates on web.
 * React Native's useColorScheme on web may have delayed updates,
 * so we use matchMedia listener for instant theme switching.
 */
function useColorSchemeWithListener(): 'light' | 'dark' {
  const rnColorScheme = useColorScheme();

  // On web, use matchMedia for immediate updates
  const [webColorScheme, setWebColorScheme] = useState<'light' | 'dark'>(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return rnColorScheme === 'light' ? 'light' : 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setWebColorScheme(e.matches ? 'dark' : 'light');
    };

    // Set initial value
    setWebColorScheme(mediaQuery.matches ? 'dark' : 'light');

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Use web listener on web, React Native hook on native
  return Platform.OS === 'web' ? webColorScheme : (rnColorScheme === 'light' ? 'light' : 'dark');
}

export function useTheme() {
  const colorScheme = useColorSchemeWithListener();
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
    shadows,
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
    shadows,
  };
}

export type Theme = ReturnType<typeof useTheme>;

// Re-export everything for convenience
export { colors, entityColors, statusColors } from './colors';
export { spacing, sizing, radii, typography, icons, shadows } from './tokens';
