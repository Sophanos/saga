/**
 * FlowFocus Extension - iA Writer-style sentence/paragraph dimming
 *
 * Creates a focus effect by dimming text outside the current sentence or paragraph,
 * drawing the writer's attention to their immediate writing context.
 *
 * Works in two modes:
 * 1. Flow Mode: Auto-activates when Flow Mode is enabled (reads from Flow store)
 * 2. Standalone: Can be enabled independently via commands
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState, Transaction } from '@tiptap/pm/state';

// =============================================================================
// Types
// =============================================================================

export type FocusLevel = 'none' | 'sentence' | 'paragraph';

export interface FlowFocusState {
  /** Active focus level */
  focusLevel: FocusLevel;
  /** Opacity for dimmed text (0-1) */
  dimOpacity: number;
  /** Whether focus mode is enabled externally (from Flow Mode) */
  externallyEnabled: boolean;
  /** Active range that should be highlighted (not dimmed) */
  activeRange: { from: number; to: number } | null;
}

export interface FlowFocusOptions {
  /** Initial focus level */
  focusLevel?: FocusLevel;
  /** Dim opacity (0-1) */
  dimOpacity?: number;
  /** CSS class for dimmed text */
  dimmedClass?: string;
  /** CSS class for focused text */
  focusedClass?: string;
}

export const flowFocusPluginKey = new PluginKey<FlowFocusState>('flowFocus');

// =============================================================================
// Sentence Segmentation
// =============================================================================

/**
 * Get sentence boundaries using Intl.Segmenter with regex fallback
 */
function getSentenceBoundaries(text: string): Array<{ start: number; end: number }> {
  const boundaries: Array<{ start: number; end: number }> = [];

  // Try Intl.Segmenter first (modern browsers)
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
      let offset = 0;
      for (const segment of segmenter.segment(text)) {
        const start = offset;
        const end = offset + segment.segment.length;
        if (segment.segment.trim().length > 0) {
          boundaries.push({ start, end });
        }
        offset = end;
      }
      return boundaries;
    } catch {
      // Fall through to regex
    }
  }

  // Regex fallback for older browsers
  const sentenceRegex = /[^.!?]*[.!?]+\s*/g;
  let match: RegExpExecArray | null;
  let lastEnd = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    boundaries.push({
      start: match.index,
      end: match.index + match[0].length,
    });
    lastEnd = match.index + match[0].length;
  }

  // Handle remaining text without punctuation
  if (lastEnd < text.length) {
    const remaining = text.slice(lastEnd);
    if (remaining.trim().length > 0) {
      boundaries.push({ start: lastEnd, end: text.length });
    }
  }

  return boundaries;
}

/**
 * Find the sentence containing a given offset
 */
function findSentenceAtOffset(
  text: string,
  offset: number
): { start: number; end: number } | null {
  const sentences = getSentenceBoundaries(text);

  for (const sentence of sentences) {
    if (offset >= sentence.start && offset <= sentence.end) {
      return sentence;
    }
  }

  // If we're at the very end, return the last sentence
  if (sentences.length > 0 && offset >= text.length) {
    return sentences[sentences.length - 1];
  }

  return null;
}

// =============================================================================
// Range Calculation
// =============================================================================

/**
 * Get the paragraph range containing the cursor
 */
function getParagraphRange(
  state: EditorState
): { from: number; to: number } | null {
  const { selection } = state;
  const $pos = selection.$from;

  // Find the nearest block-level node (paragraph, heading, etc.)
  let blockStart = $pos.start();
  let blockEnd = $pos.end();

  // Walk up to find the actual paragraph bounds
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.isTextblock) {
      blockStart = $pos.start(depth);
      blockEnd = $pos.end(depth);
      break;
    }
  }

  return { from: blockStart, to: blockEnd };
}

/**
 * Get the sentence range containing the cursor
 */
