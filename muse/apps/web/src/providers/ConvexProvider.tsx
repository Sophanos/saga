/**
 * Convex Provider for Saga Web App
 *
 * Wraps the app with Convex client and offline-first support.
 * Uses Better Auth tokens for Convex authentication.
 */

import { useMemo, useCallback } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexOfflineProvider } from "@mythos/convex-client";
import { authClient } from "../lib/auth";
import { getConvexToken } from "../lib/tokenCache";

// Convex client singleton
const convexUrl = import.meta.env["VITE_CONVEX_URL"] || "https://convex.cascada.vision";

let convexClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient {
  if (!convexClient) {
    convexClient = new ConvexReactClient(convexUrl);
  }
  return convexClient;
}

/**
 * Auth hook for Convex that uses Better Auth session
 */
function useConvexAuth() {
  const { data: session, isPending } = authClient.useSession();

  const userId = session?.user?.id;
  const isAuthenticated = !!userId;

  const fetchAccessToken = useCallback(async () => {
    if (!userId) return null;
    return getConvexToken();
  }, [userId]);

  return useMemo(
    () => ({
      isLoading: isPending,
      isAuthenticated,
      fetchAccessToken,
    }),
    [isPending, isAuthenticated, fetchAccessToken]
  );
}

interface ConvexProviderProps {
  children: React.ReactNode;
}

/**
 * Convex provider component with offline-first support.
 */
export function ConvexProvider({ children }: ConvexProviderProps) {
  const client = useMemo(() => getConvexClient(), []);

  return (
    <ConvexOfflineProvider
      client={client}
      useAuth={useConvexAuth}
      config={{
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 24 * 60 * 60 * 1000, // 24 hours
        autoProcessQueue: true,
        maxRetries: 3,
        retryBaseDelay: 1000,
      }}
    >
      {children}
    </ConvexOfflineProvider>
  );
}

export { useConvexOffline } from "@mythos/convex-client";
