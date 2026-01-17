/**
 * Inbox - Unified inbox panel
 *
 * Cursor-inspired design with:
 * - 5 tabs: All, Pulse, Changes, Activity, Artifacts
 * - Collapsible sections per item type
 * - Consistent item rows with status indicators
 *
 * Pattern: "Agents execute. Rhei remembers."
 */

import { useMemo, useState } from "react";
import { MoreHorizontal, Check, Trash2, X } from "lucide-react";
import { cn, ScrollArea } from "@mythos/ui";
import {
  useInboxStore,
  useInboxTab,
  useGroupedInboxItems,
  usePulseItems,
  useChangeItems,
  useActivityInboxItems,
  useArtifactInboxItems,
  type InboxTab,
} from "@mythos/state";
import { InboxTabs } from "./InboxTabs";
import { InboxSection } from "./InboxSection";
import {
  InboxEmptyState,
  InboxLoadingState,
} from "./InboxEmptyState";
import {
  PulseItem,
  ChangeItemRow,
  ActivityItemRow,
  ArtifactItemRow,
} from "./InboxItem";

interface InboxProps {
  isLoading?: boolean;
  onClose?: () => void;
  onNavigateToDocument?: (documentId: string) => void;
  onNavigateToEntity?: (entityId: string) => void;
  onNavigateToArtifact?: (artifactId: string) => void;
  className?: string;
}

