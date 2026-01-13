/**
 * Convex Provider for Saga Web App
 *
 * Wraps the app with Convex client, Convex Auth, and offline-first support.
 */

import { useEffect, useMemo } from "react";
import { ConvexReactClient, useConvexAuth as useConvexAuthBase, useQuery } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useAuthStore } from "@mythos/auth";
import { ConvexOfflineProvider } from "@mythos/convex-client";
import { api } from "../../../../convex/_generated/api";

// Convex client singleton
const convexUrl = import.meta.env["VITE_CONVEX_URL"] || "https://convex.rhei.team";

let convexClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient {
  if (!convexClient) {
    convexClient = new ConvexReactClient(convexUrl);
  }
  return convexClient;
}

function replaceURL(url: string): void {
  if (typeof window !== "undefined") {
    window.history.replaceState({}, "", url);
  }
}

/**
 * Auth hook for Convex that wraps useConvexAuth for offline provider
 */
function useConvexAuthForOffline() {
  const { isLoading, isAuthenticated } = useConvexAuthBase();

  return useMemo(
    () => ({
      isLoading,
      isAuthenticated,
      // Convex Auth handles tokens internally, so we return null
      // The auth token is automatically included in Convex requests
      fetchAccessToken: async () => null,
    }),
    [isLoading, isAuthenticated]
  );
}

interface ConvexProviderProps {
  children: React.ReactNode;
}

function AuthSync(): null {
  const { isLoading, isAuthenticated } = useConvexAuthBase();
  const currentUser = useQuery(api.users.getCurrentUser, isAuthenticated ? {} : "skip");
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    const syncLoading = isLoading || (isAuthenticated && currentUser === undefined);
    setLoading(syncLoading);
    if (syncLoading) return;

    if (isAuthenticated && currentUser) {
      const image = currentUser.image ?? undefined;
      const existingUser = useAuthStore.getState().user;
      const preserved =
        existingUser?.id === currentUser._id
          ? {
              avatarUrl: existingUser.avatarUrl,
              preferences: existingUser.preferences,
            }
          : {};

      setUser({
        id: currentUser._id,
        email: currentUser.email ?? "",
        name: currentUser.name ?? undefined,
        image,
        avatarUrl: image ?? preserved.avatarUrl,
        preferences: preserved.preferences,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      reset();
    }
  }, [currentUser, isAuthenticated, isLoading, reset, setLoading, setUser]);

  return null;
}

/**
 * Inner provider with offline support
 */
function ConvexOfflineWrapper({ children }: ConvexProviderProps) {
  const client = useMemo(() => getConvexClient(), []);

  return (
    <ConvexOfflineProvider
      client={client}
      useAuth={useConvexAuthForOffline}
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
 * Convex provider component with Convex Auth and offline-first support.
 */
export function ConvexProvider({ children }: ConvexProviderProps) {
  const client = useMemo(() => getConvexClient(), []);

  return (
    <ConvexAuthProvider client={client} replaceURL={replaceURL}>
      <AuthSync />
      <ConvexOfflineWrapper>{children}</ConvexOfflineWrapper>
    </ConvexAuthProvider>
  );
}

export { useConvexOffline } from "@mythos/convex-client";
