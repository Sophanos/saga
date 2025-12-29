/**
 * Auth state store
 * Platform-agnostic authentication state
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StorageAdapter } from "@mythos/storage";

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setOnboardingComplete: () => void;
  signOut: () => void;
  // New actions for Phase 2
  setAuthenticatedUser: (user: User | null) => void;
  updateUserProfile: (updates: Partial<User>) => void;
}

/**
 * Create auth store with platform-specific storage
 */
export function createAuthStore(storage: StorageAdapter) {
  return create<AuthState>()(
    persist(
      (set) => ({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        hasCompletedOnboarding: false,

        setUser: (user) =>
          set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
          }),

        setLoading: (isLoading) => set({ isLoading }),

        setOnboardingComplete: () => set({ hasCompletedOnboarding: true }),

        signOut: () =>
          set({
            user: null,
            isAuthenticated: false,
            hasCompletedOnboarding: false,
          }),

        // Set authenticated user and mark loading as complete
        setAuthenticatedUser: (user) =>
          set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
          }),

        // Optimistic profile update
        updateUserProfile: (updates) =>
          set((state) => ({
            user: state.user
              ? { ...state.user, ...updates }
              : null,
          })),
      }),
      {
        name: "auth",
        storage: createJSONStorage(() => ({
          getItem: async (key) => storage.getItem(key),
          setItem: async (key, value) => storage.setItem(key, value),
          removeItem: async (key) => storage.removeItem(key),
        })),
        partialize: (state) => ({
          hasCompletedOnboarding: state.hasCompletedOnboarding,
        }),
      }
    )
  );
}
