/**
 * useProgressiveSync
 * 
 * Syncs progressive state from database on mobile.
 * Loads project progressive state when a project is selected.
 */

import { useEffect, useRef } from "react";
import { useProgressiveStore } from "@mythos/state";
import { getMobileSupabase } from "./supabase";

// ============================================================================
// Types
// ============================================================================

interface DbProgressiveProjectState {
  id: string;
  project_id: string;
  user_id: string;
  creation_mode: "architect" | "gardener" | "hybrid";
  phase: number;
  unlocked_modules: Record<string, boolean>;
  total_writing_time_sec: number;
  last_entity_nudge_word_count: number | null;
  never_ask: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Sync progressive state from database for a project
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

    const loadProgressiveState = async () => {
      try {
        const supabase = getMobileSupabase();
        
        // Fetch progressive state from database
        const { data, error } = await supabase
          .from("project_progressive_state" as never)
          .select("*")
          .eq("project_id", projectId)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 = no rows found, which is OK
          console.error("[useProgressiveSync] Failed to load state:", error);
          return;
        }

        if (data) {
          // Found existing state - restore it
          const dbState = data as DbProgressiveProjectState;
          
          ensureProject(projectId, {
            creationMode: dbState.creation_mode,
            phase: dbState.phase as 1 | 2 | 3 | 4,
            unlockedModules: dbState.unlocked_modules as Record<string, true>,
            totalWritingTimeSec: dbState.total_writing_time_sec,
            neverAsk: dbState.never_ask as Record<string, true>,
            lastEntityNudgeAtWordCount: dbState.last_entity_nudge_word_count ?? undefined,
          });
          
          console.log(
            `[useProgressiveSync] Loaded state for project ${projectId}: ` +
            `mode=${dbState.creation_mode}, phase=${dbState.phase}`
          );
        } else {
          // No existing state - default to architect mode (existing projects)
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
          
          console.log(
            `[useProgressiveSync] No existing state for ${projectId}, defaulting to architect mode`
          );
        }

        setActiveProject(projectId);
        hasSyncedRef.current = projectId;
      } catch (error) {
        console.error("[useProgressiveSync] Failed to sync:", error);
        
        // On error, still set up default state so app doesn't break
        ensureProject(projectId, {
          creationMode: "architect",
          phase: 4,
          unlockedModules: { 
            editor: true, 
            manifest: true, 
            console: true, 
            world_graph: true 
          },
        });
        setActiveProject(projectId);
      }
    };

    loadProgressiveState();
  }, [projectId, ensureProject, setActiveProject]);
}

export default useProgressiveSync;
