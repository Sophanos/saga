/**
 * useOnlineStatus hook for web platform
 * Tracks browser online/offline status using navigator.onLine and events
 */

import { useEffect, useCallback } from "react";
import { useOfflineStore } from "@mythos/state";

/**
 * Options for the useOnlineStatus hook
 */
export interface UseOnlineStatusOptions {
  /**
   * Callback when coming back online
   */
  onOnline?: () => void;
  /**
   * Callback when going offline
   */
  onOffline?: () => void;
  /**
   * Whether to sync immediately when coming back online
   */
  syncOnReconnect?: boolean;
}

/**
 * Return type for the useOnlineStatus hook
 */
export interface UseOnlineStatusResult {
  /**
   * Whether the browser is currently online
   */
  isOnline: boolean;
  /**
   * Manually check and update online status
   */
  checkOnlineStatus: () => boolean;
}

/**
 * Hook to track browser online/offline status
 *
 * Uses navigator.onLine and online/offline events to detect connectivity.
 * Updates the global offline store when status changes.
 *
 * @param options - Hook configuration options
 * @returns Online status and controls
 *
 * @example
 * ```tsx
 * const { isOnline } = useOnlineStatus({
 *   onOnline: () => console.log('Back online!'),
 *   onOffline: () => console.log('Went offline'),
 *   syncOnReconnect: true,
 * });
 *
 * return (
 *   <div>
 *     Status: {isOnline ? 'Online' : 'Offline'}
 *   </div>
 * );
 * ```
 */
export function useOnlineStatus(
  options: UseOnlineStatusOptions = {}
): UseOnlineStatusResult {
  const { onOnline, onOffline, syncOnReconnect = true } = options;

  const isOnline = useOfflineStore((s) => s.isOnline);
  const setOnline = useOfflineStore((s) => s.setOnline);

  /**
   * Check current online status
   */
  const checkOnlineStatus = useCallback((): boolean => {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    setOnline(online);
    return online;
  }, [setOnline]);

  useEffect(() => {
    // Set initial status
    checkOnlineStatus();

    /**
     * Handle online event
     */
    const handleOnline = () => {
      setOnline(true);
      onOnline?.();

      // Optionally trigger sync when coming back online
      if (syncOnReconnect) {
        // Dispatch a custom event that sync engine can listen to
        window.dispatchEvent(new CustomEvent("mythos:reconnect"));
      }
    };

    /**
     * Handle offline event
     */
    const handleOffline = () => {
      setOnline(false);
      onOffline?.();
    };

    // Add event listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [setOnline, onOnline, onOffline, syncOnReconnect, checkOnlineStatus]);

  return {
    isOnline,
    checkOnlineStatus,
  };
}

/**
 * Lightweight hook for just reading online status
 * Use this when you only need to display status without callbacks
 */
export function useIsOnline(): boolean {
  return useOfflineStore((s) => s.isOnline);
}

/**
 * Hook for offline indicator data
 * Returns all data needed for an offline status indicator
 */
export function useOfflineIndicator() {
  return useOfflineStore((s) => ({
    isOnline: s.isOnline,
    isSyncing: s.isSyncing,
    pendingCount: s.pendingMutations + s.pendingAiRequests,
    hasError: !!s.syncError,
    lastSyncAt: s.lastSyncAt,
    syncError: s.syncError,
  }));
}

export default useOnlineStatus;
