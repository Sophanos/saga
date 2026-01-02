import { useState } from "react";
import { Trash2, MessageSquare, Clock, Loader2, History, ChevronDown, ChevronUp } from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import type { ChatSessionSummary } from "../../../stores";
import { formatRelativeTime } from "../../../utils/time";

interface SessionListProps {
  sessions: ChatSessionSummary[];
  activeSessionId: string;
  loading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

/**
 * Session history list for switching between conversations
 */
export function SessionList({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onDelete,
  className,
}: SessionListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out empty sessions (no messages)
  const sessionsWithMessages = sessions.filter((s) => s.messageCount > 0);

  // Don't show if no sessions with messages
  if (sessionsWithMessages.length === 0 && !loading) {
    return null;
  }

  const formatSessionName = (session: ChatSessionSummary) => {
    if (session.name) return session.name;
    const idShort = session.id.split("-")[0];
    return `Session ${idShort}`;
  };

  const formatTime = (date: Date | null) => {
    if (!date) return "Just now";
    try {
      return formatRelativeTime(date);
    } catch {
      return "Unknown";
    }
  };

  return (
    <div className={cn("border-b border-mythos-border-default", className)}>
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-mythos-bg-elevated/50 transition-colors text-left"
      >
        <div className="flex items-center gap-1.5 text-xs text-mythos-text-muted">
          <History className="w-3 h-3" />
          <span>History</span>
          {sessionsWithMessages.length > 0 && (
            <span className="px-1 py-0.5 rounded bg-mythos-text-muted/10 text-[10px] font-medium">
              {sessionsWithMessages.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 text-mythos-text-muted" />
        ) : (
          <ChevronDown className="w-3 h-3 text-mythos-text-muted" />
        )}
      </button>

      {/* Expanded list */}
      {isExpanded && (
        <div className="pb-1">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-mythos-text-muted" />
            </div>
          ) : sessionsWithMessages.length === 0 ? (
            <p className="px-3 py-2 text-xs text-mythos-text-muted text-center">
              No previous sessions
            </p>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-0.5 px-1">
                {sessionsWithMessages.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      aria-pressed={isActive}
                      aria-label={`${isActive ? "Current session: " : "Switch to session: "}${formatSessionName(session)}`}
                      className={cn(
                        "group flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer transition-colors w-full text-left",
                        isActive
                          ? "bg-mythos-accent-purple/10 text-mythos-accent-purple"
                          : "hover:bg-mythos-bg-elevated/50"
                      )}
                      onClick={() => onSelect(session.id)}
                    >
                      {/* Session info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-xs font-medium truncate",
                            isActive
                              ? "text-mythos-accent-purple"
                              : "text-mythos-text-primary"
                          )}
                        >
                          {formatSessionName(session)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-0.5 text-[10px] text-mythos-text-muted">
                            <MessageSquare className="w-2.5 h-2.5" />
                            {session.messageCount}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px] text-mythos-text-muted">
                            <Clock className="w-2.5 h-2.5" />
                            {formatTime(session.lastMessageAt)}
                          </span>
                        </div>
                      </div>

                      {/* Delete button */}
                      {!isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(session.id);
                          }}
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete session"
                        >
                          <Trash2 className="w-3 h-3 text-mythos-text-muted hover:text-mythos-accent-red" />
                        </Button>
                      )}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
