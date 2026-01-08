import { Extension, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";

export interface WriterKitOptions {
  starterKit?: Parameters<typeof StarterKit.configure>[0] | false;
  taskList?: boolean;
  taskItem?: { nested?: boolean } | false;
  image?: { inline?: boolean; allowBase64?: boolean } | false;
  table?: { resizable?: boolean; cellMinWidth?: number } | false;
  formatting?: { highlight?: { multicolor?: boolean } } | false;
}

export const WriterKit = Extension.create<WriterKitOptions>({
  name: "writerKit",

  addExtensions() {
    const extensions: AnyExtension[] = [];

    if (this.options.starterKit !== false) {
      extensions.push(
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          ...this.options.starterKit,
        })
      );
    }

    if (this.options.taskList !== false) {
      extensions.push(TaskList);
    }

    if (this.options.taskItem !== false) {
      extensions.push(
        TaskItem.configure({
          nested: this.options.taskItem?.nested ?? true,
        })
      );
    }

    if (this.options.image !== false) {
      extensions.push(
        Image.configure({
          inline: this.options.image?.inline ?? false,
          allowBase64: this.options.image?.allowBase64 ?? true,
          HTMLAttributes: {
            class: "editor-image",
            loading: "lazy",
          },
        })
      );
    }

    if (this.options.table !== false) {
      extensions.push(
        Table.configure({
          resizable: this.options.table?.resizable ?? true,
          cellMinWidth: this.options.table?.cellMinWidth ?? 100,
        }),
        TableRow,
        TableHeader,
        TableCell
      );
    }

    if (this.options.formatting !== false) {
      extensions.push(
        Underline,
        TextStyle,
        Color,
        Highlight.configure({
          multicolor: this.options.formatting?.highlight?.multicolor ?? true,
        })
      );
    }

    return extensions;
  },
});
