/**
 * Editor Selection Store
 *
 * Tracks the current editor selection and its document context.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface EditorSelectionRange {
  from: number;
  to: number;
  text: string;
}

export interface EditorSelectionState {
  selection: EditorSelectionRange | null;
  documentId: string | null;
}

export interface EditorSelectionActions {
  setSelection: (selection: EditorSelectionRange | null, documentId: string | null) => void;
  clearSelection: () => void;
}

const initialState: EditorSelectionState = {
  selection: null,
  documentId: null,
};

export const useEditorSelectionStore = create<EditorSelectionState & EditorSelectionActions>()(
  immer((set) => ({
    ...initialState,
    setSelection: (selection, documentId) => {
      set((state) => {
        state.selection = selection;
        state.documentId = documentId;
      });
    },
    clearSelection: () => {
      set((state) => {
        state.selection = null;
        state.documentId = null;
      });
    },
  }))
);

export const useEditorSelection = () => useEditorSelectionStore((s) => s.selection);
export const useEditorSelectionDocumentId = () => useEditorSelectionStore((s) => s.documentId);
export const useHasEditorSelection = () =>
  useEditorSelectionStore((s) => !!s.selection && s.selection.from !== s.selection.to);
