/**
 * Editor Metrics Store - Shared word count and document metrics
 *
 * Provides a decoupled way for Flow Mode and other features to access
 * editor metrics without prop plumbing through the component tree.
 */

import { create } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

export interface EditorMetricsState {
  /** Current word count */
  wordCount: number;
  /** Current character count */
  characterCount: number;
  /** Active document ID */
  documentId: string | null;
  /** Last update timestamp */
  lastUpdatedAt: number;

  // Actions
  setWordCount: (count: number) => void;
  setCharacterCount: (count: number) => void;
  setDocumentId: (id: string | null) => void;
  updateMetrics: (metrics: { wordCount?: number; characterCount?: number }) => void;
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState = {
  wordCount: 0,
  characterCount: 0,
  documentId: null as string | null,
  lastUpdatedAt: 0,
};

// ============================================================================
// STORE
// ============================================================================

export const useEditorMetricsStore = create<EditorMetricsState>()((set) => ({
  ...initialState,

  setWordCount: (count) =>
    set({
      wordCount: count,
      lastUpdatedAt: Date.now(),
    }),

  setCharacterCount: (count) =>
    set({
      characterCount: count,
      lastUpdatedAt: Date.now(),
    }),

  setDocumentId: (id) =>
    set({
      documentId: id,
      lastUpdatedAt: Date.now(),
    }),

  updateMetrics: (metrics) =>
    set((state) => ({
      ...state,
      ...metrics,
      lastUpdatedAt: Date.now(),
    })),

  reset: () => set(initialState),
}));

// ============================================================================
// SELECTORS
// ============================================================================

/** Get current word count */
export const useEditorWordCount = () =>
  useEditorMetricsStore((s) => s.wordCount);

/** Get current character count */
export const useEditorCharacterCount = () =>
  useEditorMetricsStore((s) => s.characterCount);

/** Get active document ID */
export const useEditorDocumentId = () =>
  useEditorMetricsStore((s) => s.documentId);

/** Get last update timestamp */
export const useEditorMetricsLastUpdated = () =>
  useEditorMetricsStore((s) => s.lastUpdatedAt);
