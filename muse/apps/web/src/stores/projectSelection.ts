import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { LAST_PROJECT_KEY } from "../constants/storageKeys";

interface ProjectSelectionState {
  selectedProjectId: string | null;
}

interface ProjectSelectionActions {
  setSelectedProjectId: (projectId: string) => void;
  clearSelectedProjectId: () => void;
}

type ProjectSelectionStore = ProjectSelectionState & ProjectSelectionActions;

function readInitialProjectId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(LAST_PROJECT_KEY);
}

function persistProjectId(projectId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  if (projectId) {
    localStorage.setItem(LAST_PROJECT_KEY, projectId);
  } else {
    localStorage.removeItem(LAST_PROJECT_KEY);
  }
}

export const useProjectSelectionStore = create<ProjectSelectionStore>()(
  immer((set) => ({
    selectedProjectId: readInitialProjectId(),
    setSelectedProjectId: (projectId) =>
      set((state) => {
        state.selectedProjectId = projectId;
        persistProjectId(projectId);
      }),
    clearSelectedProjectId: () =>
      set((state) => {
        state.selectedProjectId = null;
        persistProjectId(null);
      }),
  }))
);
