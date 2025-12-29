/**
 * Navigation Store
 * Handles app-level navigation signals (project switching, new project modal)
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface NavigationState {
  /** Signal to show project selector (clear current project) */
  showProjectSelector: boolean;
  /** Signal to open new project modal from project selector */
  openNewProjectModal: boolean;
}

interface NavigationActions {
  requestProjectSelector: () => void;
  requestNewProject: () => void;
  clearNavigationRequest: () => void;
}

type NavigationStore = NavigationState & NavigationActions;

export const useNavigationStore = create<NavigationStore>()(
  immer((set) => ({
    // Initial state
    showProjectSelector: false,
    openNewProjectModal: false,

    // Actions
    requestProjectSelector: () =>
      set((state) => {
        state.showProjectSelector = true;
      }),

    requestNewProject: () =>
      set((state) => {
        state.showProjectSelector = true;
        state.openNewProjectModal = true;
      }),

    clearNavigationRequest: () =>
      set((state) => {
        state.showProjectSelector = false;
        state.openNewProjectModal = false;
      }),
  }))
);

// Selectors
export const useShowProjectSelector = () =>
  useNavigationStore((s) => s.showProjectSelector);

export const useOpenNewProjectModal = () =>
  useNavigationStore((s) => s.openNewProjectModal);
