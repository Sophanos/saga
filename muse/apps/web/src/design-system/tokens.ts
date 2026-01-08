/**
 * Design tokens - spacing, sizing, typography, radii
 * All measurements centralized here
 */

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const sizing = {
  // Sidebar
  sidebarWidth: 260,
  sidebarCollapsed: 60,

  // Header
  headerHeight: 48,

  // Bottom bar
  bottomBarHeight: 56,

  // Panels
  rightPanelWidth: 360,

  // Icons
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,

  // Inputs
  inputHeight: 36,
  buttonHeight: 32,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  // Font families
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: '"SF Mono", "Fira Code", "Fira Mono", monospace',

  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,

  // Font weights
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',

  // Line heights
  tight: 1.25,
  leading: 1.5,
  relaxed: 1.75,
} as const;

// SF Symbols for entities (iOS/macOS)
export const icons = {
  // Navigation
  home: 'house',
  search: 'magnifyingglass',
  settings: 'gearshape',
  keyboard: 'keyboard',
  newThread: 'plus.bubble',
  collapse: 'sidebar.left',

  // Entities
  character: 'person.fill',
  location: 'map.fill',
  item: 'shippingbox.fill',
  faction: 'person.3.fill',
  magic: 'sparkles',
  event: 'calendar',
  concept: 'lightbulb.fill',

  // Documents
  chapter: 'doc.text.fill',
  scene: 'doc.fill',

  // Actions
  ai: 'bubble.left.and.bubble.right',
  lint: 'checkmark.shield',
  analyze: 'chart.bar',
  world: 'globe',
} as const;
