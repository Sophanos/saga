/**
 * Inbox Components (Expo/RN)
 *
 * Unified inbox system for managing:
 * - Pulse signals (ambient intelligence)
 * - Changes (knowledge PRs)
 * - Activity (widget executions)
 * - Artifacts (stale outputs)
 */

// Main components
export { Inbox } from './Inbox';
export { InboxBell, InboxBellMinimal } from './InboxBell';

// Sub-components
export { InboxTabs } from './InboxTabs';
export { InboxSection, ControlledInboxSection } from './InboxSection';
export {
  InboxItem,
  PulseItem,
  ChangeItemRow,
  ActivityItemRow,
  ArtifactItemRow,
  type InboxItemProps,
  type InboxItemAction,
  type InboxItemStatus,
} from './InboxItem';
export {
  InboxEmptyState,
  InboxEmptyStateMinimal,
  InboxLoadingState,
} from './InboxEmptyState';
