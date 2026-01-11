import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useConvex } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  Activity,
  FileText,
  User,
  MapPin,
  Wand2,
  Users,
  Link,
  Edit3,
  Trash2,
  Plus,
  LogIn,
  LogOut,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { Avatar, Button, ScrollArea } from "@mythos/ui";
import {
  useActivityLog,
  type ActivityLogEntry,
  type ActivityType,
} from "@mythos/state";
import { formatRelativeTime, formatTime, getTimeGroupLabel } from "@mythos/core";
import { useCurrentProject } from "../../stores";

// ============================================================================
// Types
// ============================================================================

interface ActivityFeedProps {
  /** Maximum number of items to show initially */
  initialLimit?: number;
  /** Number of items to load on each "load more" */
  pageSize?: number;
  /** Custom class name */
  className?: string;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Compact mode for sidebar display */
  compact?: boolean;
}

interface ActivityItemProps {
  entry: ActivityLogEntry;
  compact?: boolean;
}

interface TimeGroupProps {
  label: string;
  children: React.ReactNode;
}

type ActivityRecord = {
  _id: Id<"activityLog">;
  projectId: Id<"projects">;
  documentId?: Id<"documents">;
  actorType?: string;
  actorUserId?: string;
  actorAgentId?: string;
  actorName?: string;
  action: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
};

function mapActivityToEntry(activity: ActivityRecord): ActivityLogEntry {
  return {
    id: activity._id,
    type: activity.action as ActivityLogEntry["type"],
    projectId: activity.projectId,
    documentId: activity.documentId,
    actorType: activity.actorType as ActivityLogEntry["actorType"],
    actorUserId: activity.actorUserId,
    actorAgentId: activity.actorAgentId,
    actorName: activity.actorName,
    userId: activity.actorUserId,
    userName: activity.actorName,
    summary: activity.summary,
    details: activity.metadata,
    createdAt: new Date(activity.createdAt).toISOString(),
  };
}

// ============================================================================
// Activity Icon & Description Helpers
// ============================================================================

interface ActivityConfig {
  icon: React.ElementType;
  color: string;
  getDescription: (entry: ActivityLogEntry) => string;
}

const ACTIVITY_CONFIGS: Record<ActivityType, ActivityConfig> = {
  project_created: {
    icon: Plus,
    color: "text-mythos-accent-primary",
    getDescription: () => "created this project",
  },
  document_created: {
    icon: FileText,
    color: "text-mythos-accent-primary",
    getDescription: (entry) =>
      `created document "${entry.targetName || "Untitled"}"`,
  },
  document_updated: {
    icon: Edit3,
    color: "text-mythos-accent-yellow",
    getDescription: (entry) =>
      `updated document "${entry.targetName || "Untitled"}"`,
  },
  entity_created: {
    icon: Plus,
    color: "text-mythos-accent-green",
    getDescription: (entry) => {
      const type = entry.targetType || "entity";
      return `created ${type} "${entry.targetName || "Unnamed"}"`;
    },
  },
  entity_updated: {
    icon: Edit3,
    color: "text-mythos-accent-yellow",
    getDescription: (entry) => {
      const type = entry.targetType || "entity";
      return `updated ${type} "${entry.targetName || "Unnamed"}"`;
    },
  },
  entity_deleted: {
    icon: Trash2,
    color: "text-mythos-accent-red",
    getDescription: (entry) => {
      const type = entry.targetType || "entity";
      return `deleted ${type} "${entry.targetName || "Unnamed"}"`;
    },
  },
  relationship_created: {
    icon: Link,
    color: "text-mythos-accent-purple",
    getDescription: () => "created a relationship",
  },
  relationship_deleted: {
    icon: Link,
    color: "text-mythos-accent-red",
    getDescription: () => "removed a relationship",
  },
  member_joined: {
    icon: LogIn,
    color: "text-mythos-accent-green",
    getDescription: (entry) =>
      entry.targetName ? `${entry.targetName} joined the project` : "joined the project",
  },
  member_left: {
    icon: LogOut,
    color: "text-mythos-text-muted",
    getDescription: (entry) =>
      entry.targetName ? `${entry.targetName} left the project` : "left the project",
  },
  member_role_changed: {
    icon: Users,
    color: "text-mythos-accent-yellow",
    getDescription: (entry) => {
      const newRole = entry.details?.['newRole'] as string | undefined;
      return newRole
        ? `changed role to ${newRole}`
        : "updated member role";
    },
  },
  comment_added: {
    icon: Edit3,
    color: "text-mythos-accent-primary",
    getDescription: () => "added a comment",
  },
  analysis_run: {
    icon: Wand2,
    color: "text-mythos-accent-purple",
    getDescription: () => "ran analysis",
  },
};

function getEntityIcon(type?: string): React.ElementType {
  switch (type) {
    case "character":
      return User;
    case "location":
      return MapPin;
    case "magic_system":
      return Wand2;
    default:
      return Activity;
  }
}

// ============================================================================
// Time Group Component
// ============================================================================

function TimeGroup({ label, children }: TimeGroupProps) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium text-mythos-text-muted uppercase tracking-wider px-2 py-1 sticky top-0 bg-mythos-bg-secondary/95 backdrop-blur-sm">
        {label}
      </h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

// ============================================================================
// Activity Item Component
// ============================================================================

