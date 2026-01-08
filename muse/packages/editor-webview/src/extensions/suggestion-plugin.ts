import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Transaction } from '@tiptap/pm/state';

export type SuggestionType = 'insert' | 'replace' | 'delete';

export interface Suggestion {
  /** Unique identifier for this suggestion */
  id: string;
  /** Start position in document */
  from: number;
  /** End position in document */
  to: number;
  /** The new content to insert/replace */
  content: string;
  /** Original content being replaced (for replace/delete) */
  originalContent?: string;
  /** Type of suggestion */
  type: SuggestionType;
  /** Model that generated the suggestion */
  model?: string;
  /** Timestamp when created */
  createdAt: string;
  /** Agent that generated the suggestion */
  agentId: string;
}

export interface SuggestionPluginState {
  /** Map of suggestion ID to suggestion data */
  suggestions: Map<string, Suggestion>;
  /** Currently selected/focused suggestion ID */
  selectedId: string | null;
}

export const suggestionPluginKey = new PluginKey<SuggestionPluginState>('suggestion');

// Meta actions for the plugin
type SuggestionMeta =
  | { type: 'add'; suggestion: Suggestion }
  | { type: 'remove'; id: string }
  | { type: 'select'; id: string | null }
  | { type: 'clear' }
  | { type: 'updatePositions'; mapping: (pos: number) => number };

/**
 * Creates decorations for a suggestion
 */
function createSuggestionDecorations(
  suggestion: Suggestion,
  isSelected: boolean,
  view?: EditorView
): Decoration[] {
  const decorations: Decoration[] = [];

  // Inline decoration for the suggestion range
  const inlineClass = [
    'suggestion',
    `suggestion-${suggestion.type}`,
    isSelected ? 'suggestion-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  decorations.push(
    Decoration.inline(suggestion.from, suggestion.to, {
      class: inlineClass,
      'data-suggestion-id': suggestion.id,
      'data-suggestion-type': suggestion.type,
    })
  );

  // Widget decoration for accept/reject buttons at end of suggestion
  if (view) {
    const widget = Decoration.widget(
      suggestion.to,
      () => createSuggestionWidget(suggestion, view),
      {
        side: 1, // Place after the position
        key: `suggestion-widget-${suggestion.id}`,
      }
    );
    decorations.push(widget);
  }

  return decorations;
}

/**
 * Creates the accept/reject widget element
 */
function createSuggestionWidget(suggestion: Suggestion, view: EditorView): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'suggestion-widget';
  wrapper.setAttribute('data-suggestion-id', suggestion.id);
  wrapper.contentEditable = 'false';

  // Accept button
  const acceptBtn = document.createElement('button');
  acceptBtn.className = 'suggestion-btn suggestion-btn-accept';
  acceptBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  acceptBtn.title = 'Accept (⌘⏎)';
  acceptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Dispatch custom event for the editor to handle
    view.dom.dispatchEvent(
      new CustomEvent('suggestion:accept', {
        detail: { id: suggestion.id },
        bubbles: true,
      })
    );
  });

  // Reject button
  const rejectBtn = document.createElement('button');
  rejectBtn.className = 'suggestion-btn suggestion-btn-reject';
  rejectBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  rejectBtn.title = 'Reject (⌘⌫)';
  rejectBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    view.dom.dispatchEvent(
      new CustomEvent('suggestion:reject', {
        detail: { id: suggestion.id },
        bubbles: true,
      })
    );
  });

  wrapper.appendChild(acceptBtn);
  wrapper.appendChild(rejectBtn);

  return wrapper;
}

/**
 * Creates the ProseMirror plugin for managing suggestions
 */
