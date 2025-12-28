import { useState, useCallback } from "react";
import {
  MessageSquare,
  Send,
  GitGraph,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { Button, Input, ScrollArea } from "@mythos/ui";
import { replaceText, jumpToPosition } from "@mythos/editor";
import { DynamicsView } from "./DynamicsView";
import { CoachView } from "./CoachView";
import { LinterView } from "./LinterView";
import { AnalysisDashboard } from "./AnalysisDashboard";
import { useLinterIssueCounts, useMythosStore, useEditorInstance } from "../../stores";
import { useHistoryCount } from "../../stores/history";

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
 * Find the position in the document for a given line number and text
 */
function findPositionForLine(content: string, lineNumber: number, targetText: string): number {
  const lines = content.split("\n");
  let position = 0;

  // Calculate position at start of target line
  for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i++) {
    position += lines[i].length + 1; // +1 for newline
  }

  // Try to find the target text within the line for more precise positioning
  if (lineNumber <= lines.length) {
    const line = lines[lineNumber - 1];
    const textIndex = line.indexOf(targetText);
    if (textIndex !== -1) {
      position += textIndex;
    }
  }

  return position;
}

export function Console() {
  const activeTab = useMythosStore((state) => state.ui.activeTab);
  const setActiveTab = useMythosStore((state) => state.setActiveTab);
  const issueCounts = useLinterIssueCounts();
  const linterIssues = useMythosStore((state) => state.linter.issues);
  const removeLinterIssue = useMythosStore((state) => state.removeLinterIssue);
  const editor = useEditorInstance();
  const historyCount = useHistoryCount();

  // Callback to jump to a position in the editor
  const handleJumpToPosition = useCallback((line: number) => {
    if (!editor || editor.isDestroyed) {
      console.warn("[Console] No editor instance available");
      return;
    }

    // Find the issue for this line to get the target text
    const issue = linterIssues.find((i) => i.location.line === line);
    if (!issue) {
      console.warn("[Console] No issue found for line:", line);
      return;
    }

    const content = editor.getText();
    const position = findPositionForLine(content, line, issue.location.text);

    // Jump to position and focus editor
    jumpToPosition(editor, position);
    editor.commands.focus();
  }, [editor, linterIssues]);

  // Callback to apply a fix for an issue
  const handleApplyFix = useCallback((issueId: string, suggestion: string) => {
    if (!editor || editor.isDestroyed) {
      console.warn("[Console] No editor instance available");
      removeLinterIssue(issueId);
      return;
    }

    const issue = linterIssues.find((i) => i.id === issueId);
    if (!issue) {
      console.warn("[Console] No issue found for id:", issueId);
      removeLinterIssue(issueId);
      return;
    }

    const content = editor.getText();
    const position = findPositionForLine(content, issue.location.line, issue.location.text);
    const from = position;
    const to = position + issue.location.text.length;

    // Apply the fix using replaceText utility
    replaceText(editor, from, to, suggestion);

    // Remove the issue from the store
    removeLinterIssue(issueId);
  }, [editor, linterIssues, removeLinterIssue]);

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
          onApplyFix={handleApplyFix}
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
