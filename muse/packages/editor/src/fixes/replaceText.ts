import type { Editor } from "@tiptap/core";

/**
 * Replace text at a position range in the editor
 * @param editor - The Tiptap editor instance
 * @param from - Start position of the range to replace
 * @param to - End position of the range to replace
 * @param text - The text to insert at the range
 */
export function replaceText(
  editor: Editor,
  from: number,
  to: number,
  text: string
): void {
  editor.chain().focus().insertContentAt({ from, to }, text).run();
}