function getSentenceRange(
  state: EditorState
): { from: number; to: number } | null {
  const { selection, doc } = state;

  // First get the paragraph containing the cursor
  const paragraphRange = getParagraphRange(state);
  if (!paragraphRange) return null;

  // Extract paragraph text
  const paragraphText = doc.textBetween(paragraphRange.from, paragraphRange.to);
  if (!paragraphText) return null;

  // Calculate cursor offset within paragraph
  const cursorOffsetInParagraph = selection.from - paragraphRange.from;

  // Find sentence at cursor position
  const sentenceInParagraph = findSentenceAtOffset(paragraphText, cursorOffsetInParagraph);
  if (!sentenceInParagraph) return null;

  return {
    from: paragraphRange.from + sentenceInParagraph.start,
    to: paragraphRange.from + sentenceInParagraph.end,
  };
}

/**
 * Get the active range based on focus level
 */
function getActiveRange(
  state: EditorState,
  focusLevel: FocusLevel
): { from: number; to: number } | null {
  if (focusLevel === 'none') return null;
  if (focusLevel === 'paragraph') return getParagraphRange(state);
  if (focusLevel === 'sentence') return getSentenceRange(state);
  return null;
}

// =============================================================================
// Decorations
// =============================================================================

function createFocusDecorations(
  state: EditorState,
  pluginState: FlowFocusState,
  options: FlowFocusOptions
): DecorationSet {
  const { focusLevel, dimOpacity, activeRange } = pluginState;

  if (focusLevel === 'none' || !activeRange) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];
  const dimmedClass = options.dimmedClass || 'flow-dimmed';

  // Create decorations for all text nodes EXCEPT those in the active range
  state.doc.descendants((node, pos) => {
    // Only process text nodes
    if (!node.isText) return true;

    const nodeStart = pos;
    const nodeEnd = pos + node.nodeSize;

    // Check if this node overlaps with active range
    const overlapStart = Math.max(nodeStart, activeRange.from);
    const overlapEnd = Math.min(nodeEnd, activeRange.to);
    const hasOverlap = overlapStart < overlapEnd;

    if (!hasOverlap) {
      // Entire text node is dimmed
      decorations.push(
        Decoration.inline(nodeStart, nodeEnd, {
          class: dimmedClass,
          style: `opacity: ${dimOpacity}; transition: opacity 150ms ease;`,
        })
      );
    } else {
      // Partial overlap - dim before and after the active range
      if (nodeStart < activeRange.from) {
        decorations.push(
          Decoration.inline(nodeStart, activeRange.from, {
            class: dimmedClass,
            style: `opacity: ${dimOpacity}; transition: opacity 150ms ease;`,
          })
        );
      }
      if (activeRange.to < nodeEnd) {
        decorations.push(
          Decoration.inline(activeRange.to, nodeEnd, {
            class: dimmedClass,
            style: `opacity: ${dimOpacity}; transition: opacity 150ms ease;`,
          })
        );
      }
    }

    return true;
  });

  return DecorationSet.create(state.doc, decorations);
}

// =============================================================================
// Plugin
// =============================================================================

type FlowFocusMeta =
  | { type: 'setFocusLevel'; level: FocusLevel }
  | { type: 'setDimOpacity'; opacity: number }
  | { type: 'setExternallyEnabled'; enabled: boolean }
  | { type: 'updateActiveRange' };

function createFlowFocusPlugin(options: FlowFocusOptions): Plugin<FlowFocusState> {
  return new Plugin<FlowFocusState>({
    key: flowFocusPluginKey,

    state: {
      init(_, state): FlowFocusState {
        const focusLevel = options.focusLevel || 'none';
        return {
          focusLevel,
          dimOpacity: options.dimOpacity || 0.3,
          externallyEnabled: false,
          activeRange: getActiveRange(state, focusLevel),
        };
      },

      apply(tr, value, _, newState): FlowFocusState {
        const meta = tr.getMeta(flowFocusPluginKey) as FlowFocusMeta | undefined;
        let newValue = value;

        if (meta) {
          switch (meta.type) {
            case 'setFocusLevel':
              newValue = { ...value, focusLevel: meta.level };
              break;
            case 'setDimOpacity':
              newValue = { ...value, dimOpacity: meta.opacity };
              break;
            case 'setExternallyEnabled':
              newValue = { ...value, externallyEnabled: meta.enabled };
              break;
            case 'updateActiveRange':
              // Just recalculate
              break;
          }
        }

        // Recalculate active range on selection or doc change
        if (tr.selectionSet || tr.docChanged || meta) {
          const activeRange = getActiveRange(newState, newValue.focusLevel);
          newValue = { ...newValue, activeRange };
        }

        return newValue;
      },
    },

    props: {
      decorations(state) {
        const pluginState = flowFocusPluginKey.getState(state);
        if (!pluginState) return DecorationSet.empty;
        return createFocusDecorations(state, pluginState, options);
      },
    },
  });
}

