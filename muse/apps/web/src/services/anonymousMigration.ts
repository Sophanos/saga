/**
 * Anonymous Data Migration Service
 *
 * Handles migration of anonymous session data when users sign up.
 * This is a stub implementation - anonymous data is stored client-side
 * and needs to be migrated to the user's account on sign-up.
 */

import { useAnonymousStore } from "../stores/anonymous";

export interface AnonymousMigrationSummary {
  hasData: boolean;
  project: string | null;
  documentCount: number;
  entityCount: number;
  chatMessageCount: number;
}

export interface MigrationResult {
  success: boolean;
  projectId?: string;
  error?: string;
}

/**
 * Get a summary of data that would be migrated from anonymous session
 */
export function getAnonymousMigrationSummary(): AnonymousMigrationSummary {
  const state = useAnonymousStore.getState();

  return {
    hasData: state.project !== null || state.chatMessageCount > 0,
    project: state.project?.name ?? null,
    documentCount: state.documents.length,
    entityCount: 0, // TODO: track entities in anonymous store
    chatMessageCount: state.chatMessageCount,
  };
}

/**
 * Migrate anonymous session data to the authenticated user's account
 */
export async function migrateAnonymousData(): Promise<MigrationResult> {
  const state = useAnonymousStore.getState();

  if (!state.project) {
    return { success: true }; // Nothing to migrate
  }

  try {
    // TODO: Implement actual migration via Convex mutation
    // This would:
    // 1. Create a new project for the user with the anonymous project data
    // 2. Copy documents from local storage to the server
    // 3. Copy chat history if applicable
    // 4. Clear anonymous store

    // For now, just clear the anonymous state
    state.clearAllData();
    return { success: true };
  } catch (error) {
    console.error("[anonymousMigration] Failed to migrate:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if there's anonymous data to migrate
 */
export function hasAnonymousDataToMigrate(): boolean {
  const state = useAnonymousStore.getState();
  return state.project !== null || state.chatMessageCount > 0;
}
