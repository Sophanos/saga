/**
 * Supabase Auth Sync Hook
 * Synchronizes Supabase auth state with the Zustand auth store
 */

import { useEffect, useRef } from "react";
import { getSupabaseClient } from "@mythos/db";
import type { User } from "@mythos/state";

// Type for auth store actions (we'll use a generic interface to avoid circular deps)
interface AuthStoreActions {
  setAuthenticatedUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  signOut: () => void;
}

interface UseSupabaseAuthSyncOptions {
  authStore: AuthStoreActions;
}

/**
 * Fetch user profile from the profiles table
 */
async function fetchUserProfile(userId: string): Promise<Partial<User> | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("profiles" as never)
      .select("id, email, name, avatar_url")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.warn("[Auth] Failed to fetch profile:", error?.message);
      return null;
    }

    const profile = data as { id: string; email: string; name?: string; avatar_url?: string };
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatar_url,
    };
  } catch (err) {
    console.warn("[Auth] Error fetching profile:", err);
    return null;
  }
}

/**
 * Map Supabase user to our User type
 */
function mapSupabaseUser(supabaseUser: {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
  };
}): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
    avatarUrl: supabaseUser.user_metadata?.avatar_url,
  };
}

/**
 * Handle OAuth callback by checking for code parameter in URL
 */
async function handleOAuthCallback(): Promise<boolean> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  
  if (!code) {
    return false;
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error("[Auth] OAuth callback error:", error.message);
      return false;
    }

    // Clean up URL by removing the code parameter
    url.searchParams.delete("code");
    window.history.replaceState({}, document.title, url.pathname + url.search);
    
    return true;
  } catch (err) {
    console.error("[Auth] OAuth callback exception:", err);
    return false;
  }
}

/**
 * Hook to sync Supabase auth state with Zustand store
 */
export function useSupabaseAuthSync({ authStore }: UseSupabaseAuthSyncOptions): void {
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const supabase = getSupabaseClient();

    // Initialize auth state
    async function initializeAuth() {
      try {
        // First check for OAuth callback
        await handleOAuthCallback();

        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[Auth] Session error:", error.message);
          authStore.setAuthenticatedUser(null);
          return;
        }

        if (session?.user) {
          // Map Supabase user to our User type
          let user = mapSupabaseUser(session.user);

          // Try to fetch additional profile data
          const profileData = await fetchUserProfile(session.user.id);
          if (profileData) {
            user = { ...user, ...profileData };
          }

          authStore.setAuthenticatedUser(user);
        } else {
          // No session - set loading to false
          authStore.setAuthenticatedUser(null);
        }
      } catch (err) {
        console.error("[Auth] Initialization error:", err);
        authStore.setAuthenticatedUser(null);
      }
    }

    initializeAuth();

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[Auth] State change:", event);

        if (event === "SIGNED_IN" && session?.user) {
          let user = mapSupabaseUser(session.user);
          
          // Fetch profile data on sign in
          const profileData = await fetchUserProfile(session.user.id);
          if (profileData) {
            user = { ...user, ...profileData };
          }

          authStore.setAuthenticatedUser(user);
        } else if (event === "SIGNED_OUT") {
          authStore.signOut();
        } else if (event === "TOKEN_REFRESHED" && session?.user) {
          // Just update the user data on token refresh
          const user = mapSupabaseUser(session.user);
          authStore.setAuthenticatedUser(user);
        } else if (event === "USER_UPDATED" && session?.user) {
          // Fetch fresh profile data on user update
          let user = mapSupabaseUser(session.user);
          const profileData = await fetchUserProfile(session.user.id);
          if (profileData) {
            user = { ...user, ...profileData };
          }
          authStore.setAuthenticatedUser(user);
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [authStore]);
}

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}

/**
 * Sign in with Apple OAuth
 */
export async function signInWithApple(): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const timeoutMs = 8000;
    const signOutPromise = supabase.auth.signOut().then(({ error }) => ({
      error: error ? new Error(error.message) : null,
      timedOut: false,
    }));

    const timeoutPromise = new Promise<{ error: Error; timedOut: true }>((resolve) => {
      setTimeout(() => {
        resolve({ error: new Error("Sign out timed out"), timedOut: true });
      }, timeoutMs);
    });

    const result = await Promise.race([signOutPromise, timeoutPromise]);
    if (result.error && result.timedOut) {
      console.warn("[Auth] Sign out timed out, falling back to local sign out.");
      const { error: localError } = await supabase.auth.signOut({ scope: "local" });
      if (localError) {
        return { error: new Error(localError.message) };
      }
      return { error: null };
    }

    if (result.error) {
      return { error: result.error };
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}

/**
 * Send password reset email
 */
export async function resetPasswordForEmail(
  email: string
): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}

/**
 * Update user profile in the profiles table
 */
export async function updateProfile(
  userId: string,
  updates: { name?: string; avatar_url?: string; preferences?: Record<string, unknown> }
): Promise<{ error: Error | null }> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("profiles" as never)
      .update(updates as never)
      .eq("id", userId);

    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Unknown error") };
  }
}
