/**
 * Design tokens - spacing, sizing, typography, radii
 * All measurements centralized here
 */

export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
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

  // Bottom bar (mobile)
  bottomBarHeight: 56,

  // Panels
  rightPanelWidth: 380,
  rightPanelFloating: 420,

  // AI Panel specific
  aiPanelMin: 320,
  aiAvatarWelcome: 64,
  aiAvatarMessage: 32,
  aiAvatarFab: 48,
  aiFabSize: 56,

  // Icons
  iconXs: 12,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 28,

  // Inputs
  inputHeight: 36,
  buttonHeight: 32,

  // Touch targets
  minTouchTarget: 44,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  full: 9999,
} as const;

export const typography = {
  // Font families (system defaults, SF on Apple)
  fontSans: 'System',
  fontMono: 'SpaceMono',

  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,

  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,

  // Line heights (multipliers)
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// SF Symbols for iOS/macOS, fallback names for other platforms
export const icons = {
  // Navigation
  home: 'house',
  search: 'magnifyingglass',
  settings: 'gearshape',
  keyboard: 'keyboard',
  newThread: 'plus.bubble',
  collapse: 'sidebar.left',
  chevronRight: 'chevron.right',
  chevronDown: 'chevron.down',

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
  project: 'folder.fill',

  // Actions
  ai: 'bubble.left.and.bubble.right',
  lint: 'checkmark.shield',
  analyze: 'chart.bar',
  world: 'globe',
  add: 'plus',
  close: 'xmark',
  more: 'ellipsis',
  send: 'arrow.up.circle.fill',
} as const;

// Shadows for elevation
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
