/**
 * useProjectSelection hook for React Native
 *
 * Persists the last selected project ID for automatic restoration
 * on app restart. Uses AsyncStorage via @mythos/storage.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { nativeStorage } from "@mythos/storage";
import { useProjectStore } from "@mythos/state";

/**
 * Storage key for persisting project selection
 */
const PROJECT_SELECTION_KEY = "last_selected_project";

/**
 * Result returned by the useProjectSelection hook
 */
export interface UseProjectSelectionResult {
  /**
   * The currently selected project ID
   */
  selectedProjectId: string | null;
  /**
   * Whether the persisted selection has been loaded
   */
  isLoaded: boolean;
  /**
   * Select a project and persist the selection
   */
  selectProject: (projectId: string | null) => Promise<void>;
  /**
   * Clear the persisted selection
   */
  clearSelection: () => Promise<void>;
}

/**
 * Hook to persist and restore project selection
 *
 * @returns Project selection state and actions
 *
 * @example
 * ```tsx
 * function ProjectList() {
 *   const { selectedProjectId, selectProject, isLoaded } = useProjectSelection();
 *
 *   if (!isLoaded) return <Loading />;
 *
 *   return (
 *     <FlatList
 *       data={projects}
 *       renderItem={({ item }) => (
 *         <ProjectItem
 *           project={item}
 *           isSelected={item.id === selectedProjectId}
 *           onPress={() => selectProject(item.id)}
 *         />
 *       )}
 *     />
 *   );
 * }
 * ```
 */
export function useProjectSelection(): UseProjectSelectionResult {
  const [isLoaded, setIsLoaded] = useState(false);
  const hasRestoredRef = useRef(false);

  // Get current project from store
  const currentProjectId = useProjectStore((s) => s.project?.id ?? null);
  const setCurrentProjectId = useProjectStore((s) => s.setCurrentProjectId);

  /**
   * Load persisted project ID on mount
   */
  useEffect(() => {
    let mounted = true;

    const loadPersistedSelection = async () => {
      // Only restore once
      if (hasRestoredRef.current) return;

      try {
        const persistedId = await nativeStorage.getItem(PROJECT_SELECTION_KEY);

        if (!mounted) return;

        if (persistedId) {
          console.log("[useProjectSelection] Restored project:", persistedId);
          setCurrentProjectId(persistedId);
        }

        hasRestoredRef.current = true;
      } catch (error) {
        console.warn("[useProjectSelection] Failed to load persisted selection:", error);
      } finally {
        if (mounted) {
          setIsLoaded(true);
        }
      }
    };

    loadPersistedSelection();

    return () => {
      mounted = false;
    };
  }, [setCurrentProjectId]);

  /**
   * Persist project ID when it changes (after initial load)
   */
  useEffect(() => {
    // Don't persist until we've loaded (to avoid overwriting with null)
    if (!isLoaded) return;

    const persistSelection = async () => {
      try {
        if (currentProjectId) {
          await nativeStorage.setItem(PROJECT_SELECTION_KEY, currentProjectId);
          console.log("[useProjectSelection] Persisted project:", currentProjectId);
        } else {
          // Don't clear on null - keep last selection for restoration
        }
      } catch (error) {
        console.warn("[useProjectSelection] Failed to persist selection:", error);
      }
    };

    persistSelection();
  }, [currentProjectId, isLoaded]);

  /**
   * Select a project and update the store
   */
  const selectProject = useCallback(
    async (projectId: string | null): Promise<void> => {
      try {
        // Update store
        setCurrentProjectId(projectId);

        // Persist selection
        if (projectId) {
          await nativeStorage.setItem(PROJECT_SELECTION_KEY, projectId);
        }
      } catch (error) {
        console.warn("[useProjectSelection] Failed to select project:", error);
      }
    },
    [setCurrentProjectId]
  );

  /**
   * Clear the persisted selection
   */
  const clearSelection = useCallback(async (): Promise<void> => {
    try {
      await nativeStorage.removeItem(PROJECT_SELECTION_KEY);
      setCurrentProjectId(null);
    } catch (error) {
      console.warn("[useProjectSelection] Failed to clear selection:", error);
    }
  }, [setCurrentProjectId]);

  return {
    selectedProjectId: currentProjectId,
    isLoaded,
    selectProject,
    clearSelection,
  };
}

export default useProjectSelection;
