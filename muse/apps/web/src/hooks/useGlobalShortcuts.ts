import { useEffect, useCallback } from "react";
import { useCommandPaletteStore } from "../stores/commandPalette";
import { useMythosStore } from "../stores";
import { commandRegistry, getUnlockHint, type CommandContext } from "../commands";
import { useGetEditorSelection } from "./useEditorSelection";
import { useIsCommandLocked } from "./useIsCommandLocked";
import { useFlowStore } from "@mythos/state";
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
 * - Cmd/Ctrl+T: Toggle command palette
 * - Cmd/Ctrl+N: New project
 * - Cmd/Ctrl+Shift+C: Create character
 * - Cmd/Ctrl+Shift+O: Create location
 * - Cmd/Ctrl+Shift+I: Create item
 * - Cmd/Ctrl+Shift+L: Run linter
 * - Cmd/Ctrl+Shift+E: Export
 * - Cmd/Ctrl+Shift+Enter: Toggle Flow Mode
 * - Cmd/Ctrl+G: Open project graph
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
  const wordCount = useMythosStore((s) => s.editor.wordCount);

  // Flow mode
  const toggleFlowMode = useFlowStore((s) => s.toggleFlowMode);
  const flowEnabled = useFlowStore((s) => s.enabled);

  // Get selection imperatively (for command execution)
  const getSelectedText = useGetEditorSelection(editorInstance);

  // Use shared hook for checking command lock state (progressive disclosure)
  const isCommandLocked = useIsCommandLocked();

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
      // Command palette toggle - Cmd/Ctrl+T
      if (modKey && e.key.toLowerCase() === "t") {
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

        // Flow mode toggle: Cmd+Shift+Enter
        if (e.key === "Enter") {
          e.preventDefault();
          toggleFlowMode(wordCount);
          return;
        }

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
          if (cmd) {
            // Check if command is locked (progressive disclosure)
            if (isCommandLocked(cmd)) {
              console.log(
                `[Shortcuts] Command "${cmd.id}" is locked. ${getUnlockHint(cmd.requiredModule!)}`
              );
              return;
            }
            cmd.execute(ctx);
          }
          return;
        }
      }

      // Cmd/Ctrl shortcuts (no shift)
      if (modKey && !shiftKey) {
        const key = e.key.toLowerCase();
        let commandId: string | null = null;

        switch (key) {
          case "n":
            commandId = "general.new-project";
            break;
          case "g":
            commandId = "nav.project-graph";
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
          if (cmd) {
            // Check if command is locked (progressive disclosure)
            if (isCommandLocked(cmd)) {
              console.log(
                `[Shortcuts] Command "${cmd.id}" is locked. ${getUnlockHint(cmd.requiredModule!)}`
              );
              return;
            }
            cmd.execute(ctx);
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, toggle, isOpen, close, buildContext, isCommandLocked, toggleFlowMode, wordCount]);
}
