import { useEffect, useCallback, useRef } from "react";
import { useHistoryStore } from "../stores/history";
import { fetchAnalysisHistory } from "../services/analysis";

/**
 * Options for the useAnalysisHistorySync hook
 */
export interface UseAnalysisHistorySyncOptions {
  /** Project ID to sync history for */
  projectId: string | null;
  /** Whether syncing is enabled */
  enabled?: boolean;
}

/**
 * Result returned by the useAnalysisHistorySync hook
 */
export interface UseAnalysisHistorySyncResult {
  /** Whether history is currently syncing */
  isSyncing: boolean;
  /** Whether history has been synced */
  isSynced: boolean;
  /** Error message if sync failed */
  error: string | null;
  /** Manually trigger sync */
  syncHistory: () => Promise<void>;
}

/**
 * Hook that syncs analysis history from the database when a project loads.
 *
 * Features:
 * - Automatically fetches history when projectId changes
 * - Hydrates the history store with database records
 * - Handles errors gracefully
 * - Deduplicates records when merging
 *
 * @param options - Hook configuration options
 * @returns Sync state and controls
 *
 * @example
 * ```tsx
 * function ProjectView({ projectId }: { projectId: string }) {
 *   const { isSyncing, error, syncHistory } = useAnalysisHistorySync({
 *     projectId,
 *     enabled: true,
 *   });
 *
 *   if (isSyncing) return <LoadingSpinner />;
 *   if (error) return <ErrorBanner message={error} onRetry={syncHistory} />;
 *
 *   return <HistoryPanel />;
 * }
 * ```
 */
export function useAnalysisHistorySync(
  options: UseAnalysisHistorySyncOptions
): UseAnalysisHistorySyncResult {
  const { projectId, enabled = true } = options;

  // Store actions
  const hydrateHistory = useHistoryStore((state) => state.hydrateHistory);
  const setSyncStatus = useHistoryStore((state) => state.setSyncStatus);
  const setCurrentProjectId = useHistoryStore((state) => state.setCurrentProjectId);
  const syncStatus = useHistoryStore((state) => state.syncStatus);
  const syncError = useHistoryStore((state) => state.syncError);
  const currentProjectId = useHistoryStore((state) => state.currentProjectId);

  // Track if we've synced this project
  const lastSyncedProjectRef = useRef<string | null>(null);

  /**
   * Sync history from database
   */
  const syncHistory = useCallback(async () => {
    if (!projectId) {
      return;
    }

    setSyncStatus("syncing");

    try {
      const records = await fetchAnalysisHistory(projectId);
      hydrateHistory(projectId, records);
      lastSyncedProjectRef.current = projectId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to sync history";
      setSyncStatus("error", message);
      console.error("[useAnalysisHistorySync] Sync error:", err);
    }
  }, [projectId, hydrateHistory, setSyncStatus]);

  // Sync when project changes
  useEffect(() => {
    if (!enabled || !projectId) {
      return;
    }

    // Only sync if project changed
    if (projectId !== currentProjectId || projectId !== lastSyncedProjectRef.current) {
      // Set the current project ID first (this clears old history)
      setCurrentProjectId(projectId);
      // Then sync
      syncHistory();
    }
  }, [enabled, projectId, currentProjectId, setCurrentProjectId, syncHistory]);

  // Clear project ID when projectId becomes null
  useEffect(() => {
    if (projectId === null && currentProjectId !== null) {
      setCurrentProjectId(null);
      lastSyncedProjectRef.current = null;
    }
  }, [projectId, currentProjectId, setCurrentProjectId]);

  return {
    isSyncing: syncStatus === "syncing",
    isSynced: syncStatus === "synced",
    error: syncError,
    syncHistory,
  };
}

export default useAnalysisHistorySync;
