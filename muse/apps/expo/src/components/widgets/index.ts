/**
 * Widget Components
 *
 * UI components for widget execution in Expo.
 */

export { WidgetProgressTile } from './WidgetProgressTile';
export { WidgetPreviewModal } from './WidgetPreviewModal';
export { WidgetProvider } from './WidgetProvider';
export type { WidgetPreviewModalProps } from './WidgetPreviewModal';

// =============================================================================
// DEPRECATED: Use inbox components instead
// =============================================================================

/** @deprecated Use InboxBell from '@/components/inbox' instead */
export { InboxBell as ActivityBell } from '../inbox/InboxBell';

/** @deprecated Use Inbox from '@/components/inbox' instead */
export { Inbox as ActivityInbox } from '../inbox/Inbox';