function createSuggestionPlugin(): Plugin<SuggestionPluginState> {
  // Store EditorView reference outside plugin for decoration access
  let editorViewRef: EditorView | null = null;

  return new Plugin<SuggestionPluginState>({
    key: suggestionPluginKey,

    state: {
      init(): SuggestionPluginState {
        return {
          suggestions: new Map(),
          selectedId: null,
        };
      },

      apply(tr: Transaction, value: SuggestionPluginState): SuggestionPluginState {
        const meta = tr.getMeta(suggestionPluginKey) as SuggestionMeta | undefined;

        if (!meta) {
          // If document changed, update positions
          if (tr.docChanged) {
            const newSuggestions = new Map<string, Suggestion>();

            for (const [id, suggestion] of value.suggestions) {
              const newFrom = tr.mapping.map(suggestion.from);
              const newTo = tr.mapping.map(suggestion.to);

              // Only keep if positions are still valid
              if (newFrom < newTo && newFrom >= 0 && newTo <= tr.doc.content.size) {
                newSuggestions.set(id, {
                  ...suggestion,
                  from: newFrom,
                  to: newTo,
                });
              }
            }

            return {
              ...value,
              suggestions: newSuggestions,
            };
          }
          return value;
        }

        switch (meta.type) {
          case 'add': {
            const newSuggestions = new Map(value.suggestions);
            newSuggestions.set(meta.suggestion.id, meta.suggestion);
            return {
              ...value,
              suggestions: newSuggestions,
              selectedId: meta.suggestion.id,
            };
          }

          case 'remove': {
            const newSuggestions = new Map(value.suggestions);
            newSuggestions.delete(meta.id);
            return {
              ...value,
              suggestions: newSuggestions,
              selectedId: value.selectedId === meta.id ? null : value.selectedId,
            };
          }

          case 'select': {
            return {
              ...value,
              selectedId: meta.id,
            };
          }

          case 'clear': {
            return {
              suggestions: new Map(),
              selectedId: null,
            };
          }

          default:
            return value;
        }
      },
    },

    props: {
      decorations(state) {
        const pluginState = suggestionPluginKey.getState(state);
        if (!pluginState || pluginState.suggestions.size === 0) {
          return DecorationSet.empty;
        }

        const decorations: Decoration[] = [];

        for (const [, suggestion] of pluginState.suggestions) {
          const isSelected = pluginState.selectedId === suggestion.id;
          decorations.push(
            ...createSuggestionDecorations(suggestion, isSelected, editorViewRef ?? undefined)
          );
        }

        return DecorationSet.create(state.doc, decorations);
      },
    },

    view(editorView: EditorView) {
      editorViewRef = editorView;
      return {
        destroy() {
          editorViewRef = null;
        },
      };
    },
  });
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    suggestion: {
      /**
       * Add a new suggestion
       */
      addSuggestion: (suggestion: Omit<Suggestion, 'createdAt' | 'agentId'> & Partial<Pick<Suggestion, 'createdAt' | 'agentId'>>) => ReturnType;
      /**
       * Remove a suggestion by ID
       */
      removeSuggestion: (id: string) => ReturnType;
      /**
       * Accept a suggestion (apply changes, remove from pending)
       */
      acceptSuggestion: (id: string) => ReturnType;
      /**
       * Reject a suggestion (discard changes, remove from pending)
       */
      rejectSuggestion: (id: string) => ReturnType;
      /**
       * Accept all pending suggestions
       */
      acceptAllSuggestions: () => ReturnType;
      /**
       * Reject all pending suggestions
       */
      rejectAllSuggestions: () => ReturnType;
      /**
       * Select/focus a suggestion
       */
      selectSuggestion: (id: string | null) => ReturnType;
      /**
       * Get all pending suggestions
       */
      getSuggestions: () => ReturnType;
      /**
       * Clear all suggestions
       */
      clearSuggestions: () => ReturnType;
    };
  }
}

export interface SuggestionPluginOptions {
  /**
   * Callback when a suggestion is accepted
   */
  onAccept?: (suggestion: Suggestion) => void;
  /**
   * Callback when a suggestion is rejected
   */
  onReject?: (suggestion: Suggestion) => void;
  /**
   * Callback when suggestions change
   */
  onSuggestionsChange?: (suggestions: Suggestion[]) => void;
}

/**
 * SuggestionPlugin - Manages pending AI suggestions with decorations
 *
 * This extension provides:
 * - Pending suggestion tracking with inline decorations
 * - Accept/reject widget buttons
 * - Commands for accepting/rejecting individual or all suggestions
 * - Position mapping when document changes
 *
 * Visual styling:
 * - Green background for insertions
 * - Yellow background for replacements
 * - Red strikethrough for deletions
 * - Widget buttons (✓ ✗) at end of each suggestion
 */
