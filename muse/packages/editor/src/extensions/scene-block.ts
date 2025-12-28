import { Node, mergeAttributes } from "@tiptap/core";

export interface SceneBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sceneBlock: {
      setSceneBlock: (attributes?: {
        sceneId?: string;
        sceneName?: string;
        tensionLevel?: number;
      }) => ReturnType;
    };
  }
}

export const SceneBlock = Node.create<SceneBlockOptions>({
  name: "sceneBlock",

  group: "block",

  content: "block+",

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      sceneId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-scene-id"),
        renderHTML: (attributes) => {
          if (!attributes["sceneId"]) return {};
          return { "data-scene-id": attributes["sceneId"] };
        },
      },
      sceneName: {
        default: "Untitled Scene",
        parseHTML: (element) =>
          element.getAttribute("data-scene-name") || "Untitled Scene",
        renderHTML: (attributes) => {
          return { "data-scene-name": attributes["sceneName"] };
        },
      },
      tensionLevel: {
        default: 5,
        parseHTML: (element) =>
          parseInt(element.getAttribute("data-tension") || "5", 10),
        renderHTML: (attributes) => {
          return { "data-tension": attributes["tensionLevel"] };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "section[data-scene-block]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-scene-block": "",
        class: "scene-block",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setSceneBlock:
        (attributes = {}) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes);
        },
    };
  },
});
