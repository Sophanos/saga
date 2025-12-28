import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface PasteHandlerOptions {
  /**
   * Minimum character length to trigger the onSubstantialPaste callback.
   * @default 100
   */
  minLength: number;
  /**
   * Callback triggered when pasted text exceeds minLength.
   * Called after paste completes (via setTimeout) to not block normal paste handling.
   * @param text - The pasted plain text content
   * @param pastePosition - The document position where paste occurred
   */
  onSubstantialPaste: (text: string, pastePosition: number) => void;
}

export const pasteHandlerPluginKey = new PluginKey("pasteHandler");

export const PasteHandler = Extension.create<PasteHandlerOptions>({
  name: "pasteHandler",

  addOptions() {
    return {
      minLength: 100,
      onSubstantialPaste: () => {
        // Default no-op callback
      },
    };
  },

  addProseMirrorPlugins() {
    const { minLength, onSubstantialPaste } = this.options;

    return [
      new Plugin({
        key: pasteHandlerPluginKey,
        props: {
          handlePaste: (view, event, _slice) => {
            // Get plain text from clipboard
            const clipboardData = event.clipboardData;
            if (!clipboardData) {
              return false;
            }

            const text = clipboardData.getData("text/plain");

            // Check if pasted text meets minimum length threshold
            if (text && text.length >= minLength) {
              // Get the current selection position (where paste will occur)
              const pastePosition = view.state.selection.from;

              // Use setTimeout to call callback after paste completes
              // This ensures we don't block normal paste handling
              setTimeout(() => {
                onSubstantialPaste(text, pastePosition);
              }, 0);
            }

            // Return false to allow normal paste handling to continue
            return false;
          },
        },
      }),
    ];
  },
});