export const SuggestionPlugin = Extension.create<SuggestionPluginOptions>({
  name: 'suggestion',

  addOptions() {
    return {
      onAccept: undefined,
      onReject: undefined,
      onSuggestionsChange: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [createSuggestionPlugin()];
  },

  addCommands() {
    return {
      addSuggestion:
        (partialSuggestion) =>
        ({ state, tr, dispatch }) => {
          if (!dispatch) return false;

          const suggestion: Suggestion = {
            ...partialSuggestion,
            createdAt: partialSuggestion.createdAt ?? new Date().toISOString(),
            agentId: partialSuggestion.agentId ?? 'muse',
          };

          tr.setMeta(suggestionPluginKey, { type: 'add', suggestion });
          dispatch(tr);

          // Notify about change
          const newState = state.apply(tr);
          this.options.onSuggestionsChange?.(
            Array.from(
              (suggestionPluginKey.getState(newState)?.suggestions ?? new Map()).values()
            )
          );

          return true;
        },

      removeSuggestion:
        (id: string) =>
        ({ tr, dispatch }) => {
          if (!dispatch) return false;

          tr.setMeta(suggestionPluginKey, { type: 'remove', id });
          dispatch(tr);

          return true;
        },

      acceptSuggestion:
        (id: string) =>
        ({ tr, state, dispatch, commands }) => {
          const pluginState = suggestionPluginKey.getState(state);
          const suggestion = pluginState?.suggestions.get(id);

          if (!suggestion || !dispatch) return false;

          // Apply the suggestion based on type
          if (suggestion.type === 'insert' || suggestion.type === 'replace') {
            // The content is already in the document, we just need to:
            // 1. Apply AIGeneratedMark with 'approved' status
            // 2. Remove the suggestion from pending
            commands.setTextSelection({ from: suggestion.from, to: suggestion.to });
            commands.setAIGenerated?.({
              generationId: suggestion.id,
              status: 'approved',
              model: suggestion.model ?? null,
              agentId: suggestion.agentId,
            });
          } else if (suggestion.type === 'delete') {
            // For delete suggestions, we actually delete the content
            tr.delete(suggestion.from, suggestion.to);
          }

          // Remove from pending
          tr.setMeta(suggestionPluginKey, { type: 'remove', id });
          dispatch(tr);

          // Notify
          this.options.onAccept?.(suggestion);
          const newState = state.apply(tr);
          this.options.onSuggestionsChange?.(
            Array.from(
              (suggestionPluginKey.getState(newState)?.suggestions ?? new Map()).values()
            )
          );

          return true;
        },

      rejectSuggestion:
        (id: string) =>
        ({ tr, state, dispatch }) => {
          const pluginState = suggestionPluginKey.getState(state);
          const suggestion = pluginState?.suggestions.get(id);

          if (!suggestion || !dispatch) return false;

          // For insert/replace: delete the inserted content
          if (suggestion.type === 'insert') {
            tr.delete(suggestion.from, suggestion.to);
          } else if (suggestion.type === 'replace' && suggestion.originalContent) {
            // Restore original content
            tr.replaceWith(
              suggestion.from,
              suggestion.to,
              state.schema.text(suggestion.originalContent)
            );
          }
          // For delete: content was already marked for deletion, just remove suggestion

          tr.setMeta(suggestionPluginKey, { type: 'remove', id });
          dispatch(tr);

          // Notify
          this.options.onReject?.(suggestion);
          const newState = state.apply(tr);
          this.options.onSuggestionsChange?.(
            Array.from(
              (suggestionPluginKey.getState(newState)?.suggestions ?? new Map()).values()
            )
          );

          return true;
        },

      acceptAllSuggestions:
        () =>
        ({ state, commands }) => {
          const pluginState = suggestionPluginKey.getState(state);
          if (!pluginState) return false;

          // Accept in reverse order to handle position shifts correctly
          const suggestions = Array.from(pluginState.suggestions.values()).sort(
            (a, b) => b.from - a.from
          );

          for (const suggestion of suggestions) {
            commands.acceptSuggestion(suggestion.id);
          }

          return true;
        },

      rejectAllSuggestions:
        () =>
        ({ state, commands }) => {
          const pluginState = suggestionPluginKey.getState(state);
          if (!pluginState) return false;

          // Reject in reverse order to handle position shifts correctly
          const suggestions = Array.from(pluginState.suggestions.values()).sort(
            (a, b) => b.from - a.from
          );

          for (const suggestion of suggestions) {
            commands.rejectSuggestion(suggestion.id);
          }

          return true;
        },

      selectSuggestion:
        (id: string | null) =>
        ({ tr, dispatch }) => {
          if (!dispatch) return false;

          tr.setMeta(suggestionPluginKey, { type: 'select', id });
          dispatch(tr);

          return true;
        },

      getSuggestions:
        () =>
        ({ state }) => {
          const pluginState = suggestionPluginKey.getState(state);
          return Array.from(pluginState?.suggestions.values() ?? []) as unknown as boolean;
        },

      clearSuggestions:
        () =>
        ({ tr, dispatch }) => {
          if (!dispatch) return false;

          tr.setMeta(suggestionPluginKey, { type: 'clear' });
          dispatch(tr);

          return true;
        },
    };
  },

  onCreate() {
    // Listen for custom events from widgets
    const handleAccept = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        this.editor.commands.acceptSuggestion(detail.id);
      }
    };

    const handleReject = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.id) {
        this.editor.commands.rejectSuggestion(detail.id);
      }
    };

    this.editor.view.dom.addEventListener('suggestion:accept', handleAccept);
    this.editor.view.dom.addEventListener('suggestion:reject', handleReject);

    // Store for cleanup
    (this.editor as unknown as { _suggestionHandlers: { accept: typeof handleAccept; reject: typeof handleReject } })._suggestionHandlers = {
      accept: handleAccept,
      reject: handleReject,
    };
  },

  onDestroy() {
    const handlers = (this.editor as unknown as { _suggestionHandlers?: { accept: EventListener; reject: EventListener } })._suggestionHandlers;
    if (handlers) {
      this.editor.view.dom.removeEventListener('suggestion:accept', handlers.accept);
      this.editor.view.dom.removeEventListener('suggestion:reject', handlers.reject);
    }
  },
});

export default SuggestionPlugin;

/**
 * Helper to get suggestion state from editor
 */
export function getSuggestionState(editor: { state: { plugins: Plugin[] } }): SuggestionPluginState | undefined {
  return suggestionPluginKey.getState(editor.state as unknown as Parameters<typeof suggestionPluginKey.getState>[0]);
}
