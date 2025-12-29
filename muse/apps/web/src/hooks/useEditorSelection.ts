import { useEffect, useState, useCallback } from "react";
import type { Editor } from "@mythos/editor";

/**
 * Hook to get the current editor selection text with proper reactivity.
 *
 * ProseMirror/TipTap selection changes do NOT trigger React re-renders since
 * the editor instance reference stays the same. This hook subscribes to the
 * editor's `selectionUpdate` event to properly track selection changes.
 *
 * @param editor - TipTap Editor instance (or null if not ready)
 * @returns The selected text, or null if no selection
 *
 * @example
 * ```tsx
 * const editorInstance = useMythosStore((s) => s.editor.editorInstance);
 * const selectedText = useEditorSelection(editorInstance);
 *
 * if (selectedText) {
 *   // User has text selected
 * }
 * ```
 */
export function useEditorSelection(editor: Editor | null): string | null {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) {
      setSelectedText(null);
      return;
    }

    // Get initial selection
    const getSelection = () => {
      const { from, to } = editor.state.selection;
      if (from === to) return null;
      return editor.state.doc.textBetween(from, to, "\n");
    };

    // Set initial value
    setSelectedText(getSelection());

    // Subscribe to selection updates
    const handleSelectionUpdate = () => {
      setSelectedText(getSelection());
    };

    editor.on("selectionUpdate", handleSelectionUpdate);

    // Cleanup subscription
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor]);

  return selectedText;
}

/**
 * Hook to get a function that returns the current editor selection.
 * Useful for imperative contexts like command handlers where you need
 * the selection at the moment of execution, not during render.
 *
 * @param editor - TipTap Editor instance (or null if not ready)
 * @returns Function that returns the current selected text (or null)
 *
 * @example
 * ```tsx
 * const editorInstance = useMythosStore((s) => s.editor.editorInstance);
 * const getSelectedText = useGetEditorSelection(editorInstance);
 *
 * const handleCommand = useCallback(() => {
 *   const text = getSelectedText();
 *   // Use the current selection
 * }, [getSelectedText]);
 * ```
 */
export function useGetEditorSelection(editor: Editor | null): () => string | null {
  return useCallback(() => {
    if (!editor) return null;
    const { from, to } = editor.state.selection;
    if (from === to) return null;
    return editor.state.doc.textBetween(from, to, "\n");
  }, [editor]);
}
