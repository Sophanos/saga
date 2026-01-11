import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
const DEFAULT_HIGHLIGHT_DURATION_MS = 3500;

interface AppliedHighlightMeta {
  type: "add" | "remove" | "clear";
  id?: string;
  from?: number;
  to?: number;
}

const appliedHighlightPluginKey = new PluginKey<DecorationSet>(
  "appliedHighlight"
);

function createAppliedDecoration(
  from: number,
  to: number,
  id: string
): Decoration {
  return Decoration.inline(
    from,
    to,
    {
      class: "widget-applied-highlight",
      "data-highlight-id": id,
    },
    { id }
  );
}

function removeDecorationsById(
  decorations: DecorationSet,
  id: string
): DecorationSet {
  const toRemove = decorations.find(undefined, undefined, (spec) => spec.id === id);
  if (toRemove.length === 0) {
    return decorations;
  }
  return decorations.remove(toRemove);
}

export const AppliedHighlight = Extension.create({
  name: "appliedHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: appliedHighlightPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, oldDecorationSet, _oldState, newState) {
            const meta = tr.getMeta(appliedHighlightPluginKey) as
              | AppliedHighlightMeta
              | undefined;
            let decorations = oldDecorationSet;

            if (meta?.type === "add" && meta.id && meta.from !== undefined && meta.to !== undefined) {
              const decoration = createAppliedDecoration(meta.from, meta.to, meta.id);
              decorations = decorations.add(newState.doc, [decoration]);
            } else if (meta?.type === "remove" && meta.id) {
              decorations = removeDecorationsById(decorations, meta.id);
            } else if (meta?.type === "clear") {
              decorations = DecorationSet.empty;
            }

            if (tr.docChanged) {
              decorations = decorations.map(tr.mapping, tr.doc);
            }

            return decorations;
          },
        },
        props: {
          decorations(state) {
            return appliedHighlightPluginKey.getState(state);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setAppliedHighlight:
        (range: { from: number; to: number }, durationMs?: number) =>
        ({ editor, dispatch }) => {
          const safeFrom = Math.max(0, range.from);
          const safeTo = Math.max(safeFrom, range.to);
          const id = `applied-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          if (dispatch) {
            const tr = editor.state.tr.setMeta(appliedHighlightPluginKey, {
              type: "add",
              id,
              from: safeFrom,
              to: safeTo,
            } satisfies AppliedHighlightMeta);
            dispatch(tr);
          }

          const timeoutMs =
            typeof durationMs === "number" ? durationMs : DEFAULT_HIGHLIGHT_DURATION_MS;

          if (timeoutMs > 0) {
            const clear = () => {
              if (editor.isDestroyed) return;
              editor.view.dispatch(
                editor.state.tr.setMeta(appliedHighlightPluginKey, {
                  type: "remove",
                  id,
                } satisfies AppliedHighlightMeta)
              );
            };
            setTimeout(clear, timeoutMs);
          }

          return true;
        },
      clearAppliedHighlights:
        () =>
        ({ editor, dispatch }) => {
          if (dispatch) {
            dispatch(
              editor.state.tr.setMeta(appliedHighlightPluginKey, {
                type: "clear",
              } satisfies AppliedHighlightMeta)
            );
          }
          return true;
        },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    appliedHighlight: {
      setAppliedHighlight: (
        range: { from: number; to: number },
        durationMs?: number
      ) => ReturnType;
      clearAppliedHighlights: () => ReturnType;
    };
  }
}
