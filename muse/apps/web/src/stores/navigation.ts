/**
 * Navigation Store
 * Handles app-level navigation signals (project switching, new project modal)
 */

import { create } from "zustand";

interface NavigationState {
  /** Signal to show project selector (clear current project) */
  showProjectSelector: boolean;
  /** Signal to open new project modal from project selector */
  openNewProjectModal: boolean;

  // Actions
  requestProjectSelector: () => void;
  requestNewProject: () => void;
  clearNavigationRequest: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  showProjectSelector: false,
  openNewProjectModal: false,

  requestProjectSelector: () => set({ showProjectSelector: true }),
  requestNewProject: () => set({ showProjectSelector: true, openNewProjectModal: true }),
  clearNavigationRequest: () => set({ showProjectSelector: false, openNewProjectModal: false }),
}));
