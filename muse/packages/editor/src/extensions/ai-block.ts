/**
 * AIBlock - TipTap node for inline AI responses
 * Renders as a custom block in the editor that shows AI response with actions
 */

import { Node, mergeAttributes } from '@tiptap/core';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AIBlockStatus = 'idle' | 'streaming' | 'complete' | 'error';

export interface AIBlockAttributes {
  prompt: string;
  response: string;
  status: AIBlockStatus;
  selectedText: string;
  actionId?: string;
  submenuId?: string;
  timestamp: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    aiBlock: {
      /**
       * Insert an AI block at the current position
       */
      insertAIBlock: (attrs?: Partial<AIBlockAttributes>) => ReturnType;
      /**
       * Update an AI block's attributes
       */
      updateAIBlock: (attrs: Partial<AIBlockAttributes>) => ReturnType;
      /**
       * Remove all AI blocks from the document
       */
      removeAIBlocks: () => ReturnType;
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension Options
// ─────────────────────────────────────────────────────────────────────────────

export interface AIBlockOptions {
  /**
   * Callback when AI block is inserted
   */
  onInsert?: (attrs: AIBlockAttributes) => void;
  /**
   * Callback when AI block is removed
   */
  onRemove?: (attrs: AIBlockAttributes) => void;
  /**
   * Callback when user wants to insert the response below
   */
  onInsertBelow?: (response: string) => void;
  /**
   * Callback when user wants to replace selection
   */
  onReplace?: (response: string) => void;
  /**
   * Callback when user wants to retry
   */
  onRetry?: (attrs: AIBlockAttributes) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension
// ─────────────────────────────────────────────────────────────────────────────

export const AIBlock = Node.create<AIBlockOptions>({
  name: 'aiBlock',

  group: 'block',

  atom: true,

  draggable: false,

  selectable: true,

  addOptions() {
    return {
      onInsert: undefined,
      onRemove: undefined,
      onInsertBelow: undefined,
      onReplace: undefined,
      onRetry: undefined,
    };
  },

  addAttributes() {
    return {
      prompt: {
        default: '',
      },
      response: {
        default: '',
      },
      status: {
        default: 'idle' as AIBlockStatus,
      },
      selectedText: {
        default: '',
      },
      actionId: {
        default: null,
      },
      submenuId: {
        default: null,
      },
      timestamp: {
        default: () => Date.now(),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="ai-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'ai-block',
        class: 'ai-block-node',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertAIBlock:
        (attrs = {}) =>
        ({ commands }) => {
          const fullAttrs: AIBlockAttributes = {
            prompt: '',
            response: '',
            status: 'idle',
            selectedText: '',
            timestamp: Date.now(),
            ...attrs,
          };

          this.options.onInsert?.(fullAttrs);

          return commands.insertContent({
            type: this.name,
            attrs: fullAttrs,
          });
        },

      updateAIBlock:
        (attrs) =>
        ({ tr, state, dispatch }) => {
          let found = false;
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              if (dispatch) {
                const newAttrs = { ...node.attrs, ...attrs };
                tr.setNodeMarkup(pos, undefined, newAttrs);
              }
              found = true;
              return false;
            }
            return true;
          });
          return found;
        },

      removeAIBlocks:
        () =>
        ({ tr, state, dispatch }) => {
          const positions: number[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              positions.push(pos);
              this.options.onRemove?.(node.attrs as AIBlockAttributes);
            }
            return true;
          });

          // Remove from end to start to preserve positions
          positions.reverse().forEach((pos) => {
            if (dispatch) {
              const node = state.doc.nodeAt(pos);
              if (node) {
                tr.delete(pos, pos + node.nodeSize);
              }
            }
          });

          return positions.length > 0;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Escape to remove AI blocks
      Escape: () => {
        return this.editor.commands.removeAIBlocks();
      },
    };
  },
});

export default AIBlock;
