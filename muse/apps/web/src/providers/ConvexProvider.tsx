/**
 * Convex Provider for Saga Web App
 *
 * Wraps the app with Convex client, Convex Auth, and offline-first support.
 */

import { useEffect, useMemo } from "react";
import { ConvexReactClient, useConvexAuth as useConvexAuthBase, useQuery } from "convex/react";
import { ConvexAuthProvider, useAuthActions } from "@convex-dev/auth/react";
import { useAuthStore } from "@mythos/auth";
import { ConvexOfflineProvider } from "@mythos/convex-client";
import { api } from "../../../../convex/_generated/api";
import { isTauri } from "../lib/tauriAuth";

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
 * Deep link handler for Tauri OAuth callbacks
 * Listens for mythos:// deep links and completes the OAuth code exchange
 */
function TauriDeepLinkHandler(): null {
  const { signIn } = useAuthActions();

  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    async function setup() {
      try {
        // Use the tauriAuth helper which handles dynamic imports
        const { listenForDeepLinks } = await import("../lib/tauriAuth");

        unlisten = await listenForDeepLinks(async (url) => {
          console.log("[tauri-auth] Received deep link:", url);

          try {
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get("code");
            const error = urlObj.searchParams.get("error");

            if (error) {
              console.error("[tauri-auth] OAuth error:", error, urlObj.searchParams.get("error_description"));
              return;
            }

            if (!code) {
              console.warn("[tauri-auth] Deep link missing code parameter");
              return;
            }

            // Complete OAuth by exchanging code for tokens
            console.log("[tauri-auth] Completing OAuth with code");
            await signIn(undefined as unknown as string, { code });
            console.log("[tauri-auth] OAuth complete");
          } catch (err) {
            console.error("[tauri-auth] Failed to complete OAuth:", err);
          }
        });

        console.log("[tauri-auth] Deep link listener registered");
      } catch (err) {
        console.error("[tauri-auth] Failed to setup deep link listener:", err);
      }
    }

    setup();

    return () => {
      unlisten?.();
    };
  }, [signIn]);

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
      <TauriDeepLinkHandler />
      <ConvexOfflineWrapper>{children}</ConvexOfflineWrapper>
    </ConvexAuthProvider>
  );
}

export { useConvexOffline } from "@mythos/convex-client";
