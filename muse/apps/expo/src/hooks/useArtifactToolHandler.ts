/**
 * useArtifactToolHandler - Handles artifact tool results from agent stream
 *
 * Consumes tool events and applies UI effects:
 * - Opens/closes artifact panel
 * - Sets active artifact
 * - Focuses elements
 * - Enters/exits compare mode
 * - Upserts artifact data for instant feedback
 */

import { useCallback, useRef } from "react";
import { useArtifactStore, type ArtifactPanelMode, type ArtifactSplitMode } from "@mythos/state";
import type { ToolCallResult } from "@mythos/ai/hooks";

const ARTIFACT_TOOL_NAMES = [
  "artifact_tool",
  "artifact_stage",
  "artifact_diagram",
  "artifact_table",
  "artifact_timeline",
  "artifact_prose",
  "artifact_link",
] as const;

type ArtifactToolName = (typeof ARTIFACT_TOOL_NAMES)[number];

function isArtifactTool(toolName: string): toolName is ArtifactToolName {
  return ARTIFACT_TOOL_NAMES.includes(toolName as ArtifactToolName);
}

interface ArtifactToolResult {
  ok: boolean;
  artifactKey?: string;
  artifact?: {
    artifactKey: string;
    title: string;
    type: string;
    format: string;
    status: string;
    updatedAt: number;
  };
  open?: boolean;
  setActive?: boolean;
  focusId?: string;
  action?: string;
  mode?: string;
  leftKey?: string;
  rightKey?: string;
  url?: string;
  error?: string;
}

export function useArtifactToolHandler() {
  const processedRef = useRef(new Set<string>());

  const handleTool = useCallback((tool: ToolCallResult) => {
    const { toolCallId, toolName, args } = tool;

    // Skip non-artifact tools
    if (!isArtifactTool(toolName)) return;

    // Dedupe by toolCallId
    if (processedRef.current.has(toolCallId)) return;
    processedRef.current.add(toolCallId);

    // Get store actions
    const store = useArtifactStore.getState();

    // Handle artifact_stage (UI control)
    if (toolName === "artifact_stage") {
      const typedArgs = args as { action: string; [key: string]: unknown };
      handleStageAction(store, typedArgs);
      return;
    }

    // Handle artifact_link - no UI effects needed
    if (toolName === "artifact_link") {
      return;
    }

    // Handle artifact mutations (tool result contains artifact data)
    // Note: Server already persisted, this is for optimistic UI
    const typedArgs = args as { action?: string; [key: string]: unknown };
    if (typedArgs.action === "create") {
      // Open panel and set active when creating
      if (store.panelMode === "hidden") {
        store.setPanelMode("side");
      }
    }
  }, []);

  return { handleTool };
}

function handleStageAction(
  store: ReturnType<typeof useArtifactStore.getState>,
  args: { action: string; [key: string]: unknown }
) {
  switch (args.action) {
    case "open_panel": {
      const mode = (args.mode as ArtifactPanelMode) ?? "side";
      store.setPanelMode(mode);
      if (args.artifactKey) {
        store.setActiveArtifact(args.artifactKey as string);
      }
      break;
    }
    case "close_panel": {
      store.setPanelMode("hidden");
      break;
    }
    case "set_active": {
      if (args.artifactKey) {
        store.setActiveArtifact(args.artifactKey as string);
        if (store.panelMode === "hidden") {
          store.setPanelMode("side");
        }
      }
      break;
    }
    case "focus": {
      if (args.artifactKey && args.focusId) {
        store.setActiveArtifact(args.artifactKey as string);
        store.setFocusId(args.artifactKey as string, args.focusId as string);
        if (store.panelMode === "hidden") {
          store.setPanelMode("side");
        }
      }
      break;
    }
    case "compare": {
      if (args.leftKey && args.rightKey) {
        const mode = (args.mode as ArtifactSplitMode) ?? "side-by-side";
        store.enterSplitView(args.leftKey as string, args.rightKey as string, mode);
        if (store.panelMode === "hidden") {
          store.setPanelMode("side");
        }
      }
      break;
    }
    case "exit_compare": {
      store.exitSplitView();
      break;
    }
  }
}
