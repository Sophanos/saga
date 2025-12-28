import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface LinterIssue {
  id: string;
  severity: "error" | "warning" | "info";
  location: { line: number; text: string };
  message: string;
}

export interface LinterDecorationOptions {
  issues: LinterIssue[];
}

const linterDecorationPluginKey = new PluginKey<DecorationSet>(
  "linterDecoration"
);

/**
 * Find all occurrences of a text string in the ProseMirror document
 * Returns an array of { from, to } positions
 *
 * This properly handles multi-block documents by walking the document structure
 * and accounting for block boundaries in position calculations.
 */
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
 * Create decorations for linter issues
 */
function createDecorations(
  doc: ProseMirrorNode,
  issues: LinterIssue[]
): DecorationSet {
  const decorations: Decoration[] = [];

  for (const issue of issues) {
    const { text } = issue.location;
    const positions = findTextPositions(doc, text);

    // Create a decoration for the first occurrence
    // (issues are typically unique per location)
    if (positions.length > 0) {
      const { from, to } = positions[0];
      const severityClass = `linter-${issue.severity}`;

      const decoration = Decoration.inline(from, to, {
        class: `linter-squiggle ${severityClass}`,
        "data-linter-issue-id": issue.id,
        "data-linter-severity": issue.severity,
        title: issue.message,
      });

      decorations.push(decoration);
    }
  }

  return DecorationSet.create(doc, decorations);
}

export const LinterDecoration = Extension.create<LinterDecorationOptions>({
  name: "linterDecoration",

  addOptions() {
    return {
      issues: [],
    };
  },

  addProseMirrorPlugins() {
    const { options } = this;

    return [
      new Plugin<DecorationSet>({
        key: linterDecorationPluginKey,

        state: {
          init(_, { doc }) {
            return createDecorations(doc, options.issues);
          },

          apply(tr, oldDecorationSet, _oldState, newState) {
            // If there's a meta update for linter issues, recreate decorations
            const newIssues = tr.getMeta(linterDecorationPluginKey) as
              | LinterIssue[]
              | undefined;
            if (newIssues !== undefined) {
              return createDecorations(newState.doc, newIssues);
            }

            // If the document changed, map the decorations to new positions
            if (tr.docChanged) {
              return oldDecorationSet.map(tr.mapping, tr.doc);
            }

            return oldDecorationSet;
          },
        },

        props: {
          decorations(state) {
            return linterDecorationPluginKey.getState(state);
          },
        },
      }),
    ];
  },

  /**
   * Command to update linter issues
   * Usage: editor.commands.setLinterIssues(issues)
   */
  addCommands() {
    return {
      setLinterIssues:
        (issues: LinterIssue[]) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(linterDecorationPluginKey, issues);
            dispatch(tr);
          }
          return true;
        },
    };
  },
});

// Augment the Commands interface for type safety
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linterDecoration: {
      setLinterIssues: (issues: LinterIssue[]) => ReturnType;
    };
  }
}
