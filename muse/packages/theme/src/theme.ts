/**
 * Theme Hook Utilities
 *
 * Provides getTheme() for platform-specific theme hook implementations.
 * Apps should import getTheme and create their own useTheme hook with
 * platform-specific color scheme detection.
 */

import { light, dark, accent, entity, entityExtended, relationship } from './colors';
import { spacing, borderRadius, zIndex } from './spacing';
import { typography, fontFamily, fontSize, fontWeight, lineHeight } from './typography';
import { shadows } from './shadows';

export type ColorScheme = 'light' | 'dark';

type ThemeColors = typeof dark | typeof light;

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  accent: typeof accent;
  entity: typeof entity;
  entityExtended: typeof entityExtended;
  relationship: typeof relationship;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  zIndex: typeof zIndex;
  typography: typeof typography;
  fontFamily: typeof fontFamily;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  shadows: typeof shadows;
}

/**
 * Get theme object for a given color scheme.
 * Use this in platform-specific useTheme hooks.
 *
 * @example
 * // apps/expo - React Native
 * import { useColorScheme } from 'react-native';
 * import { getTheme } from '@mythos/theme';
 *
 * export function useTheme() {
 *   const colorScheme = useColorScheme() ?? 'dark';
 *   return getTheme(colorScheme);
 * }
 *
 * @example
 * // apps/tauri - Web
 * import { getTheme } from '@mythos/theme';
 *
 * export function useTheme() {
 *   const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
 *
 *   useEffect(() => {
 *     const mq = window.matchMedia('(prefers-color-scheme: dark)');
 *     setColorScheme(mq.matches ? 'dark' : 'light');
 *     mq.addEventListener('change', (e) => setColorScheme(e.matches ? 'dark' : 'light'));
 *   }, []);
 *
 *   return getTheme(colorScheme);
 * }
 */
export function getTheme(colorScheme: ColorScheme): Theme {
  const isDark = colorScheme === 'dark';
  const colors = isDark ? dark : light;

  return {
    colors,
    isDark,
    accent,
    entity,
    entityExtended,
    relationship,
    spacing,
    borderRadius,
    zIndex,
    typography,
    fontFamily,
    fontSize,
    fontWeight,
    lineHeight,
    shadows,
  };
}
