import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { StyleIssue, StyleIssueType } from "@mythos/core";

/**
 * Options for StyleDecoration extension
 */
export interface StyleDecorationOptions {
  /** Callback when user selects an issue via editor interactions (click/keyboard) */
  onIssueSelect?: (issueId: string) => void;
  /** Callback when navigation occurs (for jumping to issue) */
  onNavigate?: (issueId: string) => void;
}

/**
 * Plugin state for style decorations
 */
interface StyleDecorationPluginState {
  decorations: DecorationSet;
  issues: StyleIssue[];
  selectedStyleIssueId: string | null;
  /** Issue IDs in document order (for navigation) */
  orderedIssueIds: string[];
}

/**
 * Metadata actions for updating plugin state
 */
interface StyleDecorationMeta {
  type: "setIssues" | "setSelectedIssue";
  issues?: StyleIssue[];
  selectedIssueId?: string | null;
}

const styleDecorationPluginKey = new PluginKey<StyleDecorationPluginState>(
  "styleDecoration"
);

/**
 * Map StyleIssueType to CSS class suffix
 */
const TYPE_CLASS_MAP: Record<StyleIssueType, string> = {
  // Coach style issues
  telling: "style-telling",
  passive: "style-passive",
  adverb: "style-adverb",
  repetition: "style-repetition",
  // Clarity issues
  ambiguous_pronoun: "style-ambiguous-pronoun",
  unclear_antecedent: "style-unclear-antecedent",
  cliche: "style-cliche",
  filler_word: "style-filler-word",
  dangling_modifier: "style-dangling-modifier",
};

/**
 * Find all occurrences of a text string in the ProseMirror document
 * Returns an array of { from, to } positions
 *
 * This properly handles multi-block documents by walking the document structure
 * and accounting for block boundaries in position calculations.
 */
/**
 * Convert a character offset to a ProseMirror document position.
 * This properly handles multi-block documents.
 */
function charOffsetToDocPos(
  doc: ProseMirrorNode,
  charOffset: number
): number {
  // Build a map of character offsets to positions
  let currentOffset = 0;
  let result = 1; // Default to start of document

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const textLength = node.text.length;
      if (currentOffset + textLength > charOffset) {
        // The offset is within this text node
        result = pos + (charOffset - currentOffset);
        return false; // Stop traversal
      }
      currentOffset += textLength;
    }
    return true;
  });

  return Math.min(result, doc.content.size);
}

/**
 * Verify that a position range in the document matches the expected text.
 */
function verifyPositionText(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  expectedText: string
): boolean {
  try {
    const actualText = doc.textBetween(from, to, "");
    return actualText === expectedText;
  } catch {
    return false;
  }
}

function findTextPositions(
  doc: ProseMirrorNode,
  searchText: string
): Array<{ from: number; to: number }> {
  const positions: Array<{ from: number; to: number }> = [];

  if (!searchText || searchText.trim().length === 0) {
    return positions;
  }

  // Build a map of text offsets to ProseMirror positions by walking the document
  // This properly accounts for block boundaries
  const textNodes: Array<{ text: string; pmPos: number; textOffset: number }> =
    [];
  let cumulativeTextOffset = 0;

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      textNodes.push({
        text: node.text,
        pmPos: pos,
        textOffset: cumulativeTextOffset,
      });
      cumulativeTextOffset += node.text.length;
    }
    return true;
  });

  // Concatenate all text to search in
  const fullText = textNodes.map((n) => n.text).join("");

  // Find all occurrences in the concatenated text
  let searchIndex = 0;
  let foundIndex = fullText.indexOf(searchText, searchIndex);

  while (foundIndex !== -1) {
    // Convert text offset to ProseMirror position
    // Find which text node contains the start of this match
    let from = 0;
    let to = 0;

    for (let i = 0; i < textNodes.length; i++) {
      const node = textNodes[i];
      const nodeEnd = node.textOffset + node.text.length;

      // Check if match starts in this node
      if (foundIndex >= node.textOffset && foundIndex < nodeEnd) {
        const offsetInNode = foundIndex - node.textOffset;
        from = node.pmPos + offsetInNode;

        // Find where the match ends
        const matchEnd = foundIndex + searchText.length;
        for (let j = i; j < textNodes.length; j++) {
          const endNode = textNodes[j];
          const endNodeEnd = endNode.textOffset + endNode.text.length;

          if (matchEnd <= endNodeEnd) {
            const endOffsetInNode = matchEnd - endNode.textOffset;
            to = endNode.pmPos + endOffsetInNode;
            break;
          }
        }
        break;
      }
    }

    // Validate positions are within document bounds
    if (from > 0 && to > from && to <= doc.content.size) {
      positions.push({ from, to });
    }

    searchIndex = foundIndex + 1;
    foundIndex = fullText.indexOf(searchText, searchIndex);
  }

  return positions;
}

/**
 * Create decorations for style issues
 */
