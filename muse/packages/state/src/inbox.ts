/**
 * Inbox Store
 *
 * Unified inbox for all attention-worthy items:
 * - Pulse: Ambient intelligence signals (entity detection, voice drift, suggestions)
 * - Changes: Knowledge PRs (governed mutations requiring approval)
 * - Activity: Widget executions and async job results
 * - Artifacts: Stale/updated living outputs
 *
 * Pattern: Agents execute. Rhei remembers.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// =============================================================================
// Types
// =============================================================================

export type InboxTab = 'all' | 'pulse' | 'changes' | 'activity' | 'artifacts';

export type InboxItemType = 'pulse' | 'change' | 'activity' | 'artifact';

export type InboxItemStatus =
  | 'running'    // Activity: task in progress
  | 'ready'      // Activity: ready to view, Change: pending approval
  | 'proposed'   // Change: proposed, awaiting review
  | 'stale'      // Artifact: source has changed
  | 'applied'    // Activity: applied, Change: approved and executed
  | 'failed'     // Activity/Change: execution failed
  | 'dismissed'; // Any: user dismissed

export type PulseSignalType =
  | 'entity_detected'
  | 'voice_drift'
  | 'consistency_issue'
  | 'suggestion';

export interface InboxItem {
  id: string;
  type: InboxItemType;
  status: InboxItemStatus;
  title: string;
  subtitle?: string;
  context?: string; // e.g., "Chapter 3", "Scene 4"
  targetType?: 'document' | 'entity' | 'relationship' | 'memory' | 'artifact';
  targetId?: string;
  read: boolean;
  createdAt: number;
  updatedAt: number;
  // Type-specific data
  metadata?: Record<string, unknown>;
}

export interface PulseSignal extends InboxItem {
  type: 'pulse';
  signalType: PulseSignalType;
  confidence?: number;
}

export interface ChangeItem extends InboxItem {
  type: 'change';
  operation: string;
  riskLevel?: 'low' | 'high' | 'core';
  toolCallId?: string;
}

export interface ActivityItem extends InboxItem {
  type: 'activity';
  executionId: string;
  widgetId: string;
  statusText: string;
  documentId?: string;
  documentName?: string;
  projectId: string;
}

export interface ArtifactItem extends InboxItem {
  type: 'artifact';
  artifactId: string;
  artifactKey?: string;
  lastSyncedAt?: number;
  sourceUpdatedAt?: number;
}

export type AnyInboxItem = PulseSignal | ChangeItem | ActivityItem | ArtifactItem;

export interface InboxState {
  // UI state
  isOpen: boolean;
  activeTab: InboxTab;
  collapsedSections: Record<InboxItemType, boolean>;

  // Items (client-side cache, synced from Convex)
  pulseItems: PulseSignal[];
  changeItems: ChangeItem[];
  activityItems: ActivityItem[];
  artifactItems: ArtifactItem[];
}

export interface InboxActions {
  // Panel controls
  open: (tab?: InboxTab) => void;
  close: () => void;
  toggle: () => void;
  setTab: (tab: InboxTab) => void;

  // Section controls
  toggleSection: (section: InboxItemType) => void;
  setCollapsedSection: (section: InboxItemType, collapsed: boolean) => void;

  // Item management (client-side)
  setPulseItems: (items: PulseSignal[]) => void;
  setChangeItems: (items: ChangeItem[]) => void;
  setActivityItems: (items: ActivityItem[]) => void;
  setArtifactItems: (items: ArtifactItem[]) => void;

  // Activity sync (from widget execution store)
  syncActivityFromWidgetExecution: (params: {
    executionId: string;
    widgetId: string;
    label: string;
    status: 'running' | 'ready' | 'applied' | 'failed';
    statusText: string;
    documentId?: string | null;
    documentName?: string | null;
    projectId: string;
  }) => void;

  // Read state
  markRead: (type: InboxItemType, id: string) => void;
  markAllRead: (type?: InboxItemType) => void;

  // Dismiss
  dismissItem: (type: InboxItemType, id: string) => void;
  clearDismissed: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: InboxState = {
  isOpen: false,
  activeTab: 'activity', // Default to activity (matches bell mental model)
  collapsedSections: {
    pulse: false,
    change: false,
    activity: false,
    artifact: false,
  },
  pulseItems: [],
  changeItems: [],
  activityItems: [],
  artifactItems: [],
};

// =============================================================================
// Store
// =============================================================================

export const useInboxStore = create<InboxState & InboxActions>()(
  immer((set) => ({
    ...initialState,

    // Panel controls
    open: (tab) =>
      set((state) => {
        state.isOpen = true;
        if (tab) state.activeTab = tab;
      }),
    close: () =>
      set((state) => {
        state.isOpen = false;
      }),
    toggle: () =>
      set((state) => {
        state.isOpen = !state.isOpen;
      }),
    setTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    // Section controls
    toggleSection: (section) =>
      set((state) => {
        state.collapsedSections[section] = !state.collapsedSections[section];
      }),
    setCollapsedSection: (section, collapsed) =>
      set((state) => {
        state.collapsedSections[section] = collapsed;
      }),

    // Item management
    setPulseItems: (items) =>
      set((state) => {
        state.pulseItems = items;
      }),
    setChangeItems: (items) =>
      set((state) => {
        state.changeItems = items;
      }),
    setActivityItems: (items) =>
      set((state) => {
        state.activityItems = items;
      }),
    setArtifactItems: (items) =>
      set((state) => {
        state.artifactItems = items;
      }),

    // Activity sync from widget execution
    syncActivityFromWidgetExecution: (params) => {
      const { executionId, widgetId, label, status, statusText, documentId, documentName, projectId } = params;
      set((state) => {
        const existing = state.activityItems.find((i) => i.executionId === executionId);
        if (existing) {
          existing.status = status;
          existing.statusText = statusText;
          existing.updatedAt = Date.now();
          // Mark as unread if needs attention
          if (status === 'ready' || status === 'failed') {
            existing.read = false;
          }
        } else {
          const now = Date.now();
          state.activityItems.unshift({
            id: `activity-${executionId}`,
            type: 'activity',
            executionId,
            widgetId,
            title: label,
            status,
            statusText,
            documentId: documentId ?? undefined,
            documentName: documentName ?? undefined,
            projectId,
            read: false,
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    },

    // Read state
    markRead: (type, id) =>
      set((state) => {
        const items = getItemsByType(state, type);
        const item = items.find((i) => i.id === id);
        if (item) item.read = true;
      }),
    markAllRead: (type) =>
      set((state) => {
        if (type) {
          const items = getItemsByType(state, type);
          for (const item of items) item.read = true;
        } else {
          for (const item of state.pulseItems) item.read = true;
          for (const item of state.changeItems) item.read = true;
          for (const item of state.activityItems) item.read = true;
          for (const item of state.artifactItems) item.read = true;
        }
      }),

    // Dismiss
    dismissItem: (type, id) =>
      set((state) => {
        const items = getItemsByType(state, type);
        const item = items.find((i) => i.id === id);
        if (item) item.status = 'dismissed';
      }),
    clearDismissed: () =>
      set((state) => {
        state.pulseItems = state.pulseItems.filter((i) => i.status !== 'dismissed');
        state.changeItems = state.changeItems.filter((i) => i.status !== 'dismissed');
        state.activityItems = state.activityItems.filter((i) => i.status !== 'dismissed');
        state.artifactItems = state.artifactItems.filter((i) => i.status !== 'dismissed');
      }),
  }))
);

// Helper to get items by type
function getItemsByType(state: InboxState, type: InboxItemType): AnyInboxItem[] {
  switch (type) {
    case 'pulse':
      return state.pulseItems;
    case 'change':
      return state.changeItems;
    case 'activity':
      return state.activityItems;
    case 'artifact':
      return state.artifactItems;
  }
}

// =============================================================================
// Selectors (scalar values for performance)
// =============================================================================

export const useInboxOpen = () => useInboxStore((s) => s.isOpen);
export const useInboxTab = () => useInboxStore((s) => s.activeTab);
export const useInboxCollapsedSections = () => useInboxStore((s) => s.collapsedSections);

// Item arrays
export const usePulseItems = () => useInboxStore((s) => s.pulseItems);
export const useChangeItems = () => useInboxStore((s) => s.changeItems);
export const useActivityInboxItems = () => useInboxStore((s) => s.activityItems);
export const useArtifactInboxItems = () => useInboxStore((s) => s.artifactItems);

// Counts
export const usePulseCount = () =>
  useInboxStore((s) => s.pulseItems.filter((i) => i.status !== 'dismissed').length);

export const useChangesPendingCount = () =>
  useInboxStore((s) =>
    s.changeItems.filter((i) => i.status === 'proposed' || i.status === 'ready').length
  );

export const useActivityRunningCount = () =>
  useInboxStore((s) => s.activityItems.filter((i) => i.status === 'running').length);

export const useActivityNeedsAttentionCount = () =>
  useInboxStore((s) =>
    s.activityItems.filter((i) => i.status === 'ready' || i.status === 'failed').length
  );

export const useStaleArtifactCount = () =>
  useInboxStore((s) => s.artifactItems.filter((i) => i.status === 'stale').length);

export const useTotalInboxCount = () =>
  useInboxStore((s) => {
    const pulseCount = s.pulseItems.filter((i) => !i.read && i.status !== 'dismissed').length;
    const changeCount = s.changeItems.filter((i) => !i.read && (i.status === 'proposed' || i.status === 'ready')).length;
    const activityCount = s.activityItems.filter((i) => !i.read && (i.status === 'ready' || i.status === 'failed')).length;
    const artifactCount = s.artifactItems.filter((i) => !i.read && i.status === 'stale').length;
    return pulseCount + changeCount + activityCount + artifactCount;
  });

export const useHasRunningActivity = () =>
  useInboxStore((s) => s.activityItems.some((i) => i.status === 'running'));

export const useUnreadCountByType = () =>
  useInboxStore((s) => ({
    pulse: s.pulseItems.filter((i) => !i.read && i.status !== 'dismissed').length,
    change: s.changeItems.filter((i) => !i.read && (i.status === 'proposed' || i.status === 'ready')).length,
    activity: s.activityItems.filter((i) => !i.read && (i.status === 'ready' || i.status === 'failed')).length,
    artifact: s.artifactItems.filter((i) => !i.read && i.status === 'stale').length,
  }));

// =============================================================================
// Combined view helpers
// =============================================================================

/**
 * Get all inbox items combined and sorted by updatedAt (most recent first).
 * Use this for the "All" tab view.
 */
