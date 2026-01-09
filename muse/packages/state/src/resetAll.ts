/**
 * Reset All Client State
 *
 * Central orchestrator for clearing all client-side state on sign-out.
 * Call this function to reset all Zustand stores to their initial state.
 */

import { useAIStore } from "./ai";
import { useWorkspaceStore } from "./workspace";
import { useLayoutStore } from "./layout";
import { useCollaborationStore } from "./collaboration";
import { useOfflineStore } from "./offline";
import { useProgressiveStore } from "./progressive";

/**
 * Reset all client state to initial values.
 * Call this during sign-out to clear sensitive data.
 */
export function resetAllClientState(): void {
  // Reset AI state (threads, messages, context)
  useAIStore.getState().reset();

  // Reset workspace state (panels, focus, tool executions)
  useWorkspaceStore.getState().reset();

  // Reset layout state (sidebar, AI panel, view mode)
  useLayoutStore.getState().reset();

  // Reset collaboration state (members, presence)
  useCollaborationStore.getState().reset();

  // Reset offline state (sync status, pending mutations)
  useOfflineStore.getState().reset();

  // Reset progressive state (archetype, onboarding, milestones)
  useProgressiveStore.getState().reset();
}

/**
 * Clear all persisted storage keys.
 * Use this for a "hard reset" that also clears localStorage/AsyncStorage.
 */
export async function clearAllPersistedStorage(): Promise<void> {
  const persistedKeys = [
    "mythos-layout",
    "mythos-auth",
    "mythos-memory-cache",
    "mythos-subscription",
    "mythos-progressive",
    "billing",
  ];

  if (typeof localStorage !== "undefined") {
    for (const key of persistedKeys) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore errors
      }
    }
  }
}

/**
 * Full reset: clear state and persisted storage.
 */
export async function hardReset(): Promise<void> {
  resetAllClientState();
  await clearAllPersistedStorage();
}
