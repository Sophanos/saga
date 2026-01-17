/**
 * InboxItem - Generic row component for inbox items
 *
 * Renders status icon, title, subtitle, time ago, and hover actions.
 * Cursor-inspired design with warm grays and subtle interactions.
 */

import { useMemo } from "react";
import {
  Loader2,
  Check,
  AlertCircle,
  Eye,
  Circle,
  Sparkles,
  AlertTriangle,
  FileText,
  Clock,
} from "lucide-react";
import { cn, Button } from "@mythos/ui";

export type InboxItemStatus =
  | "new"
  | "pending"
  | "running"
  | "ready"
  | "done"
  | "stale"
  | "failed";

export interface InboxItemAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
}

export interface InboxItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  context?: string;
  meta?: string;
  status?: InboxItemStatus;
  isUnread?: boolean;
  actions?: InboxItemAction[];
  onClick?: () => void;
  onViewHistory?: () => void;
  className?: string;
}

const statusConfig: Record<
  InboxItemStatus,
  { icon: React.ReactNode; color: string }
> = {
  new: {
    icon: <Circle className="w-3 h-3" fill="currentColor" />,
    color: "text-mythos-accent-primary",
  },
  pending: {
    icon: <Circle className="w-3 h-3" strokeWidth={2} />,
    color: "text-mythos-text-muted",
  },
  running: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: "text-amber-400",
  },
  ready: {
    icon: <Eye className="w-3.5 h-3.5" />,
    color: "text-mythos-accent-primary",
  },
  done: {
    icon: <Check className="w-3.5 h-3.5" />,
    color: "text-emerald-400",
  },
  stale: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: "text-amber-400",
  },
  failed: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    color: "text-red-400",
  },
};

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return `${Math.floor(days / 7)}w`;
}