export function useAllInboxItems(): AnyInboxItem[] {
  const pulseItems = usePulseItems();
  const changeItems = useChangeItems();
  const activityItems = useActivityInboxItems();
  const artifactItems = useArtifactInboxItems();

  return useMemo(() => {
    const all = [
      ...pulseItems.filter((i) => i.status !== 'dismissed'),
      ...changeItems.filter((i) => i.status !== 'dismissed'),
      ...activityItems.filter((i) => i.status !== 'dismissed'),
      ...artifactItems.filter((i) => i.status !== 'dismissed'),
    ];
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [pulseItems, changeItems, activityItems, artifactItems]);
}

/**
 * Get grouped inbox items by type for the "All" tab view.
 */
export function useGroupedInboxItems() {
  const pulseItems = usePulseItems();
  const changeItems = useChangeItems();
  const activityItems = useActivityInboxItems();
  const artifactItems = useArtifactInboxItems();

  return useMemo(
    () => ({
      pulse: pulseItems.filter((i) => i.status !== 'dismissed'),
      change: changeItems.filter((i) => i.status !== 'dismissed'),
      activity: activityItems.filter((i) => i.status !== 'dismissed'),
      artifact: artifactItems.filter((i) => i.status !== 'dismissed'),
    }),
    [pulseItems, changeItems, activityItems, artifactItems]
  );
}
