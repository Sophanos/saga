/**
 * Convex Provider for Saga Web App
 *
 * Wraps the app with Convex client and offline-first support.
 * Uses Better Auth tokens for Convex authentication.
 */

import { useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexOfflineProvider } from "@mythos/convex-client";
import { authClient } from "../lib/auth";

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

  return useMemo(
    () => ({
      isLoading: isPending,
      isAuthenticated: !!session?.user,
      fetchAccessToken: async () => {
        // convexClient plugin handles token exchange with Better Auth
        // The token is automatically managed by the crossDomainClient plugin
        const token = await authClient.$fetch("/api/auth/convex-token", {
          method: "GET",
        });
        return token?.data?.token ?? null;
      },
    }),
    [session, isPending]
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
