/**
 * Activity Store
 *
 * Manages widget execution activity notifications.
 * Craft-inspired notification inbox for widget status.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { WidgetExecutionStatus } from '@mythos/agent-protocol';

// =============================================================================
// Types
// =============================================================================

export type ActivityTab = 'widgets' | 'reminders';

export type ActivityItemStatus = 'running' | 'ready' | 'applied' | 'failed' | 'cancelled';

export interface ActivityItem {
  id: string;
  executionId: string;
  widgetId: string;
  label: string;
  status: ActivityItemStatus;
  statusText: string;
  documentId: string | null;
  documentName: string | null;
  projectId: string;
  createdAt: number;
  updatedAt: number;
  read: boolean;
}

export interface ActivityState {
  // UI state
  isOpen: boolean;
  activeTab: ActivityTab;

  // Items
  items: ActivityItem[];
}

export interface ActivityActions {
  // Panel
  open: () => void;
  close: () => void;
  toggle: () => void;
  setTab: (tab: ActivityTab) => void;

  // Items
  addItem: (item: Omit<ActivityItem, 'createdAt' | 'updatedAt' | 'read'>) => void;
  updateItem: (id: string, updates: Partial<Pick<ActivityItem, 'status' | 'statusText'>>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;

  // Sync with widget execution
  syncFromWidgetExecution: (params: {
    executionId: string;
    widgetId: string;
    label: string;
    status: WidgetExecutionStatus;
    documentId?: string | null;
    documentName?: string | null;
    projectId: string;
  }) => void;
}

// =============================================================================
// Status helpers
// =============================================================================

function widgetStatusToActivityStatus(status: WidgetExecutionStatus): ActivityItemStatus {
  switch (status) {
    case 'idle':
      return 'applied';
    case 'gathering':
    case 'generating':
    case 'formatting':
      return 'running';
    case 'preview':
      return 'ready';
    case 'done':
      return 'applied';
    case 'error':
      return 'failed';
    default:
      return 'running';
  }
}

function getStatusText(status: WidgetExecutionStatus): string {
  switch (status) {
    case 'gathering':
      return 'Gathering context...';
    case 'generating':
      return 'Generating...';
    case 'formatting':
      return 'Formatting...';
    case 'preview':
      return 'Ready to view';
    case 'done':
      return 'Applied';
    case 'error':
      return 'Failed';
    default:
      return 'Working...';
  }
}

// =============================================================================
// Initial State
// =============================================================================

const initialState: ActivityState = {
  isOpen: false,
  activeTab: 'widgets',
  items: [],
};

// =============================================================================
// Store
// =============================================================================

export const useActivityStore = create<ActivityState & ActivityActions>()(
  immer((set) => ({
    ...initialState,

    // Panel controls
    open: () => set((state) => { state.isOpen = true; }),
    close: () => set((state) => { state.isOpen = false; }),
    toggle: () => set((state) => { state.isOpen = !state.isOpen; }),
    setTab: (tab) => set((state) => { state.activeTab = tab; }),

    // Item management
    addItem: (item) => {
      const now = Date.now();
      set((state) => {
        // Remove any existing item with same executionId
        state.items = state.items.filter((i) => i.executionId !== item.executionId);
        state.items.unshift({
          ...item,
          createdAt: now,
          updatedAt: now,
          read: false,
        });
      });
    },

    updateItem: (id, updates) => {
      set((state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) {
          Object.assign(item, updates, { updatedAt: Date.now() });
        }
      });
    },

    markRead: (id) => {
      set((state) => {
        const item = state.items.find((i) => i.id === id);
        if (item) {
          item.read = true;
        }
      });
    },

    markAllRead: () => {
      set((state) => {
        for (const item of state.items) {
          item.read = true;
        }
      });
    },

    removeItem: (id) => {
      set((state) => {
        state.items = state.items.filter((i) => i.id !== id);
      });
    },

    clearCompleted: () => {
      set((state) => {
        state.items = state.items.filter(
          (i) => i.status === 'running' || i.status === 'ready'
        );
      });
    },

    // Sync from widget execution store
    syncFromWidgetExecution: (params) => {
      const { executionId, widgetId, label, status, documentId, documentName, projectId } = params;
      const activityStatus = widgetStatusToActivityStatus(status);
      const statusText = getStatusText(status);

      set((state) => {
        const existing = state.items.find((i) => i.executionId === executionId);
        if (existing) {
          existing.status = activityStatus;
          existing.statusText = statusText;
          existing.updatedAt = Date.now();
          // Mark as unread if needs attention
          if (activityStatus === 'ready' || activityStatus === 'failed') {
            existing.read = false;
          }
        } else {
          // Add new item
          const now = Date.now();
          state.items.unshift({
            id: `activity-${executionId}`,
            executionId,
            widgetId,
            label,
            status: activityStatus,
            statusText,
            documentId: documentId ?? null,
            documentName: documentName ?? null,
            projectId,
            createdAt: now,
            updatedAt: now,
            read: false,
          });
        }
      });
    },
  }))
);

// =============================================================================
// Selectors (scalar values only to avoid reference issues)
// =============================================================================

export const useActivityOpen = () => useActivityStore((s) => s.isOpen);
export const useActivityTab = () => useActivityStore((s) => s.activeTab);

// Return the items array directly - components should use useMemo for filtering
export const useActivityItems = () => useActivityStore((s) => s.items);

export const useUnreadCount = () =>
  useActivityStore((s) => s.items.filter((i) => !i.read).length);

export const useNeedsAttentionCount = () =>
  useActivityStore((s) =>
    s.items.filter((i) => i.status === 'ready' || i.status === 'failed').length
  );

export const useRunningCount = () =>
  useActivityStore((s) => s.items.filter((i) => i.status === 'running').length);

export const useHasRunningWidgets = () =>
  useActivityStore((s) => s.items.some((i) => i.status === 'running'));

/**
 * TabWidgetStatus - maps to TabBar indicator states
 * 'idle' = no indicator, 'running' = spinner, 'ready' = pulse dot, 'failed' = red dot
 */
export type TabWidgetStatus = 'idle' | 'running' | 'ready' | 'failed';

/**
 * Get the highest priority widget status for a document.
 * Priority: running > ready > failed > idle
 */
function getDocumentWidgetStatus(items: ActivityItem[], documentId: string): TabWidgetStatus {
  const docItems = items.filter((i) => i.documentId === documentId);
  if (docItems.length === 0) return 'idle';

  // Check for running first (highest priority)
  if (docItems.some((i) => i.status === 'running')) return 'running';
  // Then ready (needs attention)
  if (docItems.some((i) => i.status === 'ready')) return 'ready';
  // Then failed (needs attention)
  if (docItems.some((i) => i.status === 'failed')) return 'failed';

  return 'idle';
}

/**
 * Returns a map of document IDs to their widget status.
 * Used by TabBar to show indicators per document tab.
 *
 * Uses a stable serialization key to avoid infinite re-renders.
 */
export function useWidgetStatusByDocument(): Record<string, TabWidgetStatus> {
  // Get items first
  const items = useActivityStore((s) => s.items);

  // Compute the status map with useMemo to ensure stable reference
  return useMemo(() => {
    const statusMap: Record<string, TabWidgetStatus> = {};

    // Get unique document IDs
    const documentIds = new Set(
      items
        .filter((i) => i.documentId !== null)
        .map((i) => i.documentId as string)
    );

    // Calculate status for each document
    for (const docId of documentIds) {
      statusMap[docId] = getDocumentWidgetStatus(items, docId);
    }

    return statusMap;
  }, [items]);
}
