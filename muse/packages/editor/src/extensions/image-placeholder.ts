/**
 * ImagePlaceholder Extension
 *
 * A Notion-style empty image block that shows "Add image" placeholder.
 * Click to open ImageInsertModal via custom event.
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface ImagePlaceholderOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface ImagePlaceholderAttributes {
  placeholderId?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imagePlaceholder: {
      setImagePlaceholder: () => ReturnType;
    };
  }
}

export const ImagePlaceholder = Node.create<ImagePlaceholderOptions>({
  name: "imagePlaceholder",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      placeholderId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="image-placeholder"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": "image-placeholder",
        class: "image-placeholder",
      }),
    ];
  },

  addCommands() {
    return {
      setImagePlaceholder:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              placeholderId: `placeholder-${Date.now()}`,
            },
          });
        },
    };
  },

  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "image-placeholder-wrapper";
      dom.setAttribute("data-type", "image-placeholder");

      const inner = document.createElement("button");
      inner.className = "image-placeholder-button";
      inner.type = "button";

      const icon = document.createElement("span");
      icon.className = "image-placeholder-icon";
      icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
      inner.appendChild(icon);

      const text = document.createElement("span");
      text.className = "image-placeholder-text";
      text.textContent = "Add image";
      inner.appendChild(text);

      dom.appendChild(inner);

      inner.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const pos = typeof getPos === "function" ? getPos() : 0;

        // Dispatch event for ImageInsertModal
        window.dispatchEvent(
          new CustomEvent("editor:insert-image", {
            detail: {
              insertPosition: pos,
              replacePlaceholder: true,
              placeholderNode: node,
            },
          })
        );
      });

      return {
        dom,
        destroy: () => {
          // Cleanup if needed
        },
      };
    };
  },
});
