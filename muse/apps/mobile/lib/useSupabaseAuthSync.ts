import { useCallback, useEffect } from "react";
import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getMobileSupabase } from "./supabase";

interface SupabaseAuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  setAuthState: (session: Session | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

const useAuthStore = create<SupabaseAuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  setAuthState: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session?.user,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));

let authListenerStarted = false;

async function startAuthListener() {
  if (authListenerStarted) return;
  authListenerStarted = true;

  const supabase = getMobileSupabase();
  const { setAuthState, setError, setLoading } = useAuthStore.getState();

  setLoading(true);
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setError(error.message);
  }
  setAuthState(data.session ?? null);

  supabase.auth.onAuthStateChange((_event, session) => {
    setAuthState(session ?? null);
  });
}

export function useSupabaseAuthSync() {
  const { user, session, isLoading, isAuthenticated, error } = useAuthStore();

  useEffect(() => {
    void startAuthListener();
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getMobileSupabase();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      useAuthStore.getState().setError(signOutError.message);
    }
  }, []);

  return { user, session, isLoading, isAuthenticated, error, signOut };
}

