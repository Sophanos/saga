import {
  FileText,
  Search,
  History,
  Network,
  PanelLeft,
  PanelRight,
} from "lucide-react";
import type { Command } from "./registry";
import { useCommandPaletteStore } from "../stores/commandPalette";

export const navigationCommands: Command[] = [
  {
    id: "nav.go-to-document",
    label: "Go to Document",
    description: "Quick navigation to any document",
    icon: FileText,
    category: "navigation",
    keywords: ["go", "document", "open", "file", "chapter", "scene"],
    shortcut: "⌘P",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: () => {
      // Open the command palette - it shows recent documents by default
      // Users can type to search for specific documents via semantic search
      useCommandPaletteStore.getState().open();
    },
  },
  {
    id: "nav.search-everything",
    label: "Search Everything",
    description: "Semantic search across all documents and entities",
    icon: Search,
    category: "navigation",
    keywords: ["search", "find", "semantic", "everything", "global"],
    shortcut: "⌘⇧F",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setActiveTab("search");
    },
  },
  {
    id: "nav.world-graph",
    label: "Open World Graph",
    description: "Visualize entity relationships in a graph view",
    icon: Network,
    category: "navigation",
    keywords: ["graph", "world", "visualization", "relationships", "network"],
    shortcut: "⌘G",
    requiredModule: "world_graph",
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setCanvasView("worldGraph");
    },
  },
  {
    id: "nav.editor",
    label: "Open Editor",
    description: "Return to the document editor view",
    icon: FileText,
    category: "navigation",
    keywords: ["editor", "write", "document", "canvas"],
    when: (ctx) => 
      ctx.state.project.currentProject !== null && 
      ctx.state.ui.canvasView !== "editor",
    execute: (ctx) => {
      ctx.setCanvasView("editor");
    },
  },
  {
    id: "nav.history",
    label: "View Analysis History",
    description: "View past analysis results and trends",
    icon: History,
    category: "navigation",
    keywords: ["history", "past", "analysis", "trends"],
    when: (ctx) => ctx.state.project.currentProject !== null,
    execute: (ctx) => {
      ctx.setActiveTab("history");
    },
  },
  {
    id: "nav.toggle-manifest",
    label: "Toggle Manifest Panel",
    description: "Show or hide the left sidebar",
    icon: PanelLeft,
    category: "navigation",
    keywords: ["toggle", "manifest", "sidebar", "left", "panel"],
    shortcut: "⌘B",
    requiredModule: "manifest",
    execute: (ctx) => {
      ctx.store.getState().toggleManifest();
    },
  },
  {
    id: "nav.toggle-console",
    label: "Toggle Console Panel",
    description: "Show or hide the right sidebar",
    icon: PanelRight,
    category: "navigation",
    keywords: ["toggle", "console", "sidebar", "right", "panel"],
    shortcut: "⌘J",
    requiredModule: "console",
    execute: (ctx) => {
      ctx.store.getState().toggleConsole();
    },
  },
];
