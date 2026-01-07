/**
 * Layout state management
 * Controls sidebar, AI panel, and view state
 */

import { create } from 'zustand';

export type ViewMode = 'home' | 'project';
export type AIPanelMode = 'hidden' | 'sticky' | 'floating';

interface LayoutState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Current view
  viewMode: ViewMode;
  currentProjectId: string | null;
  enterProject: (projectId: string) => void;
  exitProject: () => void;

  // AI Panel (right side only)
  aiPanelMode: AIPanelMode;
  aiPanelPosition: { x: number; y: number }; // for floating mode
  setAIPanelMode: (mode: AIPanelMode) => void;
  setAIPanelPosition: (pos: { x: number; y: number }) => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  // View
  viewMode: 'home',
  currentProjectId: null,
  enterProject: (projectId) => set({ viewMode: 'project', currentProjectId: projectId }),
  exitProject: () => set({ viewMode: 'home', currentProjectId: null }),

  // AI Panel
  aiPanelMode: 'hidden',
  aiPanelPosition: { x: 0, y: 0 },
  setAIPanelMode: (mode) => set({ aiPanelMode: mode }),
  setAIPanelPosition: (pos) => set({ aiPanelPosition: pos }),
}));
