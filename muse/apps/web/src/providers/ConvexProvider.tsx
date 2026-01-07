/**
 * Convex Provider for Saga Web App
 *
 * Wraps the app with Convex client and offline-first support.
 * Uses Supabase auth tokens for Convex authentication (client-side only).
 */

import { useMemo } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexOfflineProvider } from "@mythos/convex-client";
import { useAuthStore } from "../stores/auth";

// Convex client singleton
// Using self-hosted URL:
// - API + HTTP Actions: api.cascada.vision
const convexUrl = import.meta.env.VITE_CONVEX_URL || "https://api.cascada.vision";

let convexClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient {
  if (!convexClient) {
    convexClient = new ConvexReactClient(convexUrl);
  }
  return convexClient;
}

/**
 * Auth hook for Convex that uses Supabase session
 *
 * Client-side only validation - passes Supabase JWT to Convex.
 * Convex trusts the token (relies on HTTPS security).
 */
function useConvexAuth() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated: !!session,
      fetchAccessToken: async () => {
        // Return Supabase access token for Convex auth
        return session?.access_token ?? null;
      },
    }),
    [session, isLoading]
  );
}

interface ConvexProviderProps {
  children: React.ReactNode;
}

/**
 * Convex provider component with offline-first support.
 *
 * Features:
 * - TanStack Query for caching layer
 * - IndexedDB persistence for offline data
 * - Offline mutation queue with automatic retry
 * - Last-write-wins conflict resolution
 *
 * @example
 * ```tsx
 * // In main.tsx
 * <ConvexProvider>
 *   <App />
 * </ConvexProvider>
 * ```
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

/**
 * Re-export offline hook for use in components
 */
export { useConvexOffline } from "@mythos/convex-client";
