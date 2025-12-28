import type { Editor } from "@tiptap/core";

/**
 * Focus editor and scroll to a specific position
 * @param editor - The Tiptap editor instance
 * @param position - The position to jump to
 */
export function jumpToPosition(editor: Editor, position: number): void {
  editor
    .chain()
    .focus()
    .setTextSelection(position)
    .scrollIntoView()
    .run();
}
