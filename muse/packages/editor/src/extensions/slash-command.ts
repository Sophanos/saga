import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";

export interface SlashCommandItem {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  action?: () => void;
}

export interface SlashCommandOptions {
  suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor">;
}

const slashCommandPluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        pluginKey: slashCommandPluginKey,
        char: "/",
        startOfLine: false,
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
