import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";

/**
 * Undo entry for a linter fix
 */
export interface UndoEntry {
  /** Type of operation */
  type: "fix";
  /** ID of the issue that was fixed */
  issueId: string;
  /** Original text before the fix */
  before: string;
  /** Text after the fix was applied */
  after: string;
  /** Position in the document where the fix was applied */
  position: {
    from: number;
    to: number;
  };
  /** Timestamp when the fix was applied */
  timestamp: number;
  /** Issue type for display purposes */
  issueType?: "character" | "world" | "plot" | "timeline";
  /** Issue severity for display purposes */
  issueSeverity?: "error" | "warning" | "info";
  /** Brief description of what was changed */
  description?: string;
}

/**
 * Undo store state interface
 */
interface UndoState {
  /** Stack of undoable operations (most recent at end) */
  undoStack: UndoEntry[];
  /** Stack of redoable operations (most recent at end) */
  redoStack: UndoEntry[];
  /** Maximum size of the undo stack */
  maxStackSize: number;
}

/**
 * Undo store actions interface
 */
interface UndoActions {
  /** Push a new entry onto the undo stack */
  pushUndo: (entry: Omit<UndoEntry, "timestamp">) => void;
  /** Pop the most recent entry from undo stack and push to redo */
  undo: () => UndoEntry | undefined;
  /** Pop the most recent entry from redo stack and push to undo */
  redo: () => UndoEntry | undefined;
  /** Clear all undo/redo history */
  clearHistory: () => void;
  /** Get the entry at the top of the undo stack without removing it */
  peekUndo: () => UndoEntry | undefined;
  /** Get the entry at the top of the redo stack without removing it */
  peekRedo: () => UndoEntry | undefined;
  /** Set the maximum stack size */
  setMaxStackSize: (size: number) => void;
}

/**
 * Combined undo store type
 */
type UndoStore = UndoState & UndoActions;

/**
 * Default maximum stack size
 */
const DEFAULT_MAX_STACK_SIZE = 50;

/**
 * Zustand store for managing undo/redo state for linter fixes
 */
export const useUndoStore = create<UndoStore>()(
  immer((set, get) => ({
    // Initial state
    undoStack: [],
    redoStack: [],
    maxStackSize: DEFAULT_MAX_STACK_SIZE,

    // Actions
    pushUndo: (entry) =>
      set((state) => {
        const newEntry: UndoEntry = {
          ...entry,
          timestamp: Date.now(),
        };

        // Add to undo stack
        state.undoStack.push(newEntry);

        // Trim stack if it exceeds max size
        if (state.undoStack.length > state.maxStackSize) {
          state.undoStack = state.undoStack.slice(-state.maxStackSize);
        }

        // Clear redo stack when a new action is performed
        state.redoStack = [];
      }),

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) {
        return undefined;
      }

      let poppedEntry: UndoEntry | undefined;

      set((state) => {
        poppedEntry = state.undoStack.pop();
        if (poppedEntry) {
          state.redoStack.push(poppedEntry);
        }
      });

      return poppedEntry;
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) {
        return undefined;
      }

      let poppedEntry: UndoEntry | undefined;

      set((state) => {
        poppedEntry = state.redoStack.pop();
        if (poppedEntry) {
          state.undoStack.push(poppedEntry);
        }
      });

      return poppedEntry;
    },

    clearHistory: () =>
      set((state) => {
        state.undoStack = [];
        state.redoStack = [];
      }),

    peekUndo: () => {
      const state = get();
      return state.undoStack.length > 0
        ? state.undoStack[state.undoStack.length - 1]
        : undefined;
    },

    peekRedo: () => {
      const state = get();
      return state.redoStack.length > 0
        ? state.redoStack[state.redoStack.length - 1]
        : undefined;
    },

    setMaxStackSize: (size) =>
      set((state) => {
        state.maxStackSize = size;
        // Trim stacks if they exceed new max size
        if (state.undoStack.length > size) {
          state.undoStack = state.undoStack.slice(-size);
        }
        if (state.redoStack.length > size) {
          state.redoStack = state.redoStack.slice(-size);
        }
      }),
  }))
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Check if there are undoable actions
 */
export const useCanUndo = () =>
  useUndoStore((state) => state.undoStack.length > 0);

/**
 * Check if there are redoable actions
 */
export const useCanRedo = () =>
  useUndoStore((state) => state.redoStack.length > 0);

/**
 * Get the count of undoable actions
 */
export const useUndoCount = () =>
  useUndoStore((state) => state.undoStack.length);

/**
 * Get the count of redoable actions
 */
export const useRedoCount = () =>
  useUndoStore((state) => state.redoStack.length);

/**
 * Get the most recent undo entry description
 */
export const useLastUndoDescription = () =>
  useUndoStore((state) => {
    const entry = state.undoStack[state.undoStack.length - 1];
    return entry?.description ?? null;
  });

/**
 * Get the most recent redo entry description
 */
export const useLastRedoDescription = () =>
  useUndoStore((state) => {
    const entry = state.redoStack[state.redoStack.length - 1];
    return entry?.description ?? null;
  });

/**
 * Get the full undo history (most recent first)
 */
export const useUndoHistory = () =>
  useUndoStore(useShallow((state) => [...state.undoStack].reverse()));

/**
 * Get the full redo history (most recent first)
 */
export const useRedoHistory = () =>
  useUndoStore(useShallow((state) => [...state.redoStack].reverse()));
