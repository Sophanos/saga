import type { Editor } from "@tiptap/core";

/**
 * Remove text at a position range in the editor
 * @param editor - The Tiptap editor instance
 * @param from - Start position of the range to remove
 * @param to - End position of the range to remove
 */
export function removeText(editor: Editor, from: number, to: number): void {
  editor.chain().focus().deleteRange({ from, to }).run();
}
