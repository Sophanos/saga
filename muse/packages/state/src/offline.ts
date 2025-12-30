/**
 * Offline state store
 * Platform-agnostic offline/sync state management
 */

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";

/**
 * Sync status for individual items
 */
export type SyncStatus = "synced" | "pending" | "syncing" | "error";

/**
 * Pending mutation status
 */
export interface PendingMutation {
  id: string;
  table: string;
  type: "upsert" | "delete";
  status: SyncStatus;
  retryCount: number;
  createdAt: string;
  error?: string;
}

/**
 * Offline state interface
 */
export interface OfflineState {
  // Network status
  isOnline: boolean;

  // Sync timestamps
  lastSyncAt: string | null;
  lastSyncAttemptAt: string | null;

  // Pending operations counts
  pendingMutations: number;
  pendingAiRequests: number;

  // Sync status
  isSyncing: boolean;
  syncError: string | null;

  // Detailed pending mutations (for debugging/UI)
  pendingMutationsList: PendingMutation[];

  // Actions
  setOnline: (isOnline: boolean) => void;
  setSyncError: (error: string | null) => void;
  updatePendingCounts: (mutations: number, aiRequests: number) => void;
  setLastSyncAt: (timestamp: string | null) => void;
  setLastSyncAttemptAt: (timestamp: string | null) => void;
  setSyncing: (isSyncing: boolean) => void;
  addPendingMutation: (mutation: PendingMutation) => void;
  removePendingMutation: (id: string) => void;
  updatePendingMutationStatus: (id: string, status: SyncStatus, error?: string) => void;
  clearPendingMutations: () => void;
  reset: () => void;
}

const initialState = {
  isOnline: true, // Assume online initially
  lastSyncAt: null,
  lastSyncAttemptAt: null,
  pendingMutations: 0,
  pendingAiRequests: 0,
  isSyncing: false,
  syncError: null,
  pendingMutationsList: [],
};

/**
 * Offline store
 */
export const useOfflineStore = create<OfflineState>()(
  immer((set) => ({
    ...initialState,

    setOnline: (isOnline) =>
      set((state) => {
        const wasOffline = !state.isOnline;
        state.isOnline = isOnline;
        // Clear sync error when coming back online
        if (isOnline && wasOffline) {
          state.syncError = null;
        }
      }),

    setSyncError: (error) =>
      set((state) => {
        state.syncError = error;
        if (error) {
          state.isSyncing = false;
        }
      }),

    updatePendingCounts: (mutations, aiRequests) =>
      set((state) => {
        state.pendingMutations = mutations;
        state.pendingAiRequests = aiRequests;
      }),

    setLastSyncAt: (timestamp) =>
      set((state) => {
        state.lastSyncAt = timestamp;
      }),

    setLastSyncAttemptAt: (timestamp) =>
      set((state) => {
        state.lastSyncAttemptAt = timestamp;
      }),

    setSyncing: (isSyncing) =>
      set((state) => {
        state.isSyncing = isSyncing;
        if (isSyncing) {
          state.lastSyncAttemptAt = new Date().toISOString();
        }
      }),

    addPendingMutation: (mutation) =>
      set((state) => {
        state.pendingMutationsList.push(mutation);
        state.pendingMutations = state.pendingMutationsList.length;
      }),

    removePendingMutation: (id) =>
      set((state) => {
        state.pendingMutationsList = state.pendingMutationsList.filter(
          (m) => m.id !== id
        );
        state.pendingMutations = state.pendingMutationsList.length;
      }),

    updatePendingMutationStatus: (id, status, error) =>
      set((state) => {
        const mutation = state.pendingMutationsList.find((m) => m.id === id);
        if (mutation) {
          mutation.status = status;
          mutation.error = error;
          if (status === "error") {
            mutation.retryCount += 1;
          }
        }
      }),

    clearPendingMutations: () =>
      set((state) => {
        state.pendingMutationsList = [];
        state.pendingMutations = 0;
      }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const useIsOnline = () => useOfflineStore((s) => s.isOnline);
export const useIsSyncing = () => useOfflineStore((s) => s.isSyncing);
export const useSyncError = () => useOfflineStore((s) => s.syncError);
export const useLastSyncAt = () => useOfflineStore((s) => s.lastSyncAt);
export const usePendingMutationsCount = () => useOfflineStore((s) => s.pendingMutations);
export const usePendingAiRequestsCount = () => useOfflineStore((s) => s.pendingAiRequests);

// Computed selectors
export const useHasPendingChanges = () =>
  useOfflineStore((s) => s.pendingMutations > 0 || s.pendingAiRequests > 0);

export const useSyncStatus = (): SyncStatus =>
  useOfflineStore((s) => {
    if (s.syncError) return "error";
    if (s.isSyncing) return "syncing";
    if (s.pendingMutations > 0) return "pending";
    return "synced";
  });

export const useOfflineIndicatorData = () =>
  useOfflineStore(
    useShallow((s) => ({
      isOnline: s.isOnline,
      isSyncing: s.isSyncing,
      pendingCount: s.pendingMutations + s.pendingAiRequests,
      hasError: !!s.syncError,
      lastSyncAt: s.lastSyncAt,
    }))
  );

export const useFailedMutations = () =>
  useOfflineStore(
    useShallow((s) => s.pendingMutationsList.filter((m) => m.status === "error"))
  );

export const usePendingMutationsByTable = (table: string) =>
  useOfflineStore(
    useShallow((s) => s.pendingMutationsList.filter((m) => m.table === table))
  );

/**
 * Format time since last sync for display
 */
export function formatTimeSinceSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return "Never";

  const now = new Date();
  const syncTime = new Date(lastSyncAt);
  const diffMs = now.getTime() - syncTime.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}
