import { useState, useCallback, useEffect } from "react";
import {
  MessageSquare,
  Send,
  GitGraph,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Button, Input, ScrollArea } from "@mythos/ui";
import { jumpToPosition } from "@mythos/editor";
import { DynamicsView } from "./DynamicsView";
import { CoachView } from "./CoachView";
import { LinterView } from "./LinterView";
import { AnalysisDashboard } from "./AnalysisDashboard";
import { useLinterIssueCounts, useMythosStore, useEditorInstance } from "../../stores";
import { useHistoryCount } from "../../stores/history";
import { useLinterFixes } from "../../hooks/useLinterFixes";

function ChatPanel() {
  const [input, setInput] = useState("");

  return (
    <>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-mythos-accent-purple" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-mythos-text-muted mb-1">
                Mythos AI
              </p>
              <p className="text-sm text-mythos-text-secondary">
                I've analyzed your opening scene. Kael's entrance is strong, but
                consider adding more sensory details about Valdris to establish
                the atmosphere. Would you like suggestions for the city's
                ambiance?
              </p>
            </div>
          </div>
        </div>
      </ScrollArea>
      <div className="p-3 border-t border-mythos-text-muted/20">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your story..."
            className="flex-1"
          />
          <Button size="icon" variant="default">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Find the position of text in the document content.
 * Searches for the exact text and returns the character offset.
 * If lineHint is provided, searches near that line first for better accuracy.
 */
function findTextPosition(content: string, targetText: string, lineHint?: number): number {
  // If we have a line hint, calculate approximate position and search nearby first
  if (lineHint !== undefined) {
    const lines = content.split("\n");
    let hintPosition = 0;
    for (let i = 0; i < Math.min(lineHint - 1, lines.length); i++) {
      hintPosition += lines[i].length + 1;
    }

    // Search within a reasonable range around the hint position
    const searchRadius = 500; // characters to search around hint
    const searchStart = Math.max(0, hintPosition - searchRadius);
    const searchEnd = Math.min(content.length, hintPosition + searchRadius);
    const searchRegion = content.substring(searchStart, searchEnd);

    const localIndex = searchRegion.indexOf(targetText);
    if (localIndex !== -1) {
      return searchStart + localIndex;
    }
  }

  // Fallback: search the entire document
  const globalIndex = content.indexOf(targetText);
  return globalIndex !== -1 ? globalIndex : 0;
}

export function Console() {
  const activeTab = useMythosStore((state) => state.ui.activeTab);
  const setActiveTab = useMythosStore((state) => state.setActiveTab);
  const issueCounts = useLinterIssueCounts();
  const linterIssues = useMythosStore((state) => state.linter.issues);
  const editor = useEditorInstance();
  const historyCount = useHistoryCount();

  // Track editor content for linter hook
  const [editorContent, setEditorContent] = useState("");

  // Subscribe to editor updates for content tracking
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    // Get initial content
    setEditorContent(editor.getText({ blockSeparator: "\n" }));

    // Subscribe to updates
    const handleUpdate = () => {
      setEditorContent(editor.getText({ blockSeparator: "\n" }));
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  // Use the linter fixes hook for undo-aware fix application
  const {
    applyFix,
    undoLastFix,
    redoLastFix,
  } = useLinterFixes({
    content: editorContent,
    editor,
    autoLint: false, // Don't auto-lint from Console - that's handled elsewhere
    enabled: Boolean(editor),
  });

  // Callback to jump to a position in the editor
  // LinterView passes issueId, we look up the issue and find its current position
  const handleJumpToPosition = useCallback((issueId: string) => {
    if (!editor || editor.isDestroyed) {
      console.warn("[Console] No editor instance available");
      return;
    }

    // Find the issue by ID
    const issue = linterIssues.find((i) => i.id === issueId);
    if (!issue) {
      console.warn("[Console] No issue found for id:", issueId);
      return;
    }

    const content = editor.getText({ blockSeparator: "\n" });
    // Use text search with line hint to find current position
    // This handles cases where line numbers have shifted due to edits
    const position = findTextPosition(content, issue.location.text, issue.location.line);

    // Jump to position and focus editor
    jumpToPosition(editor, position);
    editor.commands.focus();
  }, [editor, linterIssues]);

  // Callback to jump to a related location (uses line and text search)
  const handleJumpToRelatedLocation = useCallback((line: number, text: string) => {
    if (!editor || editor.isDestroyed) {
      console.warn("[Console] No editor instance available");
      return;
    }

    const content = editor.getText({ blockSeparator: "\n" });
    // Use text search with line hint to find current position
    const position = findTextPosition(content, text, line);

    // Jump to position and focus editor
    jumpToPosition(editor, position);
    editor.commands.focus();
  }, [editor]);

  // Callback to apply a fix for an issue (uses undo-aware path)
  const handleApplyFix = useCallback((issueId: string, _suggestion: string) => {
    // Use the hook's applyFix which handles undo stack
    applyFix(issueId);
  }, [applyFix]);

  // Undo/Redo handlers that return boolean for LinterView
  const handleUndo = useCallback((): boolean => {
    return undoLastFix();
  }, [undoLastFix]);

  const handleRedo = useCallback((): boolean => {
    return redoLastFix();
  }, [redoLastFix]);

  // Get badge color based on severity counts
  const getBadgeClass = () => {
    if (issueCounts.error > 0) return "bg-mythos-accent-red/20 text-mythos-accent-red";
    if (issueCounts.warning > 0) return "bg-mythos-accent-amber/20 text-mythos-accent-amber";
    if (issueCounts.info > 0) return "bg-mythos-accent-cyan/20 text-mythos-accent-cyan";
    return "bg-green-500/20 text-green-400";
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-mythos-text-muted/20">
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "chat"
              ? "text-mythos-accent-cyan border-b-2 border-mythos-accent-cyan"
              : "text-mythos-text-muted hover:text-mythos-text-secondary"
          }`}
        >
          Chat
        </button>
        <button
          onClick={() => setActiveTab("linter")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "linter"
              ? "text-mythos-accent-cyan border-b-2 border-mythos-accent-cyan"
              : "text-mythos-text-muted hover:text-mythos-text-secondary"
          }`}
        >
          Linter
          {issueCounts.total > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${getBadgeClass()}`}>
              {issueCounts.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("dynamics")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "dynamics"
              ? "text-mythos-accent-cyan border-b-2 border-mythos-accent-cyan"
              : "text-mythos-text-muted hover:text-mythos-text-secondary"
          }`}
        >
          <GitGraph className="w-4 h-4" />
          Dynamics
        </button>
        <button
          onClick={() => setActiveTab("coach")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "coach"
              ? "text-mythos-accent-cyan border-b-2 border-mythos-accent-cyan"
              : "text-mythos-text-muted hover:text-mythos-text-secondary"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Coach
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "text-mythos-accent-cyan border-b-2 border-mythos-accent-cyan"
              : "text-mythos-text-muted hover:text-mythos-text-secondary"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          History
          {historyCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-mythos-accent-purple/20 text-mythos-accent-purple">
              {historyCount}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === "chat" ? (
        <ChatPanel />
      ) : activeTab === "linter" ? (
        <LinterView
          onJumpToPosition={handleJumpToPosition}
          onJumpToRelatedLocation={handleJumpToRelatedLocation}
          onApplyFix={handleApplyFix}
          onUndo={handleUndo}
          onRedo={handleRedo}
        />
      ) : activeTab === "dynamics" ? (
        <DynamicsView />
      ) : activeTab === "coach" ? (
        <CoachView />
      ) : activeTab === "history" ? (
        <AnalysisDashboard />
      ) : (
        <CoachView />
      )}
    </div>
  );
}
