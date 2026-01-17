/**
 * Inbox Components
 *
 * Unified inbox system for managing:
 * - Pulse signals (ambient intelligence)
 * - Changes (knowledge PRs)
 * - Activity (widget executions)
 * - Artifacts (stale outputs)
 *
 * Plus History panel for version tracking.
 */

// Main components
export { Inbox } from "./Inbox";
export { InboxBell, InboxBellMinimal } from "./InboxBell";

// Sub-components
export { InboxTabs, InboxTabBar } from "./InboxTabs";
export { InboxSection, InboxSectionDivider, ControlledInboxSection } from "./InboxSection";
export {
  InboxItem,
  PulseItem,
  ChangeItemRow,
  ActivityItemRow,
  ArtifactItemRow,
  type InboxItemProps,
  type InboxItemAction,
  type InboxItemStatus,
} from "./InboxItem";
export {
  InboxEmptyState,
  InboxEmptyStateMinimal,
  InboxLoadingState,
} from "./InboxEmptyState";

// History components
export { HistoryPanel } from "./history/HistoryPanel";

// Hooks
export { useInboxData, useInboxCounts } from "./useInboxData";
