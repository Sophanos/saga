import { useCallback } from "react";
import type { Editor } from "@mythos/editor";
import { useMythosStore } from "../stores";

/**
 * Convert a character offset in plain text to a ProseMirror document position.
 * 
 * ProseMirror positions include structural nodes (paragraphs, etc.) so we need
 * to walk the document to find the correct position.
 * 
 * @param editor - The Tiptap/ProseMirror editor instance
 * @param charOffset - Character offset in plain text (from getText())
 * @returns The ProseMirror document position
 */
export function charOffsetToDocPos(editor: Editor, charOffset: number): number {
  const doc = editor.state.doc;
  let textOffset = 0;
  let docPos = 0;

  doc.descendants((node, pos) => {
    if (textOffset >= charOffset) {
      return false; // Stop traversal
    }

    if (node.isText) {
      const nodeText = node.text || "";
      const remaining = charOffset - textOffset;

      if (remaining <= nodeText.length) {
        // Target is within this text node
        docPos = pos + remaining;
        textOffset = charOffset; // Mark as found
        return false;
      }

      textOffset += nodeText.length;
    } else if (node.isBlock && textOffset > 0) {
      // Block nodes add a newline equivalent in getText()
      textOffset += 1;
    }

    docPos = pos + node.nodeSize;
    return true; // Continue traversal
  });

  return docPos;
}

/**
 * Find text position in editor content
 * 
 * @param text - The full text content
 * @param searchText - Text to find
 * @param expectedPosition - Approximate position to search near
 * @returns Start and end offsets, or null if not found
 */
export function findTextPosition(
  text: string,
  searchText: string,
  expectedPosition: number = 0
): { start: number; end: number } | null {
  // First try exact position
  const exactMatch = text.indexOf(searchText, Math.max(0, expectedPosition - 50));
  if (exactMatch !== -1) {
    return { start: exactMatch, end: exactMatch + searchText.length };
  }

  // Try from the beginning
  const fromStart = text.indexOf(searchText);
  if (fromStart !== -1) {
    return { start: fromStart, end: fromStart + searchText.length };
  }

  // Try case-insensitive
  const lowerText = text.toLowerCase();
  const lowerSearch = searchText.toLowerCase();
  const caseInsensitive = lowerText.indexOf(lowerSearch);
  if (caseInsensitive !== -1) {
    return { start: caseInsensitive, end: caseInsensitive + searchText.length };
  }

  return null;
}

/**
 * Result type for useEditorNavigation hook
 */
interface UseEditorNavigationResult {
  /**
   * Jump to a character offset range in the editor
   * @param startOffset - Start character offset (in getText() space)
   * @param endOffset - Optional end offset for selection
   */
  jumpToOffsets: (startOffset: number, endOffset?: number) => void;

  /**
   * Jump to a line number in the editor
   * @param lineNumber - 1-based line number
   * @param highlightText - Optional text to highlight on that line
   */
  jumpToLine: (lineNumber: number, highlightText?: string) => void;

  /**
   * Search for text and jump to it
   * @param searchText - Text to find and jump to
   * @param selectMatch - Whether to select the matched text
   */
  jumpToText: (searchText: string, selectMatch?: boolean) => void;

  /**
   * Apply a text replacement in the editor
   * @param oldText - The text to find and replace
   * @param newText - The replacement text
   * @param position - Optional position hint for finding the text
   * @returns true if the replacement was successful, false otherwise
   */
  applyTextReplacement: (
    oldText: string,
    newText: string,
    position?: { start: number; end: number }
  ) => boolean;

  /**
   * Whether the editor is available for navigation
   */
  isReady: boolean;
}

/**
 * Hook for navigating within the Tiptap editor.
 * 
 * Provides utilities for jumping to specific positions, lines, or text matches.
 * Used by Linter, Coach, and other components that need to highlight issues.
 * 
 * @returns Navigation utilities and ready state
 */
export function useEditorNavigation(): UseEditorNavigationResult {
  const editor = useMythosStore((state) => state.editor.editorInstance) as Editor | null;

  const jumpToOffsets = useCallback(
    (startOffset: number, endOffset?: number) => {
      if (!editor || editor.isDestroyed) {
        console.warn("[useEditorNavigation] Editor not available");
        return;
      }

      try {
        const from = charOffsetToDocPos(editor, startOffset);
        const to = endOffset !== undefined 
          ? charOffsetToDocPos(editor, endOffset) 
          : from;

        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .scrollIntoView()
          .run();
      } catch (err) {
        console.error("[useEditorNavigation] Error jumping to offsets:", err);
      }
    },
    [editor]
  );

  const jumpToLine = useCallback(
    (lineNumber: number, highlightText?: string) => {
      if (!editor || editor.isDestroyed) {
        console.warn("[useEditorNavigation] Editor not available");
        return;
      }

      try {
        const content = editor.getText();
        const lines = content.split("\n");
        
        // Calculate offset at start of target line
        let offset = 0;
        for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
          offset += lines[i].length + 1; // +1 for newline
        }

        // If we have text to highlight, find it within the line
        let endOffset = offset;
        if (highlightText && lineNumber <= lines.length) {
          const line = lines[lineNumber - 1];
          const textIndex = line.indexOf(highlightText);
          if (textIndex !== -1) {
            offset += textIndex;
            endOffset = offset + highlightText.length;
          }
        }

        jumpToOffsets(offset, endOffset > offset ? endOffset : undefined);
      } catch (err) {
        console.error("[useEditorNavigation] Error jumping to line:", err);
      }
    },
    [editor, jumpToOffsets]
  );

  const jumpToText = useCallback(
    (searchText: string, selectMatch = true) => {
      if (!editor || editor.isDestroyed) {
        console.warn("[useEditorNavigation] Editor not available");
        return;
      }

      try {
        const content = editor.getText();
        const position = findTextPosition(content, searchText);

        if (position) {
          jumpToOffsets(position.start, selectMatch ? position.end : undefined);
        } else {
          console.warn("[useEditorNavigation] Text not found:", searchText);
        }
      } catch (err) {
        console.error("[useEditorNavigation] Error jumping to text:", err);
      }
    },
    [editor, jumpToOffsets]
  );

  const applyTextReplacement = useCallback(
    (
      oldText: string,
      newText: string,
      position?: { start: number; end: number }
    ): boolean => {
      if (!editor || editor.isDestroyed) {
        console.warn("[useEditorNavigation] Editor not available for replacement");
        return false;
      }

      try {
        const content = editor.getText();

        // Try to use provided position first
        let targetPosition: { start: number; end: number } | null = null;

        if (position) {
          // Verify the text at the given position matches
          const textAtPosition = content.substring(position.start, position.end);
          if (textAtPosition === oldText) {
            targetPosition = position;
          }
        }

        // Fall back to searching for the text
        if (!targetPosition) {
          targetPosition = findTextPosition(
            content,
            oldText,
            position?.start ?? 0
          );
        }

        if (!targetPosition) {
          console.warn("[useEditorNavigation] Text not found for replacement:", oldText);
          return false;
        }

        // Convert text offsets to ProseMirror document positions
        const from = charOffsetToDocPos(editor, targetPosition.start);
        const to = charOffsetToDocPos(editor, targetPosition.end);

        // Apply the replacement
        editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, newText)
          .run();

        return true;
      } catch (err) {
        console.error("[useEditorNavigation] Error applying replacement:", err);
        return false;
      }
    },
    [editor]
  );

  return {
    jumpToOffsets,
    jumpToLine,
    jumpToText,
    applyTextReplacement,
    isReady: !!editor && !editor.isDestroyed,
  };
}
