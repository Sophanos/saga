import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { Button, ScrollArea } from "@mythos/ui";
import {
  useActivityLog,
  type ActivityLogEntry,
  type ActivityType,
} from "@mythos/state";
import { getProjectActivityWithActors, type ActivityWithActor } from "@mythos/db";
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

// ============================================================================
// Utility Functions
// ============================================================================

function getTimeGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (entryDate.getTime() === today.getTime()) {
    return "Today";
  } else if (entryDate.getTime() === yesterday.getTime()) {
    return "Yesterday";
  } else {
    return "Earlier";
  }
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatTime(dateString);
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
    color: "text-mythos-accent-cyan",
    getDescription: () => "created this project",
  },
  document_created: {
    icon: FileText,
    color: "text-mythos-accent-cyan",
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
    color: "text-mythos-accent-cyan",
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
// Avatar Component
// ============================================================================

interface AvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: "sm" | "md";
}

function Avatar({ name, avatarUrl, size = "sm" }: AvatarProps) {
  const sizeClasses = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name || "User"}
      className={`${sizeClasses} rounded-full object-cover`}
    />
  ) : (
    <div
      className={`${sizeClasses} rounded-full bg-mythos-accent-cyan/30 flex items-center justify-center font-medium text-mythos-accent-cyan`}
    >
      {initials}
    </div>
  );
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
  const storeActivity = useActivityLog();

  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial activities
  useEffect(() => {
    if (project?.id) {
      loadActivities(true);
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
        const currentOffset = reset ? 0 : offset;
        const data = await getProjectActivityWithActors(project.id, {
          limit: pageSize,
          offset: currentOffset,
        });

        // Map DB activity to state activity format
        const mappedActivities: ActivityLogEntry[] = data.map((item) => ({
          id: String(item.id),
          type: mapActionToType(item.action, item.entity_table),
          projectId: item.project_id,
          userId: item.actor_user_id || "",
          userName: item.actor_name,
          userAvatarUrl: item.actor_avatar_url,
          targetId: item.entity_id || undefined,
          targetType: item.entity_table,
          targetName: getEntityName(item),
          details: item.metadata,
          createdAt: item.created_at,
        }));

        if (reset) {
          setActivities(mappedActivities);
          setOffset(pageSize);
        } else {
          setActivities((prev) => [...prev, ...mappedActivities]);
          setOffset((prev) => prev + pageSize);
        }

        setHasMore(data.length === pageSize);
      } catch (error) {
        console.error("Failed to load activities:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [project?.id, offset, pageSize, isLoading]
  );

  const handleLoadMore = useCallback(() => {
    loadActivities(false);
  }, [loadActivities]);

  const handleRefresh = useCallback(() => {
    loadActivities(true);
  }, [loadActivities]);

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-mythos-text-muted/20">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-mythos-accent-cyan" />
            <h3 className="text-sm font-semibold text-mythos-text-primary">
              Activity
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-7 w-7"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
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

// ============================================================================
// Helper Functions
// ============================================================================

function mapActionToType(action: string, entityTable: string): ActivityType {
  // Map DB action + table to our ActivityType
  const actionMap: Record<string, ActivityType> = {
    "create:documents": "document_created",
    "update:documents": "document_updated",
    "create:entities": "entity_created",
    "update:entities": "entity_updated",
    "delete:entities": "entity_deleted",
    "create:relationships": "relationship_created",
    "delete:relationships": "relationship_deleted",
    "create:project_members": "member_joined",
    "delete:project_members": "member_left",
    "update:project_members": "member_role_changed",
    "create:projects": "project_created",
    join: "member_joined",
    leave: "member_left",
  };

  const key = `${action}:${entityTable}`;
  return actionMap[key] || actionMap[action] || "document_updated";
}

function getEntityName(activity: ActivityWithActor): string | undefined {
  const afterData = activity.after_data as Record<string, unknown> | undefined;
  const beforeData = activity.before_data as Record<string, unknown> | undefined;

  return (
    (afterData?.['name'] as string) ||
    (afterData?.['title'] as string) ||
    (beforeData?.['name'] as string) ||
    (beforeData?.['title'] as string) ||
    undefined
  );
}

export type { ActivityFeedProps };
