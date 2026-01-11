/**
 * Project Start Store
 *
 * Coordinates "new project" actions when no project exists.
 * Allows sidebar or header actions to drive the inline start flow.
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

export type ProjectStartAction = "start-blank" | "ai-builder";

interface ProjectStartState {
  requestedAction: ProjectStartAction | null;
}

interface ProjectStartActions {
  requestAction: (action: ProjectStartAction) => void;
  clearAction: () => void;
}

type ProjectStartStore = ProjectStartState & ProjectStartActions;

export const useProjectStartStore = create<ProjectStartStore>()(
  immer((set) => ({
    requestedAction: null,
    requestAction: (action) =>
      set((state) => {
        state.requestedAction = action;
      }),
    clearAction: () =>
      set((state) => {
        state.requestedAction = null;
      }),
  }))
);

export const useRequestedProjectStartAction = () =>
  useProjectStartStore((s) => s.requestedAction);

export const useRequestProjectStartAction = () =>
  useProjectStartStore((s) => s.requestAction);

export const useClearProjectStartAction = () =>
  useProjectStartStore((s) => s.clearAction);
