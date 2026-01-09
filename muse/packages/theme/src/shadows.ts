/**
 * Platform-aware Shadow Definitions
 *
 * Provides both React Native shadow properties and CSS box-shadow values.
 */

export interface ShadowDefinition {
  // React Native format
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
  // CSS format (for web)
  boxShadow: string;
}

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    boxShadow: 'none',
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },
  inner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 0,
    boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },
} as const;

export type Shadow = keyof typeof shadows;

/**
 * Get React Native shadow style object
 */
export function getNativeShadow(shadow: Shadow) {
  const { boxShadow, ...native } = shadows[shadow];
  return native;
}

/**
 * Get CSS box-shadow value
 */
export function getWebShadow(shadow: Shadow): string {
  return shadows[shadow].boxShadow;
}
