import type { Editor } from "@tiptap/core";

/**
 * Insert text at a position in the editor
 * @param editor - The Tiptap editor instance
 * @param position - The position to insert text at
 * @param text - The text to insert
 */
export function insertText(
  editor: Editor,
  position: number,
  text: string
): void {
  editor.chain().focus().insertContentAt(position, text).run();
}