function ActivityItem({ entry, compact }: ActivityItemProps) {
  const config = ACTIVITY_CONFIGS[entry.type];
  const Icon = config?.icon || Activity;
  const color = config?.color || "text-mythos-text-muted";
  const description = config?.getDescription(entry) || entry.type;

  // Use entity-specific icon for entity actions
  const DisplayIcon =
    entry.type.startsWith("entity_") && entry.targetType
      ? getEntityIcon(entry.targetType)
      : Icon;

  if (compact) {
    return (
      <div className="flex items-start gap-2 px-2 py-1.5 hover:bg-mythos-bg-primary/50 rounded-md transition-colors group">
        <div className={`mt-0.5 ${color}`}>
          <DisplayIcon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-mythos-text-secondary truncate">
            <span className="font-medium text-mythos-text-primary">
              {entry.userName || "Someone"}
            </span>{" "}
            {description}
          </p>
          <span className="text-[10px] text-mythos-text-muted">
            {formatRelativeTime(entry.createdAt)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-3 py-2 hover:bg-mythos-bg-primary/50 rounded-md transition-colors group">
      <Avatar name={entry.userName} avatarUrl={entry.userAvatarUrl} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-mythos-text-primary truncate">
            {entry.userName || "Unknown user"}
          </span>
          <div className={`${color}`}>
            <DisplayIcon className="w-3.5 h-3.5" />
          </div>
        </div>
        <p className="text-sm text-mythos-text-secondary">{description}</p>
        <span className="text-xs text-mythos-text-muted">
          {formatTime(entry.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Main ActivityFeed Component
// ============================================================================

export function ActivityFeed({
  initialLimit: _initialLimit = 20,
  pageSize = 20,
  className = "",
  showHeader = true,
  compact = false,
}: ActivityFeedProps) {
  const project = useCurrentProject();
  const convex = useConvex();
  const storeActivity = useActivityLog();

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const loadActivitiesRef = useRef<(reset?: boolean) => Promise<void>>();

  // Track mounted state for request cancellation
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load initial activities using ref to avoid dependency warning
  useEffect(() => {
    if (project?.id) {
      loadActivitiesRef.current?.(true);
    }
  }, [project?.id]);

  // Sync with store updates
  useEffect(() => {
    if (storeActivity.length > 0) {
      // Merge store activity with loaded activities
      setActivities((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newActivities = storeActivity.filter(
          (a) => !existingIds.has(a.id)
        );
        return [...newActivities, ...prev];
      });
    }
  }, [storeActivity]);

  const loadActivities = useCallback(
    async (reset = false) => {
      if (!project?.id || isLoading) return;

      setIsLoading(true);
      try {
        const currentCursor = reset ? null : cursor;
        const data = await convex.query(api.activity.listByProject, {
          projectId: project.id as Id<"projects">,
          limit: pageSize,
          cursor: currentCursor ?? undefined,
        });

        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;

        // Map DB activity to state activity format using shared mapper
        const mappedActivities: ActivityLogEntry[] = (data ?? []).map((entry) =>
          mapActivityToEntry(entry as ActivityRecord)
        );
        const nextCursor =
          mappedActivities.length > 0
            ? new Date(mappedActivities[mappedActivities.length - 1]!.createdAt).getTime()
            : null;

        if (reset) {
          setActivities(mappedActivities);
          setCursor(nextCursor);
        } else {
          setActivities((prev) => [...prev, ...mappedActivities]);
          setCursor(nextCursor);
        }

        setHasMore(mappedActivities.length === pageSize);
      } catch (error) {
        // Check mounted state before logging error
        if (!isMountedRef.current) return;
        console.error("[Collaboration] Failed to load activities:", error);
      } finally {
        // Check mounted state before setting loading to false
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [convex, project?.id, cursor, pageSize, isLoading]
  );

  // Keep ref updated with latest loadActivities function
  loadActivitiesRef.current = loadActivities;

  const handleLoadMore = useCallback(() => {
    loadActivities(false);
  }, [loadActivities]);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    loadActivities(true);
    // Debounce: prevent rapid clicking with a cooldown period
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }, 1000);
  }, [loadActivities, isRefreshing]);

  // Group activities by time
  const groupedActivities = useMemo(() => {
    const groups: { [key: string]: ActivityLogEntry[] } = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    activities.forEach((activity) => {
      const group = getTimeGroupLabel(new Date(activity.createdAt));
      groups[group].push(activity);
    });

    return groups;
  }, [activities]);

  const hasActivities = activities.length > 0;
  const groupOrder = ["Today", "Yesterday", "Earlier"];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-mythos-border-default">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-mythos-accent-primary" />
            <h3 className="text-sm font-semibold text-mythos-text-primary">
              Activity
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefreshing}
            className="h-7 w-7"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading || isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      )}

      {/* Activity List */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className={`${compact ? "py-1" : "py-2 space-y-4"}`}>
          {hasActivities ? (
            compact ? (
              // Compact: flat list without time groups
              activities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  entry={activity}
                  compact={compact}
                />
              ))
            ) : (
              // Standard: grouped by time
              groupOrder.map(
                (group) =>
                  groupedActivities[group].length > 0 && (
                    <TimeGroup key={group} label={group}>
                      {groupedActivities[group].map((activity) => (
                        <ActivityItem key={activity.id} entry={activity} />
                      ))}
                    </TimeGroup>
                  )
              )
            )
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8 text-mythos-text-muted">
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
              <span className="text-sm">Loading activity...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-mythos-text-muted">
              <Activity className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">
                Activity will appear here as you work
              </p>
            </div>
          )}

          {/* Load More */}
          {hasMore && hasActivities && (
            <div className="flex justify-center py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="gap-1"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Load more
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export type { ActivityFeedProps };
