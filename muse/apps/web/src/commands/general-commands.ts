import {
  Settings,
  FileDown,
  FileUp,
  Shuffle,
  FolderPlus,
  FolderOpen,
} from "lucide-react";
import type { Command } from "./registry";
import { useNavigationStore } from "../stores/navigation";

export const generalCommands: Command[] = [
  {
    id: "general.new-project",
    label: "New Project",
    description: "Create a new project with template picker",
    icon: FolderPlus,
    category: "general",
    keywords: ["new", "project", "create", "template"],
    shortcut: "⌘N",
    execute: () => {
      useNavigationStore.getState().requestNewProject();
    },
  },
  {
    id: "general.switch-project",
    label: "Switch Project",
    description: "Go back to project selector",
    icon: FolderOpen,
    category: "general",
    keywords: ["switch", "project", "change", "select", "back"],
    execute: () => {
      useNavigationStore.getState().requestProjectSelector();
    },
  },
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
