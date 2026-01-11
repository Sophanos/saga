import { Extension, type Editor } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";

export interface SlashCommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  category?: string;
  keywords?: string[];
  kind?: "editor" | "widget" | "ai";
  requiresSelection?: boolean;
  widgetId?: string;
  action: (editor: Editor) => void;
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor">;
}

export const slashCommandPluginKey = new PluginKey("slashCommand");

export const defaultSlashCommandItems: SlashCommandItem[] = [
  // AI Commands (first for quick access)
  {
    id: "ai",
    label: "Ask AI",
    description: "Open AI assistant",
    icon: "Sparkles",
    shortcut: "⌘J",
    category: "AI",
    keywords: ["ai", "ask", "help", "generate", "write", "assistant"],
    action: (editor) => {
      // Dispatch custom event that Editor component listens for
      const event = new CustomEvent('editor:open-ai-palette', {
        detail: { editor },
      });
      window.dispatchEvent(event);
    },
  },
  // Basic Blocks
  {
    id: "text",
    label: "Text",
    description: "Plain text paragraph",
    icon: "Type",
    category: "Basic",
    keywords: ["paragraph", "text", "plain"],
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    icon: "Heading1",
    shortcut: "#",
    category: "Basic",
    keywords: ["h1", "heading", "title", "large"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    icon: "Heading2",
    shortcut: "##",
    category: "Basic",
    keywords: ["h2", "heading", "subtitle"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small section heading",
    icon: "Heading3",
    shortcut: "###",
    category: "Basic",
    keywords: ["h3", "heading", "small"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  // Lists
  {
    id: "bullet",
    label: "Bullet List",
    description: "Unordered list with bullets",
    icon: "List",
    shortcut: "-",
    category: "Lists",
    keywords: ["bullet", "list", "unordered", "ul"],
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "numbered",
    label: "Numbered List",
    description: "Ordered list with numbers",
    icon: "ListOrdered",
    shortcut: "1.",
    category: "Lists",
    keywords: ["numbered", "list", "ordered", "ol"],
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "todo",
    label: "To-do List",
    description: "Checklist with checkboxes",
    icon: "CheckSquare",
    shortcut: "[]",
    category: "Lists",
    keywords: ["todo", "task", "checkbox", "checklist"],
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  // Blocks
  {
    id: "quote",
    label: "Quote",
    description: "Block quote for citations",
    icon: "Quote",
    shortcut: ">",
    category: "Blocks",
    keywords: ["quote", "blockquote", "citation"],
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code Block",
    description: "Code with syntax highlighting",
    icon: "Code",
    shortcut: "```",
    category: "Blocks",
    keywords: ["code", "codeblock", "pre", "syntax"],
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "divider",
    label: "Divider",
    description: "Horizontal line separator",
    icon: "Minus",
    shortcut: "---",
    category: "Blocks",
    keywords: ["divider", "hr", "line", "separator", "horizontal"],
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "table",
    label: "Table",
    description: "Insert a table",
    icon: "Table",
    category: "Blocks",
    keywords: ["table", "grid", "spreadsheet"],
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "image",
    label: "Image",
    description: "Upload or embed an image",
    icon: "Image",
    category: "Media",
    keywords: ["image", "picture", "photo", "img"],
    action: (editor) => {
      const url = window.prompt("Enter image URL:");
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },
];

export function filterSlashCommandItems(
  items: SlashCommandItem[],
  query: string
): SlashCommandItem[] {
  if (!query) return items;
  const lowerQuery = query.toLowerCase();
  const filtered = items.filter(
    (item) =>
      item.label.toLowerCase().includes(lowerQuery) ||
      item.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
  );

  if (filtered.length > 0) return filtered;

  return [
    {
      id: "ask-ai-fallback",
      label: `Ask AI: \"${query}\"`,
      description: "Send this prompt to AI",
      icon: "Sparkles",
      category: "AI",
      keywords: [],
      kind: "ai",
      action: (editor) => {
        const { from, to } = editor.state.selection;
        const selectionText = editor.state.doc.textBetween(from, to, " ");
        window.dispatchEvent(new CustomEvent("editor:ask-ai", {
          detail: { query, selectionText, selectionRange: { from, to } },
        }));
      },
    },
  ];
}

export function groupByCategory(
  items: SlashCommandItem[]
): Record<string, SlashCommandItem[]> {
  return items.reduce(
    (acc, item) => {
      const category = item.category || "Other";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, SlashCommandItem[]>
  );
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        pluginKey: slashCommandPluginKey,
        char: "/",
        startOfLine: false,
        items: ({ query }) => filterSlashCommandItems(defaultSlashCommandItems, query),
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