function createDecorations(
  doc: ProseMirrorNode,
  issues: StyleIssue[],
  selectedIssueId: string | null
): { decorations: DecorationSet; orderedIssueIds: string[] } {
  const decorations: Decoration[] = [];
  const issuePositions: Array<{ id: string; from: number }> = [];

  for (const issue of issues) {
    // Use fix.oldText if available, otherwise use issue.text
    const searchText = issue.fix?.oldText ?? issue.text;
    let from: number | undefined;
    let to: number | undefined;

    // Try to use position offsets if available (more accurate for repeated text)
    if (issue.position?.start !== undefined && issue.position?.end !== undefined) {
      const posFrom = charOffsetToDocPos(doc, issue.position.start);
      const posTo = charOffsetToDocPos(doc, issue.position.end);

      // Verify the text at this position matches
      if (verifyPositionText(doc, posFrom, posTo, searchText)) {
        from = posFrom;
        to = posTo;
      }
    }

    // Fallback to text search if position-based lookup failed
    if (from === undefined || to === undefined) {
      const positions = findTextPositions(doc, searchText);
      if (positions.length > 0) {
        from = positions[0].from;
        to = positions[0].to;
      }
    }

    // Create decoration if we found a valid position
    if (from !== undefined && to !== undefined) {
      const typeClass = TYPE_CLASS_MAP[issue.type] ?? "style-telling";
      const isSelected = issue.id === selectedIssueId;

      const decoration = Decoration.inline(from, to, {
        class: `style-squiggle ${typeClass}${isSelected ? " style-selected" : ""}`,
        "data-style-issue-id": issue.id,
        "data-style-issue-type": issue.type,
        title: issue.suggestion,
      });

      decorations.push(decoration);
      issuePositions.push({ id: issue.id, from });
    }
  }

  // Sort issue IDs by their position in the document
  issuePositions.sort((a, b) => a.from - b.from);
  const orderedIssueIds = issuePositions.map((p) => p.id);

  return {
    decorations: DecorationSet.create(doc, decorations),
    orderedIssueIds,
  };
}

