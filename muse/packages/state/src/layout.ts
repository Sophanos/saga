/**
 * Layout Store - Platform-agnostic layout state management
 * Handles sidebar, panels, and view modes
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createStorageAdapter } from '@mythos/storage';

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

  // Reset
  reset: () => void;
}

const initialState = {
  sidebarCollapsed: false,
  sidebarWidth: LAYOUT_SIZING.sidebarDefault,
  viewMode: 'home' as ViewMode,
  currentProjectId: null as string | null,
  aiPanelMode: 'side' as AIPanelMode,
  aiPanelWidth: LAYOUT_SIZING.aiPanelDefault,
  aiPanelPosition: { x: 0, y: 0 },
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      ...initialState,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarWidth: (width) => set({
        sidebarWidth: Math.max(LAYOUT_SIZING.sidebarMin, Math.min(LAYOUT_SIZING.sidebarMax, width)),
      }),

      enterProject: (projectId) => set({ viewMode: 'project', currentProjectId: projectId }),
      exitProject: () => set({ viewMode: 'home', currentProjectId: null }),

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

      reset: () => set(initialState),
    }),
    {
      name: 'mythos-layout',
      storage: createJSONStorage(() => createStorageAdapter()),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        aiPanelMode: state.aiPanelMode,
        aiPanelWidth: state.aiPanelWidth,
        aiPanelPosition: state.aiPanelPosition,
      }),
    }
  )
);

// Selectors
export const useSidebarCollapsed = () => useLayoutStore((s) => s.sidebarCollapsed);
export const useSidebarWidth = () => useLayoutStore((s) => s.sidebarWidth);
export const useViewMode = () => useLayoutStore((s) => s.viewMode);
export const useCurrentProjectId = () => useLayoutStore((s) => s.currentProjectId);
export const useAIPanelMode = () => useLayoutStore((s) => s.aiPanelMode);
export const useAIPanelWidth = () => useLayoutStore((s) => s.aiPanelWidth);
