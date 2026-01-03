import { Node, mergeAttributes } from "@tiptap/core";

export interface SceneListOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneList: {
      insertSceneList: (attributes?: { chapterId?: string | null }) => ReturnType;
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