// =============================================================================
// Extension
// =============================================================================

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    flowFocus: {
      /** Set the focus level (none, sentence, paragraph) */
      setFlowFocusLevel: (level: FocusLevel) => ReturnType;
      /** Set the dim opacity (0-1) */
      setFlowDimOpacity: (opacity: number) => ReturnType;
      /** Toggle focus mode on/off */
      toggleFlowFocus: () => ReturnType;
      /** Cycle through focus levels */
      cycleFlowFocusLevel: () => ReturnType;
    };
  }
}

export const FlowFocusExtension = Extension.create<FlowFocusOptions>({
  name: 'flowFocus',

  addOptions() {
    return {
      focusLevel: 'none' as FocusLevel,
      dimOpacity: 0.3,
      dimmedClass: 'flow-dimmed',
      focusedClass: 'flow-focused',
    };
  },

  addProseMirrorPlugins() {
    return [createFlowFocusPlugin(this.options)];
  },

  addCommands() {
    return {
      setFlowFocusLevel:
        (level: FocusLevel) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(flowFocusPluginKey, { type: 'setFocusLevel', level });
          }
          return true;
        },

      setFlowDimOpacity:
        (opacity: number) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const clampedOpacity = Math.max(0.1, Math.min(0.9, opacity));
            tr.setMeta(flowFocusPluginKey, { type: 'setDimOpacity', opacity: clampedOpacity });
          }
          return true;
        },

      toggleFlowFocus:
        () =>
        ({ tr, dispatch, state }) => {
          const pluginState = flowFocusPluginKey.getState(state);
          if (!pluginState) return false;

          const newLevel: FocusLevel = pluginState.focusLevel === 'none' ? 'paragraph' : 'none';
          if (dispatch) {
            tr.setMeta(flowFocusPluginKey, { type: 'setFocusLevel', level: newLevel });
          }
          return true;
        },

      cycleFlowFocusLevel:
        () =>
        ({ tr, dispatch, state }) => {
          const pluginState = flowFocusPluginKey.getState(state);
          if (!pluginState) return false;

          const levels: FocusLevel[] = ['none', 'sentence', 'paragraph'];
          const currentIndex = levels.indexOf(pluginState.focusLevel);
          const nextIndex = (currentIndex + 1) % levels.length;
          const newLevel = levels[nextIndex];

          if (dispatch) {
            tr.setMeta(flowFocusPluginKey, { type: 'setFocusLevel', level: newLevel });
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Toggle focus mode with Cmd/Ctrl + Shift + F
      'Mod-Shift-f': () => this.editor.commands.toggleFlowFocus(),
    };
  },

  // Storage for external sync (Flow Mode integration)
  addStorage() {
    return {
      focusLevel: this.options.focusLevel,
      dimOpacity: this.options.dimOpacity,
    };
  },
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get current focus state from editor
 */
export function getFlowFocusState(state: EditorState): FlowFocusState | null {
  return flowFocusPluginKey.getState(state) ?? null;
}

/**
 * Update focus level from external source (Flow Mode)
 */
export function updateFlowFocusFromStore(
  editor: { view: { dispatch: (tr: Transaction) => void }; state: EditorState },
  focusLevel: FocusLevel,
  dimOpacity?: number
): void {
  const tr = editor.state.tr;
  tr.setMeta(flowFocusPluginKey, { type: 'setFocusLevel', level: focusLevel });
  if (dimOpacity !== undefined) {
    tr.setMeta(flowFocusPluginKey, { type: 'setDimOpacity', opacity: dimOpacity });
  }
  editor.view.dispatch(tr);
}

export default FlowFocusExtension;
