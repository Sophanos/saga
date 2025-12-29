import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// Filter categories for the command palette
export type CommandPaletteFilter = "all" | "entity" | "ai" | "navigation" | "general";

const FILTER_ORDER: CommandPaletteFilter[] = ["all", "entity", "ai", "navigation", "general"];

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  filter: CommandPaletteFilter;
  expanded: boolean;
  recentCommandIds: string[];
}

interface CommandPaletteActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setFilter: (filter: CommandPaletteFilter) => void;
  cycleFilter: (direction: 1 | -1) => void;
  setExpanded: (expanded: boolean) => void;
  addRecentCommand: (id: string) => void;
  reset: () => void;
}

type CommandPaletteStore = CommandPaletteState & CommandPaletteActions;

const initialState: CommandPaletteState = {
  isOpen: false,
  query: "",
  filter: "all",
  expanded: false,
  recentCommandIds: [],
};

export const useCommandPaletteStore = create<CommandPaletteStore>()(
  persist(
    immer((set) => ({
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

      addRecentCommand: (id) =>
        set((state) => {
          const filtered = state.recentCommandIds.filter((rid) => rid !== id);
          state.recentCommandIds = [id, ...filtered].slice(0, 10);
        }),

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
      partialize: (state) => ({
        recentCommandIds: state.recentCommandIds,
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

export const useRecentCommandIds = () =>
  useCommandPaletteStore((s) => s.recentCommandIds);
