/**
 * ChatHeader
 *
 * Notion-style header for ChatPanel with consistent controls across modes.
 * 
 * Controls (right side):
 * - New Chat (⌘⇧;)
 * - Mode Toggle (Sidebar ↔ Floating)
 * - Hide/Minimize (⌘J) - hides panel in docked, minimizes to orb in floating
 *
 * Left side:
 * - Session dropdown with conversation name
 */

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Plus,
  PanelRightClose,
  ExternalLink,
  Minus,
  PanelRightOpen,
  Check,
  History,
  Trash2,
} from "lucide-react";
import { cn, Button, ScrollArea } from "@mythos/ui";
import { bg, text, border, accent } from "@mythos/theme";

export type ChatPanelMode = "docked" | "floating";

interface SessionItem {
  id: string;
  name: string | null;
}

interface ChatHeaderProps {
  /** Current mode */
  mode: ChatPanelMode;
  /** Current conversation ID */
  conversationId: string | null;
  /** Current conversation name */
  conversationName: string | null;
  /** Whether this is a new conversation */
  isNewConversation: boolean;
  /** Available sessions */
  sessions: SessionItem[];
  /** Whether sessions are loading */
  sessionsLoading: boolean;
  /** Callback when mode changes */
  onModeChange: (mode: ChatPanelMode) => void;
  /** Callback to hide/minimize the panel */
  onHide: () => void;
  /** Callback to create new conversation */
  onNewConversation: () => void;
  /** Callback when session is selected */
  onSelectSession: (id: string) => void;
  /** Callback when session is deleted */
  onDeleteSession?: (id: string) => void;
  /** Whether streaming is active (shows stop button) */
  isStreaming?: boolean;
  /** Callback to stop streaming */
  onStopStreaming?: () => void;
  /** Whether to show trial variant (limited controls) */
  isTrial?: boolean;
  className?: string;
}

export function ChatHeader({
  mode,
  conversationId,
  conversationName,
  isNewConversation,
  sessions,
  sessionsLoading,
  onModeChange,
  onHide,
  onNewConversation,
  onSelectSession,
  onDeleteSession,
  isStreaming,
  onStopStreaming,
  isTrial = false,
  className,
}: ChatHeaderProps) {
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);

  // Session display name
  const sessionDisplayName = conversationName || (isNewConversation ? "New Chat" : "Chat");

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowSessionDropdown(false);
    if (showSessionDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showSessionDropdown]);

  const handleModeToggle = useCallback(() => {
    onModeChange(mode === "docked" ? "floating" : "docked");
  }, [mode, onModeChange]);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2",
        mode === "floating" ? "px-4 py-3" : "",
        className
      )}
      style={{
        background: mode === "floating" ? bg.secondary : undefined,
        borderBottom: `1px solid ${mode === "floating" ? border.subtle : "var(--mythos-border-default)"}`,
      }}
    >
      {/* Left: Session dropdown */}
      <div className="relative min-w-0 flex-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isTrial) setShowSessionDropdown(!showSessionDropdown);
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors min-w-0",
            !isTrial && "hover:bg-[rgba(255,255,255,0.06)]"
          )}
        >
          <span
            className={cn(
              "font-medium truncate",
              mode === "floating" ? "text-[15px]" : "text-sm"
            )}
            style={{ color: mode === "floating" ? text.primary : undefined }}
          >
            {sessionDisplayName}
          </span>
          {!isTrial && (
            <ChevronDown
              className="w-4 h-4 flex-shrink-0"
              style={{ color: mode === "floating" ? text.secondary : undefined }}
            />
          )}
        </button>

        {/* Session dropdown menu */}
        {showSessionDropdown && !isTrial && (
          <div
            className="absolute top-full left-0 mt-1 w-64 rounded-lg shadow-xl z-50 overflow-hidden"
            style={{ background: bg.tertiary, border: `1px solid ${border.default}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2" style={{ borderBottom: `1px solid ${border.subtle}` }}>
              <span className="text-xs" style={{ color: text.secondary }}>
                Recent Chats
              </span>
            </div>
            <ScrollArea className="max-h-48">
              {sessionsLoading ? (
                <div className="px-3 py-4 text-center text-xs" style={{ color: text.secondary }}>
                  Loading...
                </div>
              ) : sessions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs" style={{ color: text.secondary }}>
                  No previous chats
                </div>
              ) : (
                sessions.slice(0, 10).map((session) => (
                  <div
                    key={session.id}
                    className="group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                    style={session.id === conversationId ? { background: border.subtle } : undefined}
                  >
                    <button
                      onClick={() => {
                        onSelectSession(session.id);
                        setShowSessionDropdown(false);
                      }}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <History className="w-3.5 h-3.5 shrink-0" style={{ color: text.secondary }} />
                      <span className="text-sm truncate flex-1" style={{ color: text.primary }}>
                        {session.name || "Unnamed"}
                      </span>
                      {session.id === conversationId && (
                        <Check className="w-3.5 h-3.5" style={{ color: accent.primary }} />
                      )}
                    </button>
                    {onDeleteSession && session.id !== conversationId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[rgba(255,255,255,0.1)] transition-opacity"
                        title="Delete session"
                      >
                        <Trash2 className="w-3 h-3" style={{ color: text.muted }} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Stop button when streaming */}
        {isStreaming && onStopStreaming && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStopStreaming}
            className="text-xs h-6 px-2 text-mythos-accent-red"
          >
            Stop
          </Button>
        )}

        {/* New Chat */}
        {!isTrial && (
          <button
            onClick={onNewConversation}
            className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
            title="New chat (⌘⇧;)"
          >
            <Plus className="w-4 h-4" style={{ color: mode === "floating" ? text.secondary : undefined }} />
          </button>
        )}

        {/* Mode Toggle - available for all users */}
        <button
          onClick={handleModeToggle}
          className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          title={mode === "docked" ? "Pop out to floating" : "Dock to sidebar"}
        >
          {mode === "docked" ? (
            <ExternalLink className="w-4 h-4" />
          ) : (
            <PanelRightClose className="w-4 h-4" style={{ color: text.secondary }} />
          )}
        </button>

        {/* Hide/Minimize */}
        <button
          onClick={onHide}
          className="p-1.5 rounded-md hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          title={mode === "docked" ? "Hide chat (⌘J)" : "Minimize"}
        >
          {mode === "docked" ? (
            <PanelRightOpen className="w-4 h-4" />
          ) : (
            <Minus className="w-4 h-4" style={{ color: text.secondary }} />
          )}
        </button>
      </div>
    </div>
  );
}
