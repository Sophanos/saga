import { Mark, mergeAttributes } from "@tiptap/core";
import type { EntityType } from "@mythos/core";

export interface EntityMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    entityMark: {
      setEntityMark: (attributes: {
        entityId: string;
        entityType: EntityType;
      }) => ReturnType;
      unsetEntityMark: () => ReturnType;
    };
  }
}

export const EntityMark = Mark.create<EntityMarkOptions>({
  name: "entity",

  // Don't extend mark when typing at boundaries
  inclusive: false,
  exiting: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-entity-id"),
        renderHTML: (attributes) => {
          if (!attributes["entityId"]) {
            return {};
          }
          return {
            "data-entity-id": attributes["entityId"],
          };
        },
      },
      entityType: {
        default: "character",
        parseHTML: (element) =>
          element.getAttribute("data-entity-type") || "character",
        renderHTML: (attributes) => {
          return {
            "data-entity-type": attributes["entityType"],
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-entity-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const entityType = HTMLAttributes["data-entity-type"] || "character";
    const className = `entity-${entityType}`;

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: className,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setEntityMark:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes);
        },
      unsetEntityMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});
