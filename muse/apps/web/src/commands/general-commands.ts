import {
  Settings,
  FileDown,
  FileUp,
  Shuffle,
} from "lucide-react";
import type { Command } from "./registry";

export const generalCommands: Command[] = [
  {
    id: "general.settings",
    label: "Settings",
    description: "Open application settings",
    icon: Settings,
    category: "general",
    keywords: ["settings", "preferences", "options", "config", "api", "key"],
    shortcut: "⌘,",
    execute: (ctx) => {
      ctx.openModal({ type: "settings" });
    },
  },
  {
    id: "general.export",
    label: "Export Story",
    description: "Export your story to various formats",
    icon: FileDown,
    category: "general",
    keywords: ["export", "download", "save", "pdf", "docx", "epub", "markdown"],
    shortcut: "⌘⇧E",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.openModal({ type: "export" });
    },
  },
  {
    id: "general.import",
    label: "Import Story",
    description: "Import content from external files",
    icon: FileUp,
    category: "general",
    keywords: ["import", "upload", "load", "file"],
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.openModal({ type: "import" });
    },
  },
  {
    id: "general.toggle-mode",
    label: "Toggle Writer/DM Mode",
    description: "Switch between Writer and Dungeon Master modes",
    icon: Shuffle,
    category: "general",
    keywords: ["mode", "toggle", "writer", "dm", "dungeon", "master", "switch"],
    shortcut: "⌘M",
    execute: (ctx) => {
      ctx.store.getState().toggleMode();
    },
  },
];
