/**
 * ChatHeader
 *
 * Unified header for ChatPanel with consistent design across docked/floating modes.
 * 
 * Layout: [Session ▼] .................. [Linter] [Mode] [Hide]
 *
 * Features:
 * - Session dropdown with recent chats
 * - Linter badge (shows issue count with severity color)
 * - Mode toggle (Sidebar ↔ Floating)
 * - Hide/Minimize button
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  Plus,
  PanelRight,
  Maximize2,
  Minimize2,
  Check,
  MessageSquare,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { cn, Button, ScrollArea } from "@mythos/ui";
import { bg, text, border, accent } from "@mythos/theme";

export type ChatPanelMode = "docked" | "floating";

interface SessionItem {
  id: string;
  name: string | null;
}

interface LinterCounts {
  error: number;
  warning: number;
  info: number;
  total: number;
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
  /** Linter issue counts */
  linterCounts?: LinterCounts;
  /** Callback when linter badge is clicked */
  onLinterClick?: () => void;
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
  /** Whether streaming is active */
  isStreaming?: boolean;
  /** Callback to stop streaming */
  onStopStreaming?: () => void;
  /** Whether to show trial variant */
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
  linterCounts,
  onLinterClick,
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

  // Linter badge color based on severity
  const getLinterBadgeStyle = () => {
    if (!linterCounts || linterCounts.total === 0) return null;
    if (linterCounts.error > 0) {
      return { bg: "rgba(239, 68, 68, 0.15)", color: "#f87171", border: "rgba(239, 68, 68, 0.3)" };
    }
    if (linterCounts.warning > 0) {
      return { bg: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", border: "rgba(251, 191, 36, 0.3)" };
    }
    return { bg: "rgba(96, 165, 250, 0.15)", color: "#60a5fa", border: "rgba(96, 165, 250, 0.3)" };
  };

  const badgeStyle = getLinterBadgeStyle();

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

  // Shared button style
  const iconButtonClass = cn(
    "p-1.5 rounded-md transition-all duration-150",
    "hover:bg-white/[0.06] active:bg-white/[0.08]",
    "focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20"
  );

  const iconClass = "w-4 h-4 text-[#9B9A97] transition-colors group-hover:text-[#E3E2E0]";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2.5",
        "border-b transition-colors",
        className
      )}
      style={{
        background: bg.secondary,
        borderColor: border.subtle,
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
            "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-all duration-150 min-w-0",
            !isTrial && "hover:bg-white/[0.06] active:bg-white/[0.08]"
          )}
        >
          <span
            className="font-medium text-sm truncate max-w-[160px]"
            style={{ color: text.primary }}
          >
            {sessionDisplayName}
          </span>
          {!isTrial && (
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150",
                showSessionDropdown && "rotate-180"
              )}
              style={{ color: text.secondary }}
            />
          )}
        </button>

        {/* Session dropdown menu */}
        <AnimatePresence>
          {showSessionDropdown && !isTrial && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              className="absolute top-full left-0 mt-1.5 w-72 rounded-xl overflow-hidden z-50"
              style={{
                background: bg.tertiary,
                border: `1px solid ${border.default}`,
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="px-3 py-2.5 flex items-center justify-between"
                style={{ borderBottom: `1px solid ${border.subtle}` }}
              >
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: text.muted }}>
                  Recent Chats
                </span>
                <button
                  onClick={() => {
                    onNewConversation();
                    setShowSessionDropdown(false);
                  }}
                  className={cn(iconButtonClass, "p-1")}
                  title="New chat"
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: text.secondary }} />
                </button>
              </div>

              {/* Sessions list */}
              <ScrollArea className="max-h-64">
                {sessionsLoading ? (
                  <div className="px-3 py-6 text-center">
                    <div className="w-4 h-4 mx-auto border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: text.muted }} />
                    <p className="text-xs" style={{ color: text.muted }}>No previous chats</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {sessions.slice(0, 10).map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-2 mx-1 rounded-lg transition-colors",
                          session.id === conversationId
                            ? "bg-white/[0.08]"
                            : "hover:bg-white/[0.04]"
                        )}
                      >
                        <button
                          onClick={() => {
                            onSelectSession(session.id);
                            setShowSessionDropdown(false);
                          }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                        >
                          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: text.muted }} />
                          <span className="text-sm truncate flex-1" style={{ color: text.primary }}>
                            {session.name || "Untitled chat"}
                          </span>
                          {session.id === conversationId && (
                            <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent.primary }} />
                          )}
                        </button>
                        {onDeleteSession && session.id !== conversationId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" style={{ color: text.muted }} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Stop button when streaming */}
        {isStreaming && onStopStreaming && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStopStreaming}
            className="text-xs h-7 px-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            Stop
          </Button>
        )}

        {/* Linter badge - only show when there are issues */}
        {badgeStyle && linterCounts && linterCounts.total > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onLinterClick}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-150",
              "hover:brightness-110 active:brightness-90"
            )}
            style={{
              background: badgeStyle.bg,
              border: `1px solid ${badgeStyle.border}`,
            }}
            title={`${linterCounts.total} issue${linterCounts.total !== 1 ? "s" : ""} found`}
          >
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: badgeStyle.color }} />
            <span className="text-xs font-medium tabular-nums" style={{ color: badgeStyle.color }}>
              {linterCounts.total}
            </span>
          </motion.button>
        )}

        {/* New Chat - only for non-trial */}
        {!isTrial && (
          <button
            onClick={onNewConversation}
            className={cn(iconButtonClass, "group")}
            title="New chat"
          >
            <Plus className={iconClass} />
          </button>
        )}

        {/* Mode Toggle */}
        <button
          onClick={handleModeToggle}
          className={cn(iconButtonClass, "group")}
          title={mode === "docked" ? "Pop out" : "Dock to sidebar"}
        >
          {mode === "docked" ? (
            <Maximize2 className={iconClass} />
          ) : (
            <PanelRight className={iconClass} />
          )}
        </button>

        {/* Hide/Minimize */}
        <button
          onClick={onHide}
          className={cn(iconButtonClass, "group")}
          title={mode === "docked" ? "Hide" : "Minimize"}
        >
          <Minimize2 className={iconClass} />
        </button>
      </div>
    </div>
  );
}
