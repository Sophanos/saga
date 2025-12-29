import { useEffect, useCallback } from "react";
import { useCommandPaletteStore } from "../stores/commandPalette";
import { useMythosStore } from "../stores";
import { commandRegistry, type CommandContext } from "../commands";
import { useGetEditorSelection } from "./useEditorSelection";
import type { Editor } from "@mythos/editor";

interface UseGlobalShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
}

/**
 * Hook to handle global keyboard shortcuts.
 * 
 * Shortcuts:
 * - Cmd/Ctrl+K: Toggle command palette
 * - Cmd/Ctrl+Shift+C: Create character
 * - Cmd/Ctrl+Shift+O: Create location
 * - Cmd/Ctrl+Shift+I: Create item
 * - Cmd/Ctrl+Shift+L: Run linter
 * - Cmd/Ctrl+Shift+F: Search everything
 * - Cmd/Ctrl+Shift+E: Export
 * - Cmd/Ctrl+G: Open world graph
 * - Cmd/Ctrl+/: Ask AI (focus chat)
 * - Cmd/Ctrl+M: Toggle mode
 * - Cmd/Ctrl+,: Settings
 * - Cmd/Ctrl+B: Toggle manifest
 * - Cmd/Ctrl+J: Toggle console
 */
export function useGlobalShortcuts(options?: UseGlobalShortcutsOptions): void {
  const { enabled = true } = options ?? {};
  
  const toggle = useCommandPaletteStore((s) => s.toggle);
  const isOpen = useCommandPaletteStore((s) => s.isOpen);
  const close = useCommandPaletteStore((s) => s.close);
  
  const store = useMythosStore;
  const openModal = useMythosStore((s) => s.openModal);
  const closeModal = useMythosStore((s) => s.closeModal);
  const setActiveTab = useMythosStore((s) => s.setActiveTab);
  const setCanvasView = useMythosStore((s) => s.setCanvasView);
  const editorInstance = useMythosStore((s) => s.editor.editorInstance) as Editor | null;

  // Get selection imperatively (for command execution)
  const getSelectedText = useGetEditorSelection(editorInstance);

  const buildContext = useCallback((): CommandContext => {
    const state = store.getState();

    return {
      store,
      state,
      editor: editorInstance,
      selectedText: getSelectedText(),
      openModal,
      closeModal,
      setActiveTab: setActiveTab as (tab: string) => void,
      setCanvasView,
    };
  }, [store, editorInstance, getSelectedText, openModal, closeModal, setActiveTab, setCanvasView]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Get modifier key (Cmd on Mac, Ctrl on others)
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      const shiftKey = e.shiftKey;

      // Command palette toggle - Cmd/Ctrl+K
      if (modKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
        return;
      }

      // Close palette with Escape
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        close();
        return;
      }

      // Skip other shortcuts if we're in an editable field
      // (except for specific shortcuts that should work everywhere)
      if (isEditable && !isOpen) {
        // Allow Cmd+/ for AI chat even in editor
        if (modKey && e.key === "/") {
          e.preventDefault();
          const ctx = buildContext();
          const cmd = commandRegistry.get("ai.chat");
          if (cmd) cmd.execute(ctx);
          return;
        }
        return;
      }

      // Cmd/Ctrl+Shift shortcuts
      if (modKey && shiftKey) {
        const key = e.key.toLowerCase();
        let commandId: string | null = null;

        switch (key) {
          case "c":
            commandId = "entity.create.character";
            break;
          case "o":
            commandId = "entity.create.location";
            break;
          case "i":
            commandId = "entity.create.item";
            break;
          case "l":
            commandId = "ai.lint";
            break;
          case "f":
            commandId = "nav.search-everything";
            break;
          case "e":
            commandId = "general.export";
            break;
        }

        if (commandId) {
          e.preventDefault();
          const ctx = buildContext();
          const cmd = commandRegistry.get(commandId);
          if (cmd) cmd.execute(ctx);
          return;
        }
      }

      // Cmd/Ctrl shortcuts (no shift)
      if (modKey && !shiftKey) {
        const key = e.key.toLowerCase();
        let commandId: string | null = null;

        switch (key) {
          case "g":
            commandId = "nav.world-graph";
            break;
          case "m":
            commandId = "general.toggle-mode";
            break;
          case ",":
            commandId = "general.settings";
            break;
          case "b":
            commandId = "nav.toggle-manifest";
            break;
          case "j":
            commandId = "nav.toggle-console";
            break;
          case "/":
            commandId = "ai.chat";
            break;
          case "e":
            commandId = "entity.search";
            break;
          case "p":
            commandId = "nav.go-to-document";
            break;
        }

        if (commandId) {
          e.preventDefault();
          const ctx = buildContext();
          const cmd = commandRegistry.get(commandId);
          if (cmd) cmd.execute(ctx);
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, toggle, isOpen, close, buildContext]);
}
