/**
 * useProgressiveSync
 *
 * Syncs progressive state for mobile.
 * TODO: Migrate to Convex when progressive state table is added.
 */

import { useEffect, useRef } from "react";
import { useProgressiveStore } from "@mythos/state";

/**
 * Progressive state shape (local type definition)
 */
interface ProgressiveProjectState {
  creation_mode: "discovery" | "architect";
  phase: 1 | 2 | 3 | 4;
  unlocked_modules: Record<string, true>;
  total_writing_time_sec: number;
  last_entity_nudge_word_count: number | null;
  never_ask: Record<string, true>;
}

/**
 * Sync progressive state from database for a project
 *
 * TODO: Implement Convex backend for progressive state
 * Currently defaults to architect mode (phase 4, all modules unlocked)
 *
 * @param projectId - The project to sync state for
 */
export function useProgressiveSync(projectId: string | null): void {
  const hasSyncedRef = useRef<string | null>(null);

  const { ensureProject, setActiveProject } = useProgressiveStore.getState();

  useEffect(() => {
    if (!projectId) return;

    // Don't re-sync if we already synced this project
    if (hasSyncedRef.current === projectId) return;

    // Default to architect mode with all modules unlocked
    // TODO: Fetch from Convex when progressive state schema is implemented
    ensureProject(projectId, {
      creationMode: "architect",
      phase: 4,
      unlockedModules: {
        editor: true,
        manifest: true,
        console: true,
        world_graph: true
      },
      totalWritingTimeSec: 0,
      neverAsk: {},
    });

    setActiveProject(projectId);
    hasSyncedRef.current = projectId;

    console.log(
      `[useProgressiveSync] Defaulting to architect mode for ${projectId} (Convex migration pending)`
    );
  }, [projectId, ensureProject, setActiveProject]);
}

export default useProgressiveSync;
