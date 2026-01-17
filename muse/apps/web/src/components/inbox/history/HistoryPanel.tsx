/**
 * HistoryPanel - Version history panel for documents and artifacts
 *
 * Shows a timeline of revisions with:
 * - Actor (user/AI/system)
 * - Reason/summary
 * - Word count changes
 * - Restore action
 */

import { useMemo } from "react";
import {
  X,
  User,
  Bot,
  Cog,
  FileText,
  GitBranch,
} from "lucide-react";
import { cn, ScrollArea } from "@mythos/ui";
import {
  useHistoryStore,
  useHistoryOpen,
  useHistoryTarget,
  useHistoryRevisions,
  useHistoryLoading,
  useHistorySelectedRevision,
  type HistoryRevision,
} from "@mythos/state";

interface HistoryPanelProps {
  onRestore?: (revisionId: string) => void;
  onPreview?: (revisionId: string) => void;
  className?: string;
}

export function HistoryPanel({
  onRestore,
  onPreview,
  className,
}: HistoryPanelProps) {
  const isOpen = useHistoryOpen();
  const target = useHistoryTarget();
  const revisions = useHistoryRevisions();
  const isLoading = useHistoryLoading();
  const selectedRevisionId = useHistorySelectedRevision();
  const close = useHistoryStore((s) => s.close);
  const selectRevision = useHistoryStore((s) => s.selectRevision);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "w-[340px] h-full",
        "bg-mythos-bg-elevated border-l border-mythos-border-default",
        "flex flex-col",
        "animate-in slide-in-from-right duration-200",
        className
      )}
      data-testid="history-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mythos-border-subtle">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-mythos-text-muted" />
          <span className="text-sm font-semibold text-mythos-text-primary">
            Version History
          </span>
        </div>
        <button
          onClick={close}
          className={cn(
            "p-1.5 rounded-md text-mythos-text-muted",
            "hover:text-mythos-text-secondary hover:bg-mythos-bg-hover transition-colors"
          )}
          aria-label="Close history"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Target info */}
      {target.name && (
        <div className="px-4 py-2 border-b border-mythos-border-subtle">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-mythos-text-muted" />
            <span className="text-xs text-mythos-text-secondary truncate">
              {target.name}
            </span>
          </div>
        </div>
      )}

      {/* Revisions list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <HistoryLoadingState />
        ) : revisions.length === 0 ? (
          <HistoryEmptyState />
        ) : (
          <div className="py-2">
            {revisions.map((revision, index) => (
              <HistoryRevisionItem
                key={revision.id}
                revision={revision}
                isSelected={selectedRevisionId === revision.id}
                isLast={index === revisions.length - 1}
                onSelect={() => selectRevision(revision.id)}
                onRestore={() => onRestore?.(revision.id)}
                onPreview={() => onPreview?.(revision.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface HistoryRevisionItemProps {
  revision: HistoryRevision;
  isSelected: boolean;
  isLast: boolean;
  onSelect: () => void;
  onRestore: () => void;
  onPreview: () => void;
}

function HistoryRevisionItem({
  revision,
  isSelected,
  isLast,
  onSelect,
  onRestore,
  onPreview,
}: HistoryRevisionItemProps) {
  const actorIcon = useMemo(() => {
    switch (revision.actorType) {
      case "user":
        return <User className="w-3 h-3" />;
      case "ai":
        return <Bot className="w-3 h-3" />;
      case "system":
        return <Cog className="w-3 h-3" />;
      default:
        return <User className="w-3 h-3" />;
    }
  }, [revision.actorType]);

  const timeDisplay = useMemo(() => {
    const date = new Date(revision.createdAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 24 hours: show time
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Less than 7 days: show day and time
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }

    // Otherwise: show date
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }, [revision.createdAt]);

  const deltaDisplay = useMemo(() => {
    if (revision.deltaWordCount === undefined) return null;
    const delta = revision.deltaWordCount;
    if (delta === 0) return null;
    return delta > 0 ? `+${delta}` : String(delta);
  }, [revision.deltaWordCount]);

  return (
    <div
      className={cn(
        "group relative px-4 py-2.5",
        "hover:bg-mythos-bg-hover/50 cursor-pointer transition-colors",
        isSelected && "bg-mythos-bg-active"
      )}
      onClick={onSelect}
    >
      {/* Timeline line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[27px] top-8 w-px h-[calc(100%-16px)]",
            "bg-mythos-border-subtle"
          )}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Actor icon */}
        <div
          className={cn(
            "flex-shrink-0 w-5 h-5 rounded-full",
            "flex items-center justify-center",
            "bg-mythos-bg-tertiary text-mythos-text-muted",
            revision.actorType === "ai" && "bg-mythos-accent-primary/20 text-mythos-accent-primary"
          )}
        >
          {actorIcon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-mythos-text-primary truncate">
              {revision.summary ?? revision.reason}
            </span>
            <span className="text-[10px] text-mythos-text-ghost tabular-nums flex-shrink-0">
              {timeDisplay}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-mythos-text-muted">
              {revision.actorName ?? revision.actorType}
            </span>
            {deltaDisplay && (
              <span
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  revision.deltaWordCount! > 0
                    ? "text-emerald-400"
                    : "text-red-400"
                )}
              >
                {deltaDisplay} words
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {revision.canRestore && !revision.isCurrentVersion && (
        <div
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2",
            "flex items-center gap-1",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className={cn(
              "px-2 py-1 text-xs text-mythos-text-muted",
              "hover:text-mythos-text-secondary transition-colors"
            )}
          >
            Preview
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
            className={cn(
              "px-2 py-1 text-xs font-medium rounded",
              "text-mythos-accent-primary hover:bg-mythos-accent-primary/10",
              "transition-colors"
            )}
          >
            Restore
          </button>
        </div>
      )}

      {/* Current version badge */}
      {revision.isCurrentVersion && (
        <span
          className={cn(
            "absolute right-4 top-1/2 -translate-y-1/2",
            "px-2 py-0.5 text-[10px] font-medium rounded",
            "bg-mythos-accent-primary/20 text-mythos-accent-primary"
          )}
        >
          Current
        </span>
      )}
    </div>
  );
}

function HistoryLoadingState() {
  return (
    <div className="py-4 px-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 py-2.5 animate-pulse">
          <div className="w-5 h-5 rounded-full bg-mythos-bg-tertiary" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-mythos-bg-tertiary" />
            <div className="h-2.5 w-1/3 rounded bg-mythos-bg-tertiary" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <GitBranch className="w-8 h-8 text-mythos-text-ghost opacity-50 mb-3" />
      <p className="text-sm font-medium text-mythos-text-primary mb-1">
        No history yet
      </p>
      <p className="text-xs text-mythos-text-muted text-center max-w-[200px]">
        Version history will appear here as changes are made
      </p>
    </div>
  );
}
