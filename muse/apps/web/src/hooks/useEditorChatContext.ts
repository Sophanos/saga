import { useMemo } from "react";
import { useMythosStore } from "../stores";
import { useEditorSelection } from "./useEditorSelection";
import type { Editor } from "@mythos/editor";

export interface EditorChatContext {
  document: {
    id: string;
    title: string;
    excerpt: string;
  } | null;
  selection: {
    text: string;
    surroundingContext: string;
  } | null;
}

interface UseEditorChatContextOptions {
  /** Number of characters to include around the selection for context */
  selectionRadiusChars?: number;
  /** Maximum length of the document excerpt */
  maxExcerptLength?: number;
}

/**
 * Hook to get current editor context for chat/AI features.
 * Provides document info and selection text with surrounding context.
 */
export function useEditorChatContext(
  options?: UseEditorChatContextOptions
): EditorChatContext {
  const { selectionRadiusChars = 200, maxExcerptLength = 500 } = options ?? {};

  const currentDocument = useMythosStore((s) => s.document.currentDocument);
  const editorInstance = useMythosStore(
    (s) => s.editor.editorInstance
  ) as Editor | null;

  // Use reactive selection hook to properly track selection changes
  const selectedText = useEditorSelection(editorInstance);

  const context = useMemo((): EditorChatContext => {
    // Build document context
    let documentContext: EditorChatContext["document"] = null;
    if (currentDocument) {
      // Get excerpt from editor content
      let excerpt = "";
      if (editorInstance) {
        const text = editorInstance.getText();
        excerpt = text.slice(0, maxExcerptLength);
        if (text.length > maxExcerptLength) {
          excerpt += "...";
        }
      }
      documentContext = {
        id: currentDocument.id,
        title: currentDocument.title ?? "Untitled",
        excerpt,
      };
    }

    // Build selection context
    let selectionContext: EditorChatContext["selection"] = null;
    if (editorInstance && selectedText) {
      const { from, to } = editorInstance.state.selection;
      const fullText = editorInstance.getText();

      // Get surrounding context
      const contextStart = Math.max(0, from - selectionRadiusChars);
      const contextEnd = Math.min(fullText.length, to + selectionRadiusChars);

      let surroundingContext = "";
      if (contextStart > 0) {
        surroundingContext += "...";
      }
      surroundingContext += fullText.slice(contextStart, contextEnd);
      if (contextEnd < fullText.length) {
        surroundingContext += "...";
      }

      selectionContext = {
        text: selectedText,
        surroundingContext,
      };
    }

    return {
      document: documentContext,
      selection: selectionContext,
    };
  }, [currentDocument, editorInstance, selectedText, selectionRadiusChars, maxExcerptLength]);

  return context;
}

/**
 * Hook to check if there's a text selection in the editor.
 * Properly reactive via selectionUpdate events.
 */
export function useHasEditorSelection(): boolean {
  const editorInstance = useMythosStore(
    (s) => s.editor.editorInstance
  ) as Editor | null;

  const selectedText = useEditorSelection(editorInstance);

  return selectedText !== null;
}
