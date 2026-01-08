import { create } from 'zustand';
import { sizing } from './tokens';

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

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const MIN_AIPANEL_WIDTH = 320;
const MAX_AIPANEL_WIDTH = 600;

export const useLayoutStore = create<LayoutState>((set, get) => ({
  sidebarCollapsed: false,
  sidebarWidth: sizing.sidebarWidth,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setSidebarWidth: (width) => set({
    sidebarWidth: Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width)),
  }),

  viewMode: 'home',
  currentProjectId: null,
  enterProject: (projectId) => set({ viewMode: 'project', currentProjectId: projectId }),
  exitProject: () => set({ viewMode: 'home', currentProjectId: null }),

  aiPanelMode: 'side',
  aiPanelWidth: sizing.rightPanelWidth,
  aiPanelPosition: { x: 0, y: 0 },
  setAIPanelMode: (mode) => set({ aiPanelMode: mode }),
  setAIPanelWidth: (width) => set({
    aiPanelWidth: Math.max(MIN_AIPANEL_WIDTH, Math.min(MAX_AIPANEL_WIDTH, width)),
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

export { MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH, MIN_AIPANEL_WIDTH, MAX_AIPANEL_WIDTH };