export function Inbox({
  isLoading = false,
  onClose,
  onNavigateToDocument,
  onNavigateToEntity,
  onNavigateToArtifact,
  className,
}: InboxProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const activeTab = useInboxTab();
  const setTab = useInboxStore((s) => s.setTab);
  const markAllRead = useInboxStore((s) => s.markAllRead);
  const clearDismissed = useInboxStore((s) => s.clearDismissed);

  // Get items
  const pulseItems = usePulseItems();
  const changeItems = useChangeItems();
  const activityItems = useActivityInboxItems();
  const artifactItems = useArtifactInboxItems();
  const grouped = useGroupedInboxItems();

  // Calculate counts
  const counts = useMemo(
    () => ({
      pulse: pulseItems.filter((i) => !i.read).length,
      changes: changeItems.filter((i) => i.status === "proposed").length,
      activity: activityItems.filter(
        (i) => i.status === "ready" || i.status === "failed"
      ).length,
      artifacts: artifactItems.filter((i) => i.status === "stale").length,
    }),
    [pulseItems, changeItems, activityItems, artifactItems]
  );

  // Filter items based on active tab
  const filteredPulse = activeTab === "all" || activeTab === "pulse" ? grouped.pulse : [];
  const filteredChanges = activeTab === "all" || activeTab === "changes" ? grouped.change : [];
  const filteredActivity = activeTab === "all" || activeTab === "activity" ? grouped.activity : [];
  const filteredArtifacts = activeTab === "all" || activeTab === "artifacts" ? grouped.artifact : [];

  // Categorize activity items
  const runningActivity = filteredActivity.filter((i) => i.status === "running");
  const needsAttentionActivity = filteredActivity.filter(
    (i) => i.status === "ready" || i.status === "failed"
  );
  const completedActivity = filteredActivity.filter(
    (i) => i.status === "applied"
  );

  // Check if current tab is empty
  const isEmpty =
    filteredPulse.length === 0 &&
    filteredChanges.length === 0 &&
    filteredActivity.length === 0 &&
    filteredArtifacts.length === 0;

  return (
    <div
      className={cn(
        "w-[380px] max-h-[520px]",
        "bg-mythos-bg-elevated border border-mythos-border-default",
        "rounded-xl shadow-2xl",
        "flex flex-col",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
      data-testid="inbox-panel"
      onClick={() => menuOpen && setMenuOpen(false)}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mythos-border-subtle">
        <span className="text-sm font-semibold text-mythos-text-primary">
          Inbox
        </span>

        <div className="flex items-center gap-1">
          {/* Menu button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className={cn(
                "p-1.5 rounded-md text-mythos-text-muted",
                "hover:text-mythos-text-secondary transition-colors",
                menuOpen ? "bg-mythos-bg-hover" : "hover:bg-mythos-bg-hover"
              )}
              aria-label="Inbox menu"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                className={cn(
                  "absolute right-0 top-8 w-48 z-10",
                  "bg-mythos-bg-elevated border border-mythos-border-default",
                  "rounded-lg shadow-lg overflow-hidden",
                  "animate-in fade-in-0 zoom-in-95 duration-100"
                )}
              >
                <button
                  onClick={() => {
                    markAllRead();
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm",
                    "text-mythos-text-primary hover:bg-mythos-bg-hover transition-colors"
                  )}
                >
                  <Check className="w-3.5 h-3.5 text-mythos-text-secondary" />
                  Mark all as read
                </button>
                <button
                  onClick={() => {
                    clearDismissed();
                    setMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 text-sm",
                    "text-mythos-text-primary hover:bg-mythos-bg-hover transition-colors"
                  )}
                >
                  <Trash2 className="w-3.5 h-3.5 text-mythos-text-secondary" />
                  Clear dismissed
                </button>
              </div>
            )}
          </div>

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                "p-1.5 rounded-md text-mythos-text-muted",
                "hover:text-mythos-text-secondary hover:bg-mythos-bg-hover transition-colors"
              )}
              aria-label="Close inbox"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-mythos-border-subtle">
        <InboxTabs
          activeTab={activeTab}
          onTabChange={setTab}
          counts={counts}
        />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <InboxLoadingState />
        ) : isEmpty ? (
          <InboxEmptyState tab={activeTab} />
        ) : (
          <>
            {/* Pulse Section */}
            {filteredPulse.length > 0 && (
              <InboxSection
                title="Pulse"
                count={filteredPulse.filter((i) => !i.read).length}
              >
                {filteredPulse.map((item) => (
                  <PulseItem
                    key={item.id}
                    title={item.title}
                    description={item.subtitle}
                    context={item.context}
                    signalType={item.signalType}
                    confidence={item.confidence}
                    isUnread={!item.read}
                    updatedAt={item.updatedAt}
                    onReview={() => {
                      if (item.targetType === "document" && item.targetId) {
                        onNavigateToDocument?.(item.targetId);
                      } else if (item.targetType === "entity" && item.targetId) {
                        onNavigateToEntity?.(item.targetId);
                      }
                    }}
                    onDismiss={() => {
                      useInboxStore.getState().dismissItem("pulse", item.id);
                    }}
                  />
                ))}
              </InboxSection>
            )}

            {/* Changes Section */}
            {filteredChanges.length > 0 && (
              <InboxSection
                title="Changes"
                count={filteredChanges.length}
                action={{ label: "Review all", onClick: () => {} }}
              >
                {filteredChanges.map((item) => (
                  <ChangeItemRow
                    key={item.id}
                    title={item.title}
                    operation={item.operation}
                    riskLevel={item.riskLevel}
                    actorName={item.metadata?.actorName as string | undefined}
                    updatedAt={item.updatedAt}
                    onApprove={() => {
                      // TODO: Approve mutation
                    }}
                    onReject={() => {
                      // TODO: Reject mutation
                    }}
                    onViewDiff={() => {
                      // TODO: Open diff view
                    }}
                  />
                ))}
              </InboxSection>
            )}

            {/* Activity - Running */}
            {runningActivity.length > 0 && (
              <InboxSection title="Running" count={runningActivity.length}>
                {runningActivity.map((item) => (
                  <ActivityItemRow
                    key={item.id}
                    title={item.title}
                    statusText={item.statusText}
                    documentName={item.documentName}
                    status="running"
                    isUnread={!item.read}
                    updatedAt={item.updatedAt}
                  />
                ))}
              </InboxSection>
            )}

            {/* Activity - Needs Attention */}
            {needsAttentionActivity.length > 0 && (
              <InboxSection
                title="Needs attention"
                count={needsAttentionActivity.length}
              >
                {needsAttentionActivity.map((item) => (
                  <ActivityItemRow
                    key={item.id}
                    title={item.title}
                    statusText={item.statusText}
                    documentName={item.documentName}
                    status={item.status as "ready" | "failed"}
                    isUnread={!item.read}
                    updatedAt={item.updatedAt}
                    onView={() => {
                      if (item.documentId) {
                        onNavigateToDocument?.(item.documentId);
                      }
                    }}
                    onRetry={() => {
                      // TODO: Retry widget execution
                    }}
                  />
                ))}
              </InboxSection>
            )}

            {/* Activity - Completed */}
            {completedActivity.length > 0 && (
              <InboxSection
                title="Completed"
                count={completedActivity.length}
                defaultExpanded={false}
              >
                {completedActivity.slice(0, 5).map((item) => (
                  <ActivityItemRow
                    key={item.id}
                    title={item.title}
                    statusText={item.statusText}
                    documentName={item.documentName}
                    status="applied"
                    isUnread={false}
                    updatedAt={item.updatedAt}
                    onView={() => {
                      if (item.documentId) {
                        onNavigateToDocument?.(item.documentId);
                      }
                    }}
                  />
                ))}
                {completedActivity.length > 5 && (
                  <button
                    className={cn(
                      "w-full px-4 py-2 text-xs text-mythos-text-muted",
                      "hover:text-mythos-text-secondary text-center"
                    )}
                  >
                    Show {completedActivity.length - 5} more
                  </button>
                )}
              </InboxSection>
            )}

            {/* Artifacts Section */}
            {filteredArtifacts.length > 0 && (
              <InboxSection
                title="Artifacts"
                count={filteredArtifacts.filter((i) => i.status === "stale").length}
              >
                {filteredArtifacts
                  .filter((i) => i.status === "stale")
                  .map((item) => (
                    <ArtifactItemRow
                      key={item.id}
                      title={item.title}
                      artifactType={item.subtitle ?? ""}
                      isStale={true}
                      lastSyncedAt={item.lastSyncedAt}
                      onRefresh={() => {
                        // TODO: Refresh artifact
                      }}
                      onOpen={() => {
                        onNavigateToArtifact?.(item.artifactId);
                      }}
                    />
                  ))}
              </InboxSection>
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