export const StyleDecoration = Extension.create<StyleDecorationOptions>({
  name: "styleDecoration",

  addOptions() {
    return {
      onIssueSelect: undefined,
      onNavigate: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { options } = this;

    return [
      new Plugin<StyleDecorationPluginState>({
        key: styleDecorationPluginKey,

        state: {
          init(_, { doc }) {
            const { decorations, orderedIssueIds } = createDecorations(
              doc,
              [],
              null
            );
            return {
              decorations,
              issues: [],
              selectedStyleIssueId: null,
              orderedIssueIds,
            };
          },

          apply(tr, oldState, _oldEditorState, newEditorState) {
            const meta = tr.getMeta(styleDecorationPluginKey) as
              | StyleDecorationMeta
              | undefined;

            if (meta) {
              if (meta.type === "setIssues" && meta.issues !== undefined) {
                const { decorations, orderedIssueIds } = createDecorations(
                  newEditorState.doc,
                  meta.issues,
                  oldState.selectedStyleIssueId
                );
                return {
                  decorations,
                  issues: meta.issues,
                  selectedStyleIssueId: oldState.selectedStyleIssueId,
                  orderedIssueIds,
                };
              }

              if (
                meta.type === "setSelectedIssue" &&
                meta.selectedIssueId !== undefined
              ) {
                const { decorations, orderedIssueIds } = createDecorations(
                  newEditorState.doc,
                  oldState.issues,
                  meta.selectedIssueId
                );
                return {
                  decorations,
                  issues: oldState.issues,
                  selectedStyleIssueId: meta.selectedIssueId,
                  orderedIssueIds,
                };
              }
            }

            // If the document changed, map the decorations to new positions
            if (tr.docChanged) {
              const { decorations, orderedIssueIds } = createDecorations(
                newEditorState.doc,
                oldState.issues,
                oldState.selectedStyleIssueId
              );
              return {
                ...oldState,
                decorations,
                orderedIssueIds,
              };
            }

            return oldState;
          },
        },

        props: {
          decorations(state) {
            return styleDecorationPluginKey.getState(state)?.decorations;
          },

          handleClick(view, _pos, event) {
            // Find if we clicked on a style issue decoration
            const target = event.target as HTMLElement;
            const issueElement = target.closest("[data-style-issue-id]");

            if (issueElement) {
              const issueId = issueElement.getAttribute("data-style-issue-id");
              if (issueId) {
                // Update selection in the plugin
                const tr = view.state.tr.setMeta(styleDecorationPluginKey, {
                  type: "setSelectedIssue",
                  selectedIssueId: issueId,
                } as StyleDecorationMeta);
                view.dispatch(tr);

                // Notify the app via callback
                options.onIssueSelect?.(issueId);
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },

  /**
   * Commands for managing style decorations
   */
  addCommands() {
    return {
      setStyleIssues:
        (issues: StyleIssue[]) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(styleDecorationPluginKey, {
              type: "setIssues",
              issues,
            } as StyleDecorationMeta);
            dispatch(tr);
          }
          return true;
        },

      setSelectedStyleIssue:
        (issueId: string | null) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(styleDecorationPluginKey, {
              type: "setSelectedIssue",
              selectedIssueId: issueId,
            } as StyleDecorationMeta);
            dispatch(tr);
          }
          return true;
        },

      jumpToStyleIssue:
        (issueId: string) =>
        ({ editor, state }) => {
          const pluginState = styleDecorationPluginKey.getState(state);
          if (!pluginState) return false;

          const issue = pluginState.issues.find((i) => i.id === issueId);
          if (!issue) return false;

          // Find the position of the issue in the document
          const searchText = issue.fix?.oldText ?? issue.text;
          let from: number | undefined;
          let to: number | undefined;

          // Try position-based lookup first
          if (issue.position?.start !== undefined && issue.position?.end !== undefined) {
            const posFrom = charOffsetToDocPos(state.doc, issue.position.start);
            const posTo = charOffsetToDocPos(state.doc, issue.position.end);
            if (verifyPositionText(state.doc, posFrom, posTo, searchText)) {
              from = posFrom;
              to = posTo;
            }
          }

          // Fallback to text search
          if (from === undefined || to === undefined) {
            const positions = findTextPositions(state.doc, searchText);
            if (positions.length > 0) {
              from = positions[0].from;
              to = positions[0].to;
            }
          }

          if (from !== undefined && to !== undefined) {
            // Focus and scroll to the position
            editor.commands.focus();
            editor.commands.setTextSelection({ from, to });

            // Scroll into view
            const domNode = editor.view.domAtPos(from);
            if (domNode.node instanceof Element) {
              domNode.node.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            } else if (domNode.node.parentElement) {
              domNode.node.parentElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }

            // Notify via callback
            this.options.onNavigate?.(issueId);
            return true;
          }

          return false;
        },

      selectNextStyleIssue:
        () =>
        ({ editor, state, dispatch, tr }) => {
          const pluginState = styleDecorationPluginKey.getState(state);
          if (!pluginState || pluginState.orderedIssueIds.length === 0) {
            return false;
          }

          const { orderedIssueIds, selectedStyleIssueId } = pluginState;
          let nextId: string;

          if (!selectedStyleIssueId) {
            // No selection - select the first issue
            nextId = orderedIssueIds[0];
          } else {
            const currentIndex = orderedIssueIds.indexOf(selectedStyleIssueId);
            // Wrap around to first issue if at end
            const nextIndex = (currentIndex + 1) % orderedIssueIds.length;
            nextId = orderedIssueIds[nextIndex];
          }

          if (dispatch) {
            tr.setMeta(styleDecorationPluginKey, {
              type: "setSelectedIssue",
              selectedIssueId: nextId,
            } as StyleDecorationMeta);
            dispatch(tr);
          }

          // Jump to the issue
          editor.commands.jumpToStyleIssue(nextId);

          // Notify the app via callback
          this.options.onIssueSelect?.(nextId);

          return true;
        },

      selectPreviousStyleIssue:
        () =>
        ({ editor, state, dispatch, tr }) => {
          const pluginState = styleDecorationPluginKey.getState(state);
          if (!pluginState || pluginState.orderedIssueIds.length === 0) {
            return false;
          }

          const { orderedIssueIds, selectedStyleIssueId } = pluginState;
          let prevId: string;

          if (!selectedStyleIssueId) {
            // No selection - select the last issue
            prevId = orderedIssueIds[orderedIssueIds.length - 1];
          } else {
            const currentIndex = orderedIssueIds.indexOf(selectedStyleIssueId);
            // Wrap around to last issue if at beginning
            const prevIndex =
              (currentIndex - 1 + orderedIssueIds.length) %
              orderedIssueIds.length;
            prevId = orderedIssueIds[prevIndex];
          }

          if (dispatch) {
            tr.setMeta(styleDecorationPluginKey, {
              type: "setSelectedIssue",
              selectedIssueId: prevId,
            } as StyleDecorationMeta);
            dispatch(tr);
          }

          // Jump to the issue
          editor.commands.jumpToStyleIssue(prevId);

          // Notify the app via callback
          this.options.onIssueSelect?.(prevId);

          return true;
        },
    };
  },

  /**
   * Keyboard shortcuts for navigation
   */
  addKeyboardShortcuts() {
    return {
      "Mod-]": () => this.editor.commands.selectNextStyleIssue(),
      "Mod-[": () => this.editor.commands.selectPreviousStyleIssue(),
    };
  },
});

// Augment the Commands interface for type safety
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    styleDecoration: {
      /** Set the list of style issues to display */
      setStyleIssues: (issues: StyleIssue[]) => ReturnType;
      /** Set the currently selected style issue */
      setSelectedStyleIssue: (issueId: string | null) => ReturnType;
      /** Jump to a specific style issue in the editor */
      jumpToStyleIssue: (issueId: string) => ReturnType;
      /** Select and jump to the next style issue */
      selectNextStyleIssue: () => ReturnType;
      /** Select and jump to the previous style issue */
      selectPreviousStyleIssue: () => ReturnType;
    };
  }
}

export { styleDecorationPluginKey };
