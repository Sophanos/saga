/**
 * History Store
 *
 * Manages the History panel state for viewing version history of:
 * - Documents: document revisions
 * - Artifacts: artifact versions
 *
 * Separate from Inbox (which shows "what needs attention now").
 * History shows "what happened in the past" for a specific target.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// Types
// =============================================================================

export type HistoryTargetType = 'document' | 'artifact';

export interface HistoryRevision {
  id: string;
  version?: number;
  createdAt: number;
  reason: string;
  summary?: string;
  actorType: 'user' | 'ai' | 'system';
  actorName?: string;
  wordCount?: number;
  deltaWordCount?: number;
  // For restoration
  canRestore: boolean;
  isCurrentVersion: boolean;
}

export interface HistoryState {
  // Panel state
  isOpen: boolean;
  targetType: HistoryTargetType | null;
  targetId: string | null;
  targetName: string | null;

  // Revisions (loaded from Convex)
  revisions: HistoryRevision[];
  isLoading: boolean;
  error: string | null;

  // Selected revision for comparison/preview
  selectedRevisionId: string | null;
  compareRevisionId: string | null; // For diff view
}

export interface HistoryActions {
  // Panel controls
  open: (targetType: HistoryTargetType, targetId: string, targetName?: string) => void;
  close: () => void;

  // Data loading
  setRevisions: (revisions: HistoryRevision[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selection
  selectRevision: (revisionId: string | null) => void;
  setCompareRevision: (revisionId: string | null) => void;
  clearSelection: () => void;

  // Reset
  reset: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: HistoryState = {
  isOpen: false,
  targetType: null,
  targetId: null,
  targetName: null,
  revisions: [],
  isLoading: false,
  error: null,
  selectedRevisionId: null,
  compareRevisionId: null,
};

// =============================================================================
// Store
// =============================================================================

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  immer((set) => ({
    ...initialState,

    // Panel controls
    open: (targetType, targetId, targetName) =>
      set((state) => {
        state.isOpen = true;
        state.targetType = targetType;
        state.targetId = targetId;
        state.targetName = targetName ?? null;
        state.revisions = [];
        state.isLoading = true;
        state.error = null;
        state.selectedRevisionId = null;
        state.compareRevisionId = null;
      }),

    close: () =>
      set((state) => {
        state.isOpen = false;
      }),

    // Data loading
    setRevisions: (revisions) =>
      set((state) => {
        state.revisions = revisions;
        state.isLoading = false;
      }),

    setLoading: (loading) =>
      set((state) => {
        state.isLoading = loading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isLoading = false;
      }),

    // Selection
    selectRevision: (revisionId) =>
      set((state) => {
        state.selectedRevisionId = revisionId;
      }),

    setCompareRevision: (revisionId) =>
      set((state) => {
        state.compareRevisionId = revisionId;
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedRevisionId = null;
        state.compareRevisionId = null;
      }),

    // Reset
    reset: () => set(initialState),
  }))
);

// =============================================================================
// Selectors
// =============================================================================

export const useHistoryOpen = () => useHistoryStore((s) => s.isOpen);
export const useHistoryTarget = () =>
  useHistoryStore((s) => ({
    type: s.targetType,
    id: s.targetId,
    name: s.targetName,
  }));
export const useHistoryRevisions = () => useHistoryStore((s) => s.revisions);
export const useHistoryLoading = () => useHistoryStore((s) => s.isLoading);
export const useHistoryError = () => useHistoryStore((s) => s.error);
export const useHistorySelectedRevision = () => useHistoryStore((s) => s.selectedRevisionId);
export const useHistoryCompareRevision = () => useHistoryStore((s) => s.compareRevisionId);

/**
 * Get the currently selected revision object
 */
export const useSelectedRevision = () =>
  useHistoryStore((s) =>
    s.selectedRevisionId ? s.revisions.find((r) => r.id === s.selectedRevisionId) : null
  );

/**
 * Get the compare revision object
 */
export const useCompareRevision = () =>
  useHistoryStore((s) =>
    s.compareRevisionId ? s.revisions.find((r) => r.id === s.compareRevisionId) : null
  );

/**
 * Check if we're in compare mode (two revisions selected)
 */
export const useIsCompareMode = () =>
  useHistoryStore((s) => s.selectedRevisionId !== null && s.compareRevisionId !== null);
