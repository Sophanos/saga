/**
 * EntityCardNode - Inline entity card that expands in the document flow
 *
 * When user clicks an entity mention, this node is inserted below,
 * pushing subsequent content down. Similar to Notion's inline embeds.
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { EntityType } from "@mythos/core";

export interface EntityCardNodeOptions {
  HTMLAttributes: Record<string, unknown>;
}

export interface EntityCardNodeAttrs {
  entityId: string;
  entityType: EntityType;
  entityName: string;
  isExpanded: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    entityCardNode: {
      insertEntityCard: (attrs: Omit<EntityCardNodeAttrs, "isExpanded">) => ReturnType;
      removeEntityCard: (entityId: string) => ReturnType;
      toggleEntityCard: (entityId: string) => ReturnType;
    };
  }
}

export const EntityCardNode = Node.create<EntityCardNodeOptions>({
  name: "entityCard",

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
      entityId: {
        default: null,
      },
      entityType: {
        default: "character",
      },
      entityName: {
        default: "",
      },
      isExpanded: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-entity-card]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-entity-card": HTMLAttributes.entityId,
        class: "entity-card-node",
      }),
    ];
  },

  addCommands() {
    return {
      insertEntityCard:
        (attrs) =>
        ({ commands, state }) => {
          const { selection } = state;
          const pos = selection.$to.after();

          return commands.insertContentAt(pos, {
            type: this.name,
            attrs: { ...attrs, isExpanded: true },
          });
        },

      removeEntityCard:
        (entityId) =>
        ({ state, dispatch }) => {
          if (!dispatch) return false;

          const { doc, tr } = state;
          let found = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.entityId === entityId) {
              tr.delete(pos, pos + node.nodeSize);
              found = true;
              return false;
            }
          });

          if (found) {
            dispatch(tr);
            return true;
          }
          return false;
        },

      toggleEntityCard:
        (entityId) =>
        ({ state, dispatch }) => {
          if (!dispatch) return false;

          const { doc, tr } = state;
          let found = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.entityId === entityId) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                isExpanded: !node.attrs.isExpanded,
              });
              found = true;
              return false;
            }
          });

          if (found) {
            dispatch(tr);
            return true;
          }
          return false;
        },
    };
  },
});
