import { Node, mergeAttributes } from "@tiptap/core";

export interface SceneListOptions {
  HTMLAttributes: Record<string, unknown>;
}

export type SceneListMode = "latest" | "list";
export type SceneListSortBy = "createdAt" | "updatedAt" | "orderIndex";
export type SceneListSortDir = "asc" | "desc";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneList: {
      insertSceneList: (attributes?: {
        chapterId?: string | null;
        mode?: SceneListMode;
        sortBy?: SceneListSortBy;
        sortDir?: SceneListSortDir;
      }) => ReturnType;
    };
  }
}

export const SceneList = Node.create<SceneListOptions>({
  name: "sceneList",

  group: "block",

  atom: true,

  selectable: false,

  draggable: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      chapterId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-chapter-id"),
        renderHTML: (attributes) => {
          if (!attributes["chapterId"]) return {};
          return { "data-chapter-id": attributes["chapterId"] };
        },
      },
      mode: {
        default: "list",
        parseHTML: (element) => element.getAttribute("data-mode") ?? "list",
        renderHTML: (attributes) => {
          if (!attributes["mode"]) return {};
          return { "data-mode": attributes["mode"] };
        },
      },
      sortBy: {
        default: "orderIndex",
        parseHTML: (element) =>
          element.getAttribute("data-sort-by") ?? "orderIndex",
        renderHTML: (attributes) => {
          if (!attributes["sortBy"]) return {};
          return { "data-sort-by": attributes["sortBy"] };
        },
      },
      sortDir: {
        default: "asc",
        parseHTML: (element) => element.getAttribute("data-sort-dir") ?? "asc",
        renderHTML: (attributes) => {
          if (!attributes["sortDir"]) return {};
          return { "data-sort-dir": attributes["sortDir"] };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "section[data-scene-list]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-scene-list": "",
        class: "scene-list-block",
      }),
    ];
  },

  addCommands() {
    return {
      insertSceneList:
        (attributes = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          });
        },
    };
  },
});
