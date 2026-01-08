import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import type { Editor } from '@tiptap/core';
import { SlashCommandMenu, type SlashCommandMenuRef } from './SlashCommandMenu';
import type { SlashCommandItem } from '@mythos/editor';

export function createSlashCommandSuggestion(): Partial<SuggestionOptions<SlashCommandItem>> {
  return {
    render: () => {
      let component: ReactRenderer<SlashCommandMenuRef> | null = null;
      let popup: Instance[] | null = null;

      return {
        onStart: (props: SuggestionProps<SlashCommandItem>) => {
          component = new ReactRenderer(SlashCommandMenu, {
            props: {
              items: props.items,
              editor: props.editor,
              command: (item: SlashCommandItem) => {
                item.action(props.editor);
                props.editor.chain().focus().deleteRange(props.range).run();
              },
            },
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            offset: [0, 8],
          });
        },

        onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
          component?.updateProps({
            items: props.items,
            editor: props.editor,
            command: (item: SlashCommandItem) => {
              item.action(props.editor);
              props.editor.chain().focus().deleteRange(props.range).run();
            },
          });

          if (!props.clientRect || !popup?.[0]) return;

          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown: (props: { event: KeyboardEvent }) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide();
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },

        onExit: () => {
          popup?.[0]?.destroy();
          component?.destroy();
        },
      };
    },
  };
}
