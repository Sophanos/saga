/**
 * TypewriterScroll Extension - Keep cursor vertically centered
 *
 * Implements typewriter-style scrolling where the cursor stays at a
 * consistent vertical position (~40% from top) as the user types,
 * creating a more focused writing experience.
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';

// =============================================================================
// Types
// =============================================================================

export interface TypewriterScrollState {
  /** Whether typewriter scrolling is enabled */
  enabled: boolean;
  /** Vertical position of cursor (0-1, where 0.4 = 40% from top) */
  cursorPosition: number;
  /** Scroll behavior */
  behavior: 'auto' | 'smooth';
}

export interface TypewriterScrollOptions {
  /** Enable by default */
  enabled?: boolean;
  /** Cursor vertical position (0-1) */
  cursorPosition?: number;
  /** Scroll behavior */
  behavior?: 'auto' | 'smooth';
  /** Debounce delay in ms */
  debounceDelay?: number;
}

export const typewriterScrollPluginKey = new PluginKey<TypewriterScrollState>('typewriterScroll');

// =============================================================================
// Scroll Logic
// =============================================================================

let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Scroll the editor to keep the cursor at the target position
 */
function scrollToCursor(
  view: EditorView,
  state: TypewriterScrollState,
  debounceMs: number
): void {
  if (!state.enabled) return;

  // Clear previous timeout
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  // Debounce to prevent jitter
  scrollTimeout = setTimeout(() => {
    const { from } = view.state.selection;

    // Get cursor coordinates
    const coords = view.coordsAtPos(from);
    if (!coords) return;

    // Get the scrollable container (editor's DOM parent)
    const scrollContainer = findScrollContainer(view.dom);
    if (!scrollContainer) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const containerHeight = containerRect.height;

    // Target position for cursor (e.g., 40% from top)
    const targetY = containerRect.top + containerHeight * state.cursorPosition;

    // Current cursor position relative to viewport
    const currentY = coords.top;

    // Calculate scroll delta
    const delta = currentY - targetY;

    // Only scroll if delta is significant (avoid micro-adjustments)
    if (Math.abs(delta) > 5) {
      scrollContainer.scrollBy({
        top: delta,
        behavior: state.behavior,
      });
    }
  }, debounceMs);
}

/**
 * Find the scrollable container for the editor
 */
function findScrollContainer(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflow = style.overflowY;

    if (overflow === 'auto' || overflow === 'scroll') {
      return current;
    }

    current = current.parentElement;
  }

  // Fallback to document scrolling element
  return document.scrollingElement as HTMLElement | null;
}

// =============================================================================
// Plugin
// =============================================================================

type TypewriterScrollMeta =
  | { type: 'setEnabled'; enabled: boolean }
  | { type: 'setCursorPosition'; position: number }
  | { type: 'setBehavior'; behavior: 'auto' | 'smooth' };

function createTypewriterScrollPlugin(options: TypewriterScrollOptions): Plugin<TypewriterScrollState> {
  const debounceDelay = options.debounceDelay ?? 50;

  return new Plugin<TypewriterScrollState>({
    key: typewriterScrollPluginKey,

    state: {
      init(): TypewriterScrollState {
        return {
          enabled: options.enabled ?? false,
          cursorPosition: options.cursorPosition ?? 0.4,
          behavior: options.behavior ?? 'smooth',
        };
      },

      apply(tr, value): TypewriterScrollState {
        const meta = tr.getMeta(typewriterScrollPluginKey) as TypewriterScrollMeta | undefined;

        if (!meta) return value;

        switch (meta.type) {
          case 'setEnabled':
            return { ...value, enabled: meta.enabled };
          case 'setCursorPosition':
            return { ...value, cursorPosition: meta.position };
          case 'setBehavior':
            return { ...value, behavior: meta.behavior };
          default:
            return value;
        }
      },
    },

    view(_editorView) {
      return {
        update(view, prevState) {
          // Only scroll on selection change (typing, cursor movement)
          const selectionChanged = !view.state.selection.eq(prevState.selection);
          const docChanged = !view.state.doc.eq(prevState.doc);

          if (selectionChanged || docChanged) {
            const pluginState = typewriterScrollPluginKey.getState(view.state);
            if (pluginState?.enabled) {
              scrollToCursor(view, pluginState, debounceDelay);
            }
          }
        },

        destroy() {
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
            scrollTimeout = null;
          }
        },
      };
    },
  });
}

// =============================================================================
// Extension
// =============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    typewriterScroll: {
      /** Enable or disable typewriter scrolling */
      setTypewriterScrolling: (enabled: boolean) => ReturnType;
      /** Toggle typewriter scrolling */
      toggleTypewriterScrolling: () => ReturnType;
      /** Set cursor vertical position (0-1) */
      setTypewriterCursorPosition: (position: number) => ReturnType;
    };
  }
}

export const TypewriterScrollExtension = Extension.create<TypewriterScrollOptions>({
  name: 'typewriterScroll',

  addOptions() {
    return {
      enabled: false,
      cursorPosition: 0.4,
      behavior: 'smooth' as const,
      debounceDelay: 50,
    };
  },

  addProseMirrorPlugins() {
    return [createTypewriterScrollPlugin(this.options)];
  },

  addCommands() {
    return {
      setTypewriterScrolling:
        (enabled: boolean) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(typewriterScrollPluginKey, { type: 'setEnabled', enabled });
          }
          return true;
        },

      toggleTypewriterScrolling:
        () =>
        ({ tr, dispatch, state }) => {
          const pluginState = typewriterScrollPluginKey.getState(state);
          if (!pluginState) return false;

          if (dispatch) {
            tr.setMeta(typewriterScrollPluginKey, {
              type: 'setEnabled',
              enabled: !pluginState.enabled,
            });
          }
          return true;
        },

      setTypewriterCursorPosition:
        (position: number) =>
        ({ tr, dispatch }) => {
          const clampedPosition = Math.max(0.1, Math.min(0.9, position));
          if (dispatch) {
            tr.setMeta(typewriterScrollPluginKey, {
              type: 'setCursorPosition',
              position: clampedPosition,
            });
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Toggle typewriter mode with Cmd/Ctrl + Shift + T
      'Mod-Shift-t': () => this.editor.commands.toggleTypewriterScrolling(),
    };
  },

  // Storage for external sync
  addStorage() {
    return {
      enabled: this.options.enabled,
      cursorPosition: this.options.cursorPosition,
    };
  },
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get current typewriter scroll state from editor
 */
export function getTypewriterScrollState(state: EditorState): TypewriterScrollState | null {
  return typewriterScrollPluginKey.getState(state) ?? null;
}

/**
 * Update typewriter scrolling from external source (Flow Mode)
 */
export function updateTypewriterScrollFromStore(
  editor: { view: { dispatch: (tr: Transaction) => void }; state: EditorState },
  enabled: boolean
): void {
  const tr = editor.state.tr;
  tr.setMeta(typewriterScrollPluginKey, { type: 'setEnabled', enabled });
  editor.view.dispatch(tr);
}

export default TypewriterScrollExtension;
