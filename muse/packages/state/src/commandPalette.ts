/**
 * Command Palette Store - UI state for command palette
 */

import { create } from 'zustand';

// Command categories
export type CommandCategory = 'entity' | 'ai' | 'navigation' | 'general';
export type CommandFilter = 'all' | CommandCategory;

const FILTER_ORDER: CommandFilter[] = ['all', 'entity', 'ai', 'navigation', 'general'];

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  filter: CommandFilter;
  recentIds: string[];
}

interface CommandPaletteActions {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  setFilter: (filter: CommandFilter) => void;
  cycleFilter: (direction: 1 | -1) => void;
  addRecent: (id: string) => void;
}

type CommandPaletteStore = CommandPaletteState & CommandPaletteActions;

export const useCommandPaletteStore = create<CommandPaletteStore>()((set, get) => ({
  isOpen: false,
  query: '',
  filter: 'all',
  recentIds: [],

  open: () => set({ isOpen: true }),

  close: () => set({ isOpen: false, query: '', filter: 'all' }),

  toggle: () => {
    const { isOpen } = get();
    if (isOpen) {
      set({ isOpen: false, query: '', filter: 'all' });
    } else {
      set({ isOpen: true });
    }
  },

  setQuery: (query) => set({ query }),

  setFilter: (filter) => set({ filter }),

  cycleFilter: (direction) => {
    const { filter } = get();
    const idx = FILTER_ORDER.indexOf(filter);
    const next = (idx + direction + FILTER_ORDER.length) % FILTER_ORDER.length;
    set({ filter: FILTER_ORDER[next] });
  },

  addRecent: (id) => {
    const { recentIds } = get();
    const filtered = recentIds.filter((r) => r !== id);
    set({ recentIds: [id, ...filtered].slice(0, 10) });
  },
}));

// Selectors
export const useCommandPaletteOpen = () => useCommandPaletteStore((s) => s.isOpen);
export const useCommandPaletteQuery = () => useCommandPaletteStore((s) => s.query);
export const useCommandPaletteFilter = () => useCommandPaletteStore((s) => s.filter);