export function InboxItem({
  icon,
  title,
  subtitle,
  context,
  meta,
  status = "pending",
  isUnread = false,
  actions = [],
  onClick,
  className,
}: InboxItemProps) {
  const statusStyle = statusConfig[status];

  const timeDisplay = useMemo(() => {
    if (!meta) return null;
    // If meta is a timestamp, format it
    const timestamp = parseInt(meta, 10);
    if (!isNaN(timestamp) && timestamp > 1000000000000) {
      return formatTimeAgo(timestamp);
    }
    return meta;
  }, [meta]);

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-2.5",
        "hover:bg-mythos-bg-hover/50 transition-colors duration-100",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Status Icon */}
      <div className={cn("flex-shrink-0 mt-0.5", statusStyle.color)}>
        {icon ?? statusStyle.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isUnread
                ? "text-mythos-text-primary"
                : "text-mythos-text-secondary"
            )}
          >
            {title}
          </span>
          {isUnread && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-mythos-accent-primary" />
          )}
        </div>

        {(subtitle || context) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {subtitle && (
              <span className="text-xs text-mythos-text-muted truncate">
                {subtitle}
              </span>
            )}
            {subtitle && context && (
              <span className="text-mythos-text-ghost">·</span>
            )}
            {context && (
              <span className="text-xs text-mythos-text-muted truncate">
                {context}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions (visible on hover) */}
      {actions.length > 0 && (
        <div
          className={cn(
            "flex items-center gap-1",
            "opacity-0 group-hover:opacity-100",
            "transition-opacity duration-100"
          )}
        >
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={cn(
                "px-2 py-1 text-xs font-medium rounded transition-colors",
                action.variant === "primary"
                  ? "text-mythos-accent-primary hover:bg-mythos-accent-primary/10"
                  : action.variant === "secondary"
                    ? "text-mythos-text-secondary hover:text-mythos-text-primary hover:bg-mythos-bg-tertiary"
                    : "text-mythos-text-muted hover:text-mythos-text-secondary"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Time */}
      {timeDisplay && (
        <span className="flex-shrink-0 text-[10px] text-mythos-text-ghost tabular-nums">
          {timeDisplay}
        </span>
      )}
    </div>
  );
}

// Pre-configured variants for common inbox item types

export interface PulseItemProps {
  title: string;
  description?: string;
  context?: string;
  signalType: "entity_detected" | "voice_drift" | "consistency_issue" | "suggestion";
  confidence?: number;
  isUnread?: boolean;
  updatedAt: number;
  onReview?: () => void;
  onDismiss?: () => void;
}

const pulseIcons = {
  entity_detected: <Sparkles className="w-3.5 h-3.5" />,
  voice_drift: <AlertTriangle className="w-3.5 h-3.5" />,
  consistency_issue: <AlertCircle className="w-3.5 h-3.5" />,
  suggestion: <FileText className="w-3.5 h-3.5" />,
};

export function PulseItem({
  title,
  description,
  context,
  signalType,
  isUnread,
  updatedAt,
  onReview,
  onDismiss,
}: PulseItemProps) {
  const actions: InboxItemAction[] = [];
  if (onReview) actions.push({ label: "Review", onClick: onReview, variant: "primary" });
  if (onDismiss) actions.push({ label: "Dismiss", onClick: onDismiss, variant: "ghost" });

  return (
    <InboxItem
      icon={pulseIcons[signalType]}
      title={title}
      subtitle={description}
      context={context}
      meta={String(updatedAt)}
      status={isUnread ? "new" : "done"}
      isUnread={isUnread}
      actions={actions}
    />
  );
}

export interface ChangeItemProps {
  title: string;
  operation: string;
  riskLevel?: "low" | "high" | "core";
  actorName?: string;
  updatedAt: number;
  onApprove?: () => void;
  onReject?: () => void;
  onViewDiff?: () => void;
}

export function ChangeItemRow({
  title,
  operation,
  riskLevel,
  actorName,
  updatedAt,
  onApprove,
  onReject,
  onViewDiff,
}: ChangeItemProps) {
  const actions: InboxItemAction[] = [];
  if (onApprove) actions.push({ label: "Approve", onClick: onApprove, variant: "primary" });
  if (onReject) actions.push({ label: "Reject", onClick: onReject, variant: "ghost" });
  if (onViewDiff) actions.push({ label: "Diff", onClick: onViewDiff, variant: "ghost" });

  return (
    <InboxItem
      icon={<Circle className="w-3 h-3" strokeWidth={2} />}
      title={title}
      subtitle={actorName ? `by ${actorName}` : operation}
      status="pending"
      isUnread={true}
      meta={String(updatedAt)}
      actions={actions}
    />
  );
}

export interface ActivityItemProps {
  title: string;
  statusText: string;
  documentName?: string;
  status: "running" | "ready" | "applied" | "failed";
  isUnread?: boolean;
  updatedAt: number;
  onView?: () => void;
  onRetry?: () => void;
}

export function ActivityItemRow({
  title,
  statusText,
  documentName,
  status,
  isUnread,
  updatedAt,
  onView,
  onRetry,
}: ActivityItemProps) {
  const actions: InboxItemAction[] = [];
  if (status === "ready" && onView) {
    actions.push({ label: "View", onClick: onView, variant: "primary" });
  }
  if (status === "failed" && onRetry) {
    actions.push({ label: "Retry", onClick: onRetry, variant: "primary" });
  }

  return (
    <InboxItem
      title={title}
      subtitle={statusText}
      context={documentName}
      status={status === "applied" ? "done" : status}
      isUnread={isUnread}
      meta={String(updatedAt)}
      actions={actions}
    />
  );
}

export interface ArtifactItemProps {
  title: string;
  artifactType: string;
  isStale: boolean;
  lastSyncedAt?: number;
  onRefresh?: () => void;
  onOpen?: () => void;
}

export function ArtifactItemRow({
  title,
  artifactType,
  isStale,
  lastSyncedAt,
  onRefresh,
  onOpen,
}: ArtifactItemProps) {
  const actions: InboxItemAction[] = [];
  if (isStale && onRefresh) {
    actions.push({ label: "Refresh", onClick: onRefresh, variant: "primary" });
  }
  if (onOpen) {
    actions.push({ label: "Open", onClick: onOpen, variant: "ghost" });
  }

  const syncInfo = lastSyncedAt
    ? `Last sync: ${formatTimeAgo(lastSyncedAt)}`
    : undefined;

  return (
    <InboxItem
      icon={isStale ? <Clock className="w-3.5 h-3.5" /> : undefined}
      title={title}
      subtitle={artifactType}
      context={syncInfo}
      status={isStale ? "stale" : "done"}
      isUnread={isStale}
      actions={actions}
    />
  );
}
