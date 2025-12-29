/**
 * Mobile Supabase Auth Sync Hook
 *
 * Provides authentication state synchronization for React Native.
 * Handles session restoration, auth state changes, and provides
 * loading/error states for the auth flow.
 */

import { useEffect, useState, useCallback } from "react";
import type { Session, User, AuthError } from "@supabase/supabase-js";
import { getMobileSupabase } from "./supabase";

/**
 * Auth state returned by the hook
 */
export interface AuthState {
  /** Current session (null if not authenticated) */
  session: Session | null;
  /** Current user (null if not authenticated) */
  user: User | null;
  /** Whether initial session check is in progress */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Any auth error that occurred */
  error: AuthError | null;
}

/**
 * Auth actions returned by the hook
 */
export interface AuthActions {
  /** Sign out the current user */
  signOut: () => Promise<void>;
  /** Refresh the current session */
  refreshSession: () => Promise<void>;
}

/**
 * Hook for synchronizing Supabase auth state in React Native.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isLoading, isAuthenticated, user } = useSupabaseAuthSync();
 *
 *   if (isLoading) return <SplashScreen />;
 *   if (!isAuthenticated) return <SignInScreen />;
 *   return <MainApp user={user} />;
 * }
 * ```
 */
export function useSupabaseAuthSync(): AuthState & AuthActions {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  // Initialize and subscribe to auth changes
  useEffect(() => {
    const supabase = getMobileSupabase();
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          console.warn("[Auth] Failed to get session:", sessionError.message);
          setError(sessionError);
        } else {
          setSession(data.session);
        }
      } catch (err) {
        console.error("[Auth] Unexpected error during initialization:", err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      console.log("[Auth] State change:", event);

      switch (event) {
        case "SIGNED_IN":
        case "TOKEN_REFRESHED":
          setSession(newSession);
          setError(null);
          break;

        case "SIGNED_OUT":
          setSession(null);
          setError(null);
          break;

        case "USER_UPDATED":
          setSession(newSession);
          break;

        case "INITIAL_SESSION":
          // Already handled above
          break;

        default:
          // Handle any other events
          setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign out action
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = getMobileSupabase();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        console.error("[Auth] Sign out error:", signOutError.message);
        setError(signOutError);
      }
    } catch (err) {
      console.error("[Auth] Unexpected sign out error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh session action
  const refreshSession = useCallback(async () => {
    try {
      const supabase = getMobileSupabase();
      const { data, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error("[Auth] Session refresh error:", refreshError.message);
        setError(refreshError);
      } else {
        setSession(data.session);
      }
    } catch (err) {
      console.error("[Auth] Unexpected refresh error:", err);
    }
  }, []);

  return {
    session,
    user: session?.user ?? null,
    isLoading,
    isAuthenticated: !!session?.user,
    error,
    signOut,
    refreshSession,
  };
}

export default useSupabaseAuthSync;
