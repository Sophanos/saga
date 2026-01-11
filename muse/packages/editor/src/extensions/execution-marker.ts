import { Mark, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Fragment, Slice, type MarkType, type Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface ExecutionMarkerOptions {
  HTMLAttributes: Record<string, unknown>;
}

interface ExecutionMarkerStorage {
  projectId: string | null;
}

const executionMarkerPluginKey = new PluginKey("executionMarker");

function stripExecutionMarkersFromFragment(
  fragment: Fragment,
  markType: MarkType,
  projectId: string
): Fragment {
  const nodes: ProseMirrorNode[] = [];
  let changed = false;

  fragment.forEach((child) => {
    const nextChild = stripExecutionMarkersFromNode(child, markType, projectId);
    if (nextChild !== child) {
      changed = true;
    }
    nodes.push(nextChild);
  });

  return changed ? Fragment.fromArray(nodes) : fragment;
}

function stripExecutionMarkersFromNode(
  node: ProseMirrorNode,
  markType: MarkType,
  projectId: string
): ProseMirrorNode {
  if (node.isText) {
    const nextMarks = node.marks.filter((mark) => {
      if (mark.type !== markType) return true;
      return mark.attrs?.projectId === projectId;
    });
    if (nextMarks.length === node.marks.length) {
      return node;
    }
    return node.mark(nextMarks);
  }

  if (!node.content.size) {
    return node;
  }

  const nextContent = stripExecutionMarkersFromFragment(
    node.content,
    markType,
    projectId
  );
  if (nextContent === node.content) {
    return node;
  }

  return node.copy(nextContent);
}

function stripExecutionMarkersFromSlice(
  slice: Slice,
  markType: MarkType,
  projectId: string
): Slice {
  const nextContent = stripExecutionMarkersFromFragment(
    slice.content,
    markType,
    projectId
  );
  if (nextContent === slice.content) {
    return slice;
  }
  return new Slice(nextContent, slice.openStart, slice.openEnd);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    executionMarker: {
      setExecutionMarkerProjectId: (projectId: string | null) => ReturnType;
      setExecutionMarker: (attributes: {
        executionId: string;
        widgetId: string;
        projectId: string;
      }) => ReturnType;
      unsetExecutionMarker: () => ReturnType;
      removeExecutionMarkerById: (executionId: string) => ReturnType;
    };
  }
}

export const ExecutionMarker = Mark.create<ExecutionMarkerOptions>({
  name: "executionMarker",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addStorage(): ExecutionMarkerStorage {
    return {
      projectId: null,
    };
  },

  addAttributes() {
    return {
      executionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-execution-id"),
        renderHTML: (attributes) => {
          if (!attributes["executionId"]) {
            return {};
          }
          return {
            "data-execution-id": attributes["executionId"],
          };
        },
      },
      widgetId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-widget-id"),
        renderHTML: (attributes) => {
          if (!attributes["widgetId"]) {
            return {};
          }
          return {
            "data-widget-id": attributes["widgetId"],
          };
        },
      },
      projectId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-project-id"),
        renderHTML: (attributes) => {
          if (!attributes["projectId"]) {
            return {};
          }
          return {
            "data-project-id": attributes["projectId"],
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-execution-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "execution-marker",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setExecutionMarkerProjectId:
        (projectId) =>
        ({ editor }) => {
          editor.storage.executionMarker.projectId = projectId;
          return true;
        },
      setExecutionMarker:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetExecutionMarker:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
      removeExecutionMarkerById:
        (executionId) =>
        ({ tr, dispatch, state }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) {
            return false;
          }

          let hasChanges = false;
          state.doc.nodesBetween(0, state.doc.content.size, (node, pos) => {
            if (!node.isText) return;
            if (!node.marks.length) return;

            const hasMarker = node.marks.some(
              (mark) =>
                mark.type === markType &&
                mark.attrs?.executionId === executionId
            );
            if (!hasMarker) return;

            tr.removeMark(pos, pos + node.nodeSize, markType);
            hasChanges = true;
          });

          if (hasChanges && dispatch) {
            dispatch(tr);
          }

          return hasChanges;
        },
    };
  },

  addProseMirrorPlugins() {
    const { editor } = this;
    const markType = editor.schema.marks[this.name];

    return [
      new Plugin({
        key: executionMarkerPluginKey,
        props: {
          transformPasted: (slice) => {
            const currentProjectId = editor.storage.executionMarker?.projectId;
            if (!currentProjectId || !markType) {
              return slice;
            }

            return stripExecutionMarkersFromSlice(
              slice,
              markType,
              currentProjectId
            );
          },
        },
      }),
    ];
  },
});
