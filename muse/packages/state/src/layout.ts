/**
 * Layout Store - Platform-agnostic layout state management
 * Handles sidebar, panels, and view modes
 */

import { create } from 'zustand';

// Layout sizing constants (in pixels)
export const LAYOUT_SIZING = {
  sidebarDefault: 260,
  sidebarCollapsed: 60,
  sidebarMin: 200,
  sidebarMax: 400,
  aiPanelDefault: 380,
  aiPanelFloating: 420,
  aiPanelMin: 320,
  aiPanelMax: 600,
  headerHeight: 48,
  bottomBarHeight: 56,
} as const;

export type ViewMode = 'home' | 'project';
export type AIPanelMode = 'hidden' | 'side' | 'floating' | 'full';

interface LayoutState {
  // Sidebar
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;

  // View
  viewMode: ViewMode;
  currentProjectId: string | null;
  enterProject: (projectId: string) => void;
  exitProject: () => void;

  // AI Panel - three modes: side (docked), floating (overlay), full (main area)
  aiPanelMode: AIPanelMode;
  aiPanelWidth: number;
  aiPanelPosition: { x: number; y: number };
  setAIPanelMode: (mode: AIPanelMode) => void;
  setAIPanelWidth: (width: number) => void;
  setAIPanelPosition: (pos: { x: number; y: number }) => void;
  toggleAIPanel: () => void;
  cycleAIPanelMode: () => void;
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarWidth: LAYOUT_SIZING.sidebarDefault,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarWidth: (width) => set({
    sidebarWidth: Math.max(LAYOUT_SIZING.sidebarMin, Math.min(LAYOUT_SIZING.sidebarMax, width)),
  }),

  viewMode: 'home',
  currentProjectId: null,
  enterProject: (projectId) => set({ viewMode: 'project', currentProjectId: projectId }),
  exitProject: () => set({ viewMode: 'home', currentProjectId: null }),

  aiPanelMode: 'side',
  aiPanelWidth: LAYOUT_SIZING.aiPanelDefault,
  aiPanelPosition: { x: 0, y: 0 },
  setAIPanelMode: (mode) => set({ aiPanelMode: mode }),
  setAIPanelWidth: (width) => set({
    aiPanelWidth: Math.max(LAYOUT_SIZING.aiPanelMin, Math.min(LAYOUT_SIZING.aiPanelMax, width)),
  }),
  setAIPanelPosition: (pos) => set({ aiPanelPosition: pos }),
  toggleAIPanel: () => {
    const current = get().aiPanelMode;
    set({ aiPanelMode: current === 'hidden' ? 'side' : 'hidden' });
  },
  cycleAIPanelMode: () => {
    const modes: AIPanelMode[] = ['side', 'floating', 'full'];
    const current = get().aiPanelMode;
    const idx = modes.indexOf(current);
    const next = modes[(idx + 1) % modes.length];
    set({ aiPanelMode: next });
  },
}));

// Selectors
export const useSidebarCollapsed = () => useLayoutStore((s) => s.sidebarCollapsed);
export const useSidebarWidth = () => useLayoutStore((s) => s.sidebarWidth);
export const useViewMode = () => useLayoutStore((s) => s.viewMode);
export const useCurrentProjectId = () => useLayoutStore((s) => s.currentProjectId);
export const useAIPanelMode = () => useLayoutStore((s) => s.aiPanelMode);
export const useAIPanelWidth = () => useLayoutStore((s) => s.aiPanelWidth);
