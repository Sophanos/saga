import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import {
  MessageSquare,
  Send,
  GitGraph,
  TrendingUp,
  BarChart3,
  Search,
  User,
  Bot,
  Square,
  Trash2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button, Input, ScrollArea } from "@mythos/ui";
import { jumpToPosition } from "@mythos/editor";
import { DynamicsView } from "./DynamicsView";
import { CoachView } from "./CoachView";
import { LinterView } from "./LinterView";
import { AnalysisDashboard } from "./AnalysisDashboard";
import { SearchPanel } from "./SearchPanel";
import {
  useLinterIssueCounts,
  useMythosStore,
  useEditorInstance,
  useChatMessages,
  useIsChatStreaming,
  useChatError,
  type ChatMessage,
} from "../../stores";
import { useHistoryCount } from "../../stores/history";
import { useLinterFixes } from "../../hooks/useLinterFixes";
import { useChatAgent } from "../../hooks/useChatAgent";

/**
 * Single chat message bubble
 */
function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-mythos-accent-cyan/20"
            : "bg-mythos-accent-purple/20"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-mythos-accent-cyan" />
        ) : (
          <Bot className="w-4 h-4 text-mythos-accent-purple" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <p className="text-xs text-mythos-text-muted mb-1">
          {isUser ? "You" : "Mythos AI"}
        </p>
        <div
          className={`inline-block px-3 py-2 rounded-lg text-sm ${
            isUser
              ? "bg-mythos-accent-cyan/10 text-mythos-text-primary"
              : "bg-mythos-bg-tertiary text-mythos-text-secondary"
          }`}
        >
          {message.content || (
            <span className="flex items-center gap-2 text-mythos-text-muted">
              <Loader2 className="w-3 h-3 animate-spin" />
              Thinking...
            </span>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-mythos-accent-purple animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Welcome message when chat is empty
 */
function ChatWelcome() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="w-12 h-12 rounded-full bg-mythos-accent-purple/20 flex items-center justify-center mb-4">
        <MessageSquare className="w-6 h-6 text-mythos-accent-purple" />
      </div>
      <h3 className="text-lg font-medium text-mythos-text-primary mb-2">
        Story Assistant
      </h3>
      <p className="text-sm text-mythos-text-muted max-w-sm">
        Ask questions about your story, brainstorm ideas, or get help with your
        writing. I'll use your world and characters to give relevant answers.
      </p>
    </div>
  );
}

function ChatPanel() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useChatMessages();
  const isStreaming = useIsChatStreaming();
  const error = useChatError();

  const { sendMessage, stopStreaming, clearChat } = useChatAgent();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    void sendMessage(input.trim());
    setInput("");
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <>
      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {messages.length === 0 ? (
          <ChatWelcome />
        ) : (
          <div className="p-3 space-y-4">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Error display */}
      {error && (
        <div className="px-3 py-2 bg-mythos-accent-red/10 border-t border-mythos-accent-red/20">
          <div className="flex items-center gap-2 text-sm text-mythos-accent-red">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 border-t border-mythos-text-muted/20">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your story..."
            className="flex-1"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button size="icon" variant="outline" onClick={stopStreaming}>
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="default"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
          {messages.length > 0 && !isStreaming && (
            <Button size="icon" variant="ghost" onClick={clearChat}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
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
          onClick={() => setActiveTab("search")}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === "search"
              ? "text-mythos-accent-cyan border-b-2 border-mythos-accent-cyan"
              : "text-mythos-text-muted hover:text-mythos-text-secondary"
          }`}
        >
          <Search className="w-4 h-4" />
          Search
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
      ) : activeTab === "search" ? (
        <SearchPanel />
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
