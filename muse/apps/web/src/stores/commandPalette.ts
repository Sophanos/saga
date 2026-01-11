import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// Filter categories for the command palette
export type CommandPaletteFilter =
  | "all"
  | "entity"
  | "ai"
  | "widget"
  | "navigation"
  | "general";

const FILTER_ORDER: CommandPaletteFilter[] = [
  "all",
  "entity",
  "ai",
  "widget",
  "navigation",
  "general",
];

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  filter: CommandPaletteFilter;
  expanded: boolean;
  recentByProjectId: Record<string, string[]>;
  legacyRecentCommandIds?: string[];
}

interface CommandPaletteActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setFilter: (filter: CommandPaletteFilter) => void;
  cycleFilter: (direction: 1 | -1) => void;
  setExpanded: (expanded: boolean) => void;
  addRecentCommand: (projectId: string, id: string) => void;
  getRecentCommandIds: (projectId: string | null | undefined) => string[];
  reset: () => void;
}

type CommandPaletteStore = CommandPaletteState & CommandPaletteActions;

const initialState: CommandPaletteState = {
  isOpen: false,
  query: "",
  filter: "all",
  expanded: false,
  recentByProjectId: {},
  legacyRecentCommandIds: undefined,
};

export const useCommandPaletteStore = create<CommandPaletteStore>()(
  persist(
    immer((set, get) => ({
      ...initialState,

      open: () =>
        set((state) => {
          state.isOpen = true;
        }),

      close: () =>
        set((state) => {
          state.isOpen = false;
          state.query = "";
          state.filter = "all";
          state.expanded = false;
        }),

      toggle: () =>
        set((state) => {
          if (state.isOpen) {
            state.isOpen = false;
            state.query = "";
            state.filter = "all";
            state.expanded = false;
          } else {
            state.isOpen = true;
          }
        }),

      setQuery: (query) =>
        set((state) => {
          state.query = query;
        }),

      setFilter: (filter) =>
        set((state) => {
          state.filter = filter;
        }),

      cycleFilter: (direction) =>
        set((state) => {
          const currentIndex = FILTER_ORDER.indexOf(state.filter);
          const nextIndex =
            (currentIndex + direction + FILTER_ORDER.length) % FILTER_ORDER.length;
          state.filter = FILTER_ORDER[nextIndex];
        }),

      setExpanded: (expanded) =>
        set((state) => {
          state.expanded = expanded;
        }),

      addRecentCommand: (projectId, id) =>
        set((state) => {
          const key = projectId || "global";
          const existing = state.recentByProjectId[key] ?? [];

          if (existing.length === 0 && state.legacyRecentCommandIds?.length) {
            state.recentByProjectId[key] = state.legacyRecentCommandIds;
            state.legacyRecentCommandIds = [];
          }

          const current = state.recentByProjectId[key] ?? [];
          const filtered = current.filter((rid) => rid !== id);
          state.recentByProjectId[key] = [id, ...filtered].slice(0, 10);
        }),

      getRecentCommandIds: (projectId) => {
        const key = projectId || "global";
        const state = get();
        return state.recentByProjectId[key] ?? state.legacyRecentCommandIds ?? [];
      },

      reset: () =>
        set((state) => {
          state.isOpen = false;
          state.query = "";
          state.filter = "all";
          state.expanded = false;
        }),
    })),
    {
      name: "mythos-command-palette",
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2 && persistedState && typeof persistedState === "object") {
          const legacy = persistedState as CommandPaletteState & {
            recentCommandIds?: string[];
          };
          return {
            ...legacy,
            recentByProjectId: {},
            legacyRecentCommandIds: legacy.recentCommandIds ?? [],
          };
        }
        return persistedState as CommandPaletteState;
      },
      partialize: (state) => ({
        recentByProjectId: state.recentByProjectId,
        legacyRecentCommandIds: state.legacyRecentCommandIds,
      }),
    }
  )
);

// Selectors
export const useCommandPaletteOpen = () =>
  useCommandPaletteStore((s) => s.isOpen);

export const useCommandPaletteQuery = () =>
  useCommandPaletteStore((s) => s.query);

export const useCommandPaletteFilter = () =>
  useCommandPaletteStore((s) => s.filter);

export const useCommandPaletteExpanded = () =>
  useCommandPaletteStore((s) => s.expanded);

export const useRecentCommandIds = (projectId?: string | null) =>
  useCommandPaletteStore((s) =>
    s.getRecentCommandIds(projectId ?? "global")
  );
