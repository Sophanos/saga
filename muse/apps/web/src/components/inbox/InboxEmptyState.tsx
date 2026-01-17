/**
 * InboxEmptyState - Empty states for each inbox tab
 *
 * Shows contextual messaging when a tab has no items.
 * Uses subtle placeholder visuals inspired by Cursor.
 */

import {
  Bell,
  Sparkles,
  GitPullRequest,
  Activity,
  FileBox,
  Inbox,
} from "lucide-react";
import { cn } from "@mythos/ui";
import type { InboxTab } from "@mythos/state";

interface EmptyStateConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const emptyStates: Record<InboxTab, EmptyStateConfig> = {
  all: {
    icon: <Inbox className="w-8 h-8" />,
    title: "All caught up",
    description: "Nothing needs your attention right now",
  },
  pulse: {
    icon: <Sparkles className="w-8 h-8" />,
    title: "No signals",
    description: "Ambient intelligence signals will appear here",
  },
  changes: {
    icon: <GitPullRequest className="w-8 h-8" />,
    title: "No pending changes",
    description: "Knowledge changes requiring approval will appear here",
  },
  activity: {
    icon: <Activity className="w-8 h-8" />,
    title: "No recent activity",
    description: "Widget executions and results will appear here",
  },
  artifacts: {
    icon: <FileBox className="w-8 h-8" />,
    title: "No stale artifacts",
    description: "Artifacts needing refresh will appear here",
  },
};

interface InboxEmptyStateProps {
  tab: InboxTab;
  className?: string;
}

export function InboxEmptyState({ tab, className }: InboxEmptyStateProps) {
  const config = emptyStates[tab];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6",
        className
      )}
    >
      {/* Placeholder skeleton */}
      <div className="flex flex-col gap-2 mb-6 opacity-20">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-mythos-text-ghost" />
          <div className="w-32 h-2.5 rounded bg-mythos-text-ghost" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-mythos-text-ghost" />
          <div className="w-24 h-2.5 rounded bg-mythos-text-ghost" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-mythos-text-ghost" />
          <div className="w-28 h-2.5 rounded bg-mythos-text-ghost" />
        </div>
      </div>

      {/* Icon */}
      <div className="mb-3 text-mythos-text-ghost opacity-50">{config.icon}</div>

      {/* Title */}
      <p className="text-sm font-medium text-mythos-text-primary mb-1">
        {config.title}
      </p>

      {/* Description */}
      <p className="text-xs text-mythos-text-muted text-center max-w-[220px]">
        {config.description}
      </p>
    </div>
  );
}

/**
 * Minimal empty state for inline use
 */
interface InboxEmptyStateMinimalProps {
  message: string;
  className?: string;
}

export function InboxEmptyStateMinimal({
  message,
  className,
}: InboxEmptyStateMinimalProps) {
  return (
    <div className={cn("py-8 px-4 text-center", className)}>
      <p className="text-xs text-mythos-text-muted">{message}</p>
    </div>
  );
}

/**
 * Loading state for inbox
 */
interface InboxLoadingStateProps {
  className?: string;
}

export function InboxLoadingState({ className }: InboxLoadingStateProps) {
  return (
    <div className={cn("py-8 px-4", className)}>
      {/* Skeleton items */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-2.5 animate-pulse">
          <div className="w-3.5 h-3.5 rounded-full bg-mythos-bg-tertiary" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-mythos-bg-tertiary" />
            <div className="h-2.5 w-1/2 rounded bg-mythos-bg-tertiary" />
          </div>
          <div className="h-2.5 w-8 rounded bg-mythos-bg-tertiary" />
        </div>
      ))}
    </div>
  );
}
