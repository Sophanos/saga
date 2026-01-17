import { useMemo, useState } from "react";
import { MoreHorizontal, Loader2, Check, AlertCircle, Eye, Bell, Trash2 } from "lucide-react";
import { cn, Button, ScrollArea } from "@mythos/ui";
import {
  useActivityStore,
  useActivityTab,
  useActivityItems,
  useProjectStore,
  type ActivityItem,
  type ActivityTab,
} from "@mythos/state";

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
        "transition-colors duration-150",
        active
          ? "bg-mythos-bg-active text-mythos-text-primary"
          : "text-mythos-text-secondary hover:bg-mythos-bg-hover hover:text-mythos-text-primary"
      )}
      role="tab"
      aria-selected={active}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "min-w-[18px] h-[18px] px-1.5",
            "flex items-center justify-center",
            "text-[10px] font-semibold leading-none rounded-full",
            active
              ? "bg-mythos-accent-primary text-white"
              : "bg-mythos-bg-elevated text-mythos-text-muted"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="px-4 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-mythos-text-muted">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

interface ActivityItemRowProps {
  item: ActivityItem;
  onNavigate?: (documentId: string) => void;
}

function ActivityItemRow({ item, onNavigate }: ActivityItemRowProps) {
  const markRead = useActivityStore((s) => s.markRead);

  const handleClick = () => {
    markRead(item.id);
    // Navigate to document if available
    if (item.documentId && onNavigate) {
      onNavigate(item.documentId);
    }
  };

  const statusIcon = useMemo(() => {
    switch (item.status) {
      case "running":
        return <Loader2 className="w-3.5 h-3.5 text-mythos-accent-primary animate-spin" />;
      case "ready":
        return <Eye className="w-3.5 h-3.5 text-mythos-accent-primary" />;
      case "failed":
        return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
      case "applied":
        return <Check className="w-3.5 h-3.5 text-green-400" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-mythos-text-muted" />;
    }
  }, [item.status]);

  const timeAgo = useMemo(() => {
    const diff = Date.now() - item.updatedAt;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, [item.updatedAt]);

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 px-4 py-2.5",
        "hover:bg-mythos-bg-hover transition-colors duration-100",
        "cursor-pointer"
      )}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              item.read ? "text-mythos-text-secondary" : "text-mythos-text-primary"
            )}
          >
            {item.label}
          </span>
          {!item.read && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-mythos-accent-primary" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-mythos-text-muted truncate">
            {item.statusText}
          </span>
          {item.documentName && (
            <>
              <span className="text-mythos-text-ghost">·</span>
              <span className="text-xs text-mythos-text-muted truncate">
                {item.documentName}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status === "ready" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: View action
            }}
          >
            View
          </Button>
        )}
        {item.status === "failed" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Retry action
            }}
          >
            Retry
          </Button>
        )}
      </div>

      <span className="flex-shrink-0 text-[10px] text-mythos-text-ghost">
        {timeAgo}
      </span>
    </div>
  );
}

function EmptyState({ tab }: { tab: ActivityTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="flex flex-col gap-2 mb-6 opacity-30">
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

      <p className="text-sm font-medium text-mythos-text-primary mb-1">
        {tab === "widgets" ? "No widget activity" : "No reminders"}
      </p>
      <p className="text-xs text-mythos-text-muted text-center max-w-[200px]">
        {tab === "widgets"
          ? "Widget executions will appear here as they run"
          : "Reminders will appear here when scheduled"}
      </p>
    </div>
  );
}

export function ActivityInbox() {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTab = useActivityTab();
  const setTab = useActivityStore((s) => s.setTab);
  const close = useActivityStore((s) => s.close);
  const markAllRead = useActivityStore((s) => s.markAllRead);
  const clearCompleted = useActivityStore((s) => s.clearCompleted);
  const setCurrentDocumentId = useProjectStore((s) => s.setCurrentDocumentId);

  // Handle navigation to document and close inbox
  const handleNavigate = (documentId: string) => {
    setCurrentDocumentId(documentId);
    close();
  };

  const items = useActivityItems();
  const runningItems = useMemo(() => items.filter(i => i.status === 'running'), [items]);
  const readyItems = useMemo(() => items.filter(i => i.status === 'ready' || i.status === 'failed'), [items]);
  const completedItems = useMemo(() => items.filter(i => i.status === 'applied' || i.status === 'cancelled'), [items]);

  const widgetCount = items.length;
  const hasItems = items.length > 0;

  return (
    <div
      className={cn(
        "w-[340px] max-h-[480px]",
        "bg-mythos-bg-elevated border border-mythos-border-default",
        "rounded-xl shadow-xl",
        "flex flex-col"
      )}
      data-testid="activity-inbox"
      onClick={() => menuOpen && setMenuOpen(false)}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-mythos-border-subtle relative z-10">
        <span className="text-sm font-semibold text-mythos-text-primary">
          Notifications
        </span>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className={cn(
              "p-1.5 rounded-md text-mythos-text-muted hover:text-mythos-text-secondary transition-colors",
              menuOpen ? "bg-mythos-bg-hover" : "hover:bg-mythos-bg-hover"
            )}
            aria-label="Menu"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 w-48 bg-mythos-bg-elevated border border-mythos-border-default rounded-lg shadow-lg overflow-hidden z-10">
              <button
                onClick={() => { markAllRead(); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mythos-text-primary hover:bg-mythos-bg-hover transition-colors"
              >
                <Check className="w-3.5 h-3.5 text-mythos-text-secondary" />
                Mark all as read
              </button>
              <button
                onClick={() => { clearCompleted(); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-mythos-text-primary hover:bg-mythos-bg-hover transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-mythos-text-secondary" />
                Clear completed
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 py-2 border-b border-mythos-border-subtle">
        <TabButton
          label="Activity"
          count={widgetCount}
          active={activeTab === "widgets"}
          onClick={() => setTab("widgets")}
        />
        <TabButton
          label="Reminders"
          active={activeTab === "reminders"}
          onClick={() => setTab("reminders")}
        />
      </div>

      <ScrollArea className="flex-1">
        {activeTab === "widgets" && (
          <>
            {!hasItems && <EmptyState tab="widgets" />}

            {runningItems.length > 0 && (
              <Section title="Running">
                {runningItems.map((item) => (
                  <ActivityItemRow key={item.id} item={item} onNavigate={handleNavigate} />
                ))}
              </Section>
            )}

            {readyItems.length > 0 && (
              <Section title="Needs attention">
                {readyItems.map((item) => (
                  <ActivityItemRow key={item.id} item={item} onNavigate={handleNavigate} />
                ))}
              </Section>
            )}

            {completedItems.length > 0 && (
              <Section title="Completed">
                {completedItems.slice(0, 5).map((item) => (
                  <ActivityItemRow key={item.id} item={item} onNavigate={handleNavigate} />
                ))}
                {completedItems.length > 5 && (
                  <button
                    className="w-full px-4 py-2 text-xs text-mythos-text-muted hover:text-mythos-text-secondary text-center"
                    onClick={() => {
                      // TODO: Show all completed
                    }}
                  >
                    Show {completedItems.length - 5} more
                  </button>
                )}
              </Section>
            )}
          </>
        )}

        {activeTab === "reminders" && <EmptyState tab="reminders" />}
      </ScrollArea>
    </div>
  );
}
