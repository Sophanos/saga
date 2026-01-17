/**
 * InboxTabs - Cursor-style pill tabs for inbox filtering
 *
 * Tabs: All | Pulse | Changes | Activity | Artifacts
 * Each tab shows a count badge when items need attention.
 */

import { cn } from "@mythos/ui";
import type { InboxTab } from "@mythos/state";

interface TabConfig {
  id: InboxTab;
  label: string;
  shortLabel?: string;
}

const tabs: TabConfig[] = [
  { id: "all", label: "All" },
  { id: "pulse", label: "Pulse" },
  { id: "changes", label: "Changes" },
  { id: "activity", label: "Activity" },
  { id: "artifacts", label: "Artifacts", shortLabel: "Artifacts" },
];

interface InboxTabsProps {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  counts?: {
    pulse?: number;
    changes?: number;
    activity?: number;
    artifacts?: number;
    total?: number;
  };
  compact?: boolean;
  className?: string;
}

export function InboxTabs({
  activeTab,
  onTabChange,
  counts = {},
  compact = false,
  className,
}: InboxTabsProps) {
  const getCount = (tabId: InboxTab): number | undefined => {
    switch (tabId) {
      case "all":
        return counts.total;
      case "pulse":
        return counts.pulse;
      case "changes":
        return counts.changes;
      case "activity":
        return counts.activity;
      case "artifacts":
        return counts.artifacts;
      default:
        return undefined;
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        compact ? "px-2 py-1.5" : "px-3 py-2",
        className
      )}
      role="tablist"
      aria-label="Inbox filters"
    >
      {tabs.map((tab) => {
        const count = getCount(tab.id);
        const isActive = activeTab === tab.id;
        const showCount = count !== undefined && count > 0;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium",
              "transition-all duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mythos-accent-primary/50",
              isActive
                ? "bg-mythos-bg-active text-mythos-text-primary"
                : "text-mythos-text-secondary hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
            )}
            role="tab"
            aria-selected={isActive}
            aria-controls={`inbox-panel-${tab.id}`}
          >
            <span className={compact ? "text-xs" : "text-sm"}>
              {compact && tab.shortLabel ? tab.shortLabel : tab.label}
            </span>
            {showCount && (
              <span
                className={cn(
                  "min-w-[18px] h-[18px] px-1.5",
                  "flex items-center justify-center",
                  "text-[10px] font-semibold leading-none rounded-full",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-mythos-accent-primary text-white"
                    : "bg-mythos-bg-elevated text-mythos-text-muted"
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Minimal tab bar for compact views
 */
interface InboxTabBarProps {
  activeTab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  counts?: {
    pulse?: number;
    changes?: number;
    activity?: number;
    artifacts?: number;
  };
}

export function InboxTabBar({ activeTab, onTabChange, counts }: InboxTabBarProps) {
  const totalCount =
    (counts?.pulse ?? 0) +
    (counts?.changes ?? 0) +
    (counts?.activity ?? 0) +
    (counts?.artifacts ?? 0);

  return (
    <InboxTabs
      activeTab={activeTab}
      onTabChange={onTabChange}
      counts={{ ...counts, total: totalCount }}
      compact
    />
  );
}
