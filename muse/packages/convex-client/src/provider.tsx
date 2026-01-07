/**
 * Convex Offline Provider
 *
 * Provides Convex client with offline-first support.
 * Wraps ConvexProviderWithAuth with TanStack Query and offline utilities.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  persistQueryCache,
  restoreQueryCache,
} from "./offline/cache";
import { getMutationQueue, type OfflineMutationQueue } from "./offline/mutationQueue";
import type { ConvexOfflineConfig, OfflineState } from "./types";

// Create query client with offline-first defaults
function createQueryClient(staleTime: number, gcTime: number): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime,
        gcTime,
        networkMode: "offlineFirst",
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });
}

// Context for offline state
interface ConvexOfflineContextValue extends OfflineState {
  /**
   * Manually trigger queue processing
   */
  processQueue: () => Promise<void>;

  /**
   * Clear the offline cache
   */
  clearCache: () => Promise<void>;

  /**
   * Force persist the current cache
   */
  persistCache: () => Promise<void>;
}

const ConvexOfflineContext = createContext<ConvexOfflineContextValue | null>(null);

/**
 * Hook to access offline state and utilities
 */
export function useConvexOffline(): ConvexOfflineContextValue {
  const context = useContext(ConvexOfflineContext);
  if (!context) {
    throw new Error("useConvexOffline must be used within ConvexOfflineProvider");
  }
  return context;
}

interface ConvexOfflineProviderProps {
  /**
   * Convex client instance
   */
  client: ConvexReactClient;

  /**
   * Auth hook for Convex (e.g., from Supabase)
   */
  useAuth: () => {
    isLoading: boolean;
    isAuthenticated: boolean;
    fetchAccessToken: () => Promise<string | null>;
  };

  /**
   * Children components
   */
  children: ReactNode;

  /**
   * Configuration options
   */
  config?: Partial<ConvexOfflineConfig>;
}

/**
 * Provider that wraps Convex with offline-first support.
 *
 * Features:
 * - TanStack Query for caching layer
 * - IndexedDB persistence for offline data
 * - Offline mutation queue with automatic retry
 * - Last-write-wins conflict resolution
 *
 * @example
 * ```tsx
 * const convex = new ConvexReactClient(CONVEX_URL);
 *
 * function useAuth() {
 *   const session = useAuthStore((s) => s.session);
 *   return {
 *     isLoading: false,
 *     isAuthenticated: !!session,
 *     fetchAccessToken: async () => session?.access_token ?? null,
 *   };
 * }
 *
 * <ConvexOfflineProvider client={convex} useAuth={useAuth}>
 *   <App />
 * </ConvexOfflineProvider>
 * ```
 */
export function ConvexOfflineProvider({
  client,
  useAuth,
  children,
  config = {},
}: ConvexOfflineProviderProps): React.ReactElement {
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    gcTime = 24 * 60 * 60 * 1000, // 24 hours
    autoProcessQueue = true,
    maxRetries = 3,
    retryBaseDelay = 1000,
  } = config;

  // Create query client
  const [queryClient] = useState(() => createQueryClient(staleTime, gcTime));

  // Offline state
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  // Initialize mutation queue
  const [mutationQueue] = useState<OfflineMutationQueue>(() =>
    getMutationQueue({
      maxRetries,
      retryBaseDelay,
      onStatusChange: (count, processing) => {
        setPendingMutationCount(count);
        setIsProcessingQueue(processing);
        if (!processing && count === 0) {
          setLastSyncAt(Date.now());
        }
      },
    })
  );

  // Set client on queue
  useEffect(() => {
    mutationQueue.setClient(client);
  }, [mutationQueue, client]);

  // Restore cache on mount
  useEffect(() => {
    restoreQueryCache(queryClient).catch((error) => {
      console.warn("[convex-client] Failed to restore cache:", error);
    });
  }, [queryClient]);

  // Persist cache before unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      persistQueryCache(queryClient, gcTime).catch(() => {
        // Ignore errors during unload
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [queryClient, gcTime]);

  // Periodic cache persistence
  useEffect(() => {
    const interval = setInterval(() => {
      persistQueryCache(queryClient, gcTime).catch((error) => {
        console.warn("[convex-client] Failed to persist cache:", error);
      });
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [queryClient, gcTime]);

  // Online/offline handling
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);

      if (autoProcessQueue) {
        mutationQueue.processQueue().catch((error) => {
          setSyncError(error instanceof Error ? error : new Error(String(error)));
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [autoProcessQueue, mutationQueue]);

  // Initialize pending count
  useEffect(() => {
    mutationQueue.getPendingCount().then(setPendingMutationCount);
  }, [mutationQueue]);

  // Context value
  const processQueue = useCallback(async () => {
    try {
      setSyncError(null);
      await mutationQueue.processQueue();
    } catch (error) {
      setSyncError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [mutationQueue]);

  const clearCache = useCallback(async () => {
    queryClient.clear();
    await import("./offline/cache").then((m) => m.clearQueryCache());
  }, [queryClient]);

  const persistCache = useCallback(async () => {
    await persistQueryCache(queryClient, gcTime);
  }, [queryClient, gcTime]);

  const contextValue = useMemo<ConvexOfflineContextValue>(
    () => ({
      isOnline,
      pendingMutationCount,
      isProcessingQueue,
      lastSyncAt,
      syncError,
      processQueue,
      clearCache,
      persistCache,
    }),
    [
      isOnline,
      pendingMutationCount,
      isProcessingQueue,
      lastSyncAt,
      syncError,
      processQueue,
      clearCache,
      persistCache,
    ]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConvexProviderWithAuth client={client} useAuth={useAuth}>
        <ConvexOfflineContext.Provider value={contextValue}>
          {children}
        </ConvexOfflineContext.Provider>
      </ConvexProviderWithAuth>
    </QueryClientProvider>
  );
}
