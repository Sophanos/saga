import { Mark, mergeAttributes } from "@tiptap/core";

export interface AIGeneratedMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiGeneratedMark: {
      setAIGeneratedMark: (attributes: {
        aiId: string;
        aiTool: string;
        aiModel?: string;
        aiTimestamp?: string;
        aiStatus?: "accepted" | "rejected" | "pending";
      }) => ReturnType;
      unsetAIGeneratedMark: () => ReturnType;
    };
  }
}

export const AIGeneratedMark = Mark.create<AIGeneratedMarkOptions>({
  name: "aiGenerated",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      aiId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-ai-id"),
        renderHTML: (attributes) => {
          if (!attributes["aiId"]) {
            return {};
          }
          return {
            "data-ai-id": attributes["aiId"],
          };
        },
      },
      aiTool: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-ai-tool"),
        renderHTML: (attributes) => {
          if (!attributes["aiTool"]) {
            return {};
          }
          return {
            "data-ai-tool": attributes["aiTool"],
          };
        },
      },
      aiModel: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-ai-model"),
        renderHTML: (attributes) => {
          if (!attributes["aiModel"]) {
            return {};
          }
          return {
            "data-ai-model": attributes["aiModel"],
          };
        },
      },
      aiTimestamp: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-ai-timestamp"),
        renderHTML: (attributes) => {
          if (!attributes["aiTimestamp"]) {
            return {};
          }
          return {
            "data-ai-timestamp": attributes["aiTimestamp"],
          };
        },
      },
      aiStatus: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-ai-status"),
        renderHTML: (attributes) => {
          if (!attributes["aiStatus"]) {
            return {};
          }
          return {
            "data-ai-status": attributes["aiStatus"],
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-ai-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "ai-generated",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setAIGeneratedMark:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetAIGeneratedMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
