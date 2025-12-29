/**
 * useOnlineStatus hook for React Native
 * Tracks network connectivity using @react-native-community/netinfo
 */

import { useEffect, useCallback, useState } from "react";
import { useOfflineStore, type OfflineState } from "@mythos/state";

/**
 * NetInfo state type (from @react-native-community/netinfo)
 */
interface NetInfoState {
  type: string;
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  details: unknown;
}

/**
 * NetInfo module type
 */
interface NetInfoModule {
  fetch(): Promise<NetInfoState>;
  addEventListener(callback: (state: NetInfoState) => void): () => void;
}

// Lazy load NetInfo to avoid bundling issues
let NetInfo: NetInfoModule | null = null;

async function getNetInfo(): Promise<NetInfoModule> {
  if (!NetInfo) {
    try {
      const module = await import("@react-native-community/netinfo");
      NetInfo = module.default as unknown as NetInfoModule;
    } catch (error) {
      console.error("[useOnlineStatus] NetInfo not available:", error);
      throw new Error(
        "NetInfo not available. Make sure @react-native-community/netinfo is installed."
      );
    }
  }
  return NetInfo;
}

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
  /**
   * Whether to require internet reachability (not just connection)
   */
  requireInternetReachable?: boolean;
}

/**
 * Return type for the useOnlineStatus hook
 */
export interface UseOnlineStatusResult {
  /**
   * Whether the device is currently online
   */
  isOnline: boolean;
  /**
   * Whether NetInfo is initialized
   */
  isInitialized: boolean;
  /**
   * Network connection type (wifi, cellular, etc.)
   */
  connectionType: string | null;
  /**
   * Manually refresh network status
   */
  refreshStatus: () => Promise<void>;
}

/**
 * Hook to track network connectivity on React Native
 *
 * Uses @react-native-community/netinfo to detect connectivity.
 * Updates the global offline store when status changes.
 *
 * @param options - Hook configuration options
 * @returns Online status and controls
 *
 * @example
 * ```tsx
 * const { isOnline, connectionType } = useOnlineStatus({
 *   onOnline: () => console.log('Back online!'),
 *   onOffline: () => console.log('Went offline'),
 *   syncOnReconnect: true,
 * });
 *
 * return (
 *   <View>
 *     <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
 *     <Text>Connection: {connectionType}</Text>
 *   </View>
 * );
 * ```
 */
export function useOnlineStatus(
  options: UseOnlineStatusOptions = {}
): UseOnlineStatusResult {
  const {
    onOnline,
    onOffline,
    syncOnReconnect = true,
    requireInternetReachable = false,
  } = options;

  const isOnline = useOfflineStore((s: OfflineState) => s.isOnline);
  const setOnline = useOfflineStore((s: OfflineState) => s.setOnline);

  const [isInitialized, setIsInitialized] = useState(false);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [wasOnline, setWasOnline] = useState(true);

  /**
   * Determine if we should consider the device online
   */
  const determineOnlineStatus = useCallback(
    (state: NetInfoState): boolean => {
      if (requireInternetReachable) {
        return state.isConnected === true && state.isInternetReachable === true;
      }
      return state.isConnected === true;
    },
    [requireInternetReachable]
  );

  /**
   * Refresh network status manually
   */
  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      const netInfo = await getNetInfo();
      const state = await netInfo.fetch();
      const online = determineOnlineStatus(state);
      setOnline(online);
      setConnectionType(state.type);
    } catch (error) {
      console.error("[useOnlineStatus] Failed to refresh status:", error);
    }
  }, [setOnline, determineOnlineStatus]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initNetInfo = async () => {
      try {
        const netInfo = await getNetInfo();

        // Get initial state
        const initialState = await netInfo.fetch();
        const initialOnline = determineOnlineStatus(initialState);
        setOnline(initialOnline);
        setConnectionType(initialState.type);
        setWasOnline(initialOnline);
        setIsInitialized(true);

        // Subscribe to changes
        unsubscribe = netInfo.addEventListener((state) => {
          const online = determineOnlineStatus(state);
          setConnectionType(state.type);

          // Detect transition
          if (online && !wasOnline) {
            // Coming back online
            setOnline(true);
            setWasOnline(true);
            onOnline?.();

            if (syncOnReconnect) {
              // Emit event for sync engine
              // In React Native, we'd use an EventEmitter or store action
              useOfflineStore.getState().setSyncError(null);
            }
          } else if (!online && wasOnline) {
            // Going offline
            setOnline(false);
            setWasOnline(false);
            onOffline?.();
          } else {
            setOnline(online);
            setWasOnline(online);
          }
        });
      } catch (error) {
        console.error("[useOnlineStatus] Failed to initialize:", error);
        // Assume online if NetInfo fails
        setOnline(true);
        setIsInitialized(true);
      }
    };

    initNetInfo();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    setOnline,
    onOnline,
    onOffline,
    syncOnReconnect,
    determineOnlineStatus,
    wasOnline,
  ]);

  return {
    isOnline,
    isInitialized,
    connectionType,
    refreshStatus,
  };
}

/**
 * Lightweight hook for just reading online status
 * Use this when you only need to display status without callbacks
 */
export function useIsOnline(): boolean {
  return useOfflineStore((s: OfflineState) => s.isOnline);
}

/**
 * Hook for offline indicator data
 * Returns all data needed for an offline status indicator
 */
export function useOfflineIndicator() {
  return useOfflineStore((s: OfflineState) => ({
    isOnline: s.isOnline,
    isSyncing: s.isSyncing,
    pendingCount: s.pendingMutations + s.pendingAiRequests,
    hasError: !!s.syncError,
    lastSyncAt: s.lastSyncAt,
    syncError: s.syncError,
  }));
}

export default useOnlineStatus;
