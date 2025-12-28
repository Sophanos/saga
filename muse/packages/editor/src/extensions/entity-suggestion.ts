import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import type { Entity } from "@mythos/core";

export interface EntitySuggestionOptions {
  suggestion: Omit<SuggestionOptions<Entity>, "editor">;
}

export const EntitySuggestion = Extension.create<EntitySuggestionOptions>({
  name: "entitySuggestion",

  addOptions() {
    return {
      suggestion: {
        char: "@",
        startOfLine: false,
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent(props.name)
            .setEntityMark({
              entityId: props.id,
              entityType: props.type,
            })
            .run();
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

// Helper to create suggestion items from entities
export function createSuggestionItems(
  entities: Entity[],
  query: string
): Entity[] {
  const lowerQuery = query.toLowerCase();
  return entities
    .filter(
      (entity) =>
        entity.name.toLowerCase().includes(lowerQuery) ||
        entity.aliases.some((alias) =>
          alias.toLowerCase().includes(lowerQuery)
        )
    )
    .slice(0, 10);
}
