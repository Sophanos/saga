import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ArtifactReceiptNodeView } from "./artifact-receipt-view";

export type ArtifactReceiptStaleness = "fresh" | "stale" | "missing" | "external";

export type ArtifactReceiptSource = {
  type: string;
  id: string;
  title?: string;
  status?: ArtifactReceiptStaleness;
};

export type ArtifactReceiptAttrs = {
  artifactKey: string;
  artifactId?: string;
  title?: string;
  artifactType?: string;
  sources?: ArtifactReceiptSource[];
  staleness?: ArtifactReceiptStaleness;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
};

export interface ArtifactReceiptOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    artifactReceipt: {
      /** Insert an artifact receipt block */
      insertArtifactReceipt: (attrs: ArtifactReceiptAttrs) => ReturnType;
      /** Update an existing artifact receipt by key */
      updateArtifactReceipt: (
        artifactKey: string,
        updates: Partial<ArtifactReceiptAttrs>
      ) => ReturnType;
      /** Remove an artifact receipt by key */
      removeArtifactReceipt: (artifactKey: string) => ReturnType;
    };
  }
}

export const ArtifactReceiptExtension = Node.create<ArtifactReceiptOptions>({
  name: "artifactReceipt",

  group: "block",

  atom: true,

  selectable: true,

  draggable: true,

  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      artifactKey: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-artifact-key") ?? "",
        renderHTML: (attributes) => {
          if (!attributes["artifactKey"]) return {};
          return { "data-artifact-key": attributes["artifactKey"] };
        },
      },
      artifactId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-artifact-id"),
        renderHTML: (attributes) => {
          if (!attributes["artifactId"]) return {};
          return { "data-artifact-id": attributes["artifactId"] };
        },
      },
      title: { default: null },
      artifactType: { default: null },
      sources: { default: null },
      staleness: { default: null },
      createdAt: { default: null },
      updatedAt: { default: null },
      createdBy: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-artifact-receipt]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-artifact-receipt": "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ArtifactReceiptNodeView);
  },

  addCommands() {
    return {
      insertArtifactReceipt:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs });
        },

      updateArtifactReceipt:
        (artifactKey: string, updates: Partial<ArtifactReceiptAttrs>) =>
        ({ tr, state, dispatch }) => {
          let updated = false;
          state.doc.descendants((node, pos) => {
            if (
              node.type.name === this.name &&
              node.attrs["artifactKey"] === artifactKey
            ) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  ...updates,
                });
              }
              updated = true;
              return false;
            }
            return true;
          });
          return updated;
        },

      removeArtifactReceipt:
        (artifactKey: string) =>
        ({ tr, state, dispatch }) => {
          let removed = false;
          state.doc.descendants((node, pos) => {
            if (
              node.type.name === this.name &&
              node.attrs["artifactKey"] === artifactKey
            ) {
              if (dispatch) {
                tr.delete(pos, pos + node.nodeSize);
              }
              removed = true;
              return false;
            }
            return true;
          });
          return removed;
        },
    };
  },
});

