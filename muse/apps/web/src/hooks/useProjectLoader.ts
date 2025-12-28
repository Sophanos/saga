import { useState, useCallback, useRef, useEffect } from "react";
import { useMythosStore } from "../stores";
import {
  getProject,
  getDocuments,
  getEntities,
  getRelationships,
} from "@mythos/db";
import type { Project } from "@mythos/core";
import {
  mapDbProjectToProject,
  mapDbDocumentToDocument,
  mapDbEntityToEntity,
  mapDbRelationshipToRelationship,
} from "../utils/dbMappers";


/**
 * Options for the useProjectLoader hook
 */
export interface UseProjectLoaderOptions {
  /** Project ID to load. If null, no project will be loaded automatically. */
  projectId: string | null;
  /** Whether to automatically load the project on mount. Defaults to true. */
  autoLoad?: boolean;
}

/**
 * Result returned by the useProjectLoader hook
 */
export interface UseProjectLoaderResult {
  /** Whether the project is currently being loaded */
  isLoading: boolean;
  /** Error message if loading failed, null otherwise */
  error: string | null;
  /** The loaded project, null if not loaded yet */
  project: Project | null;
  /** Manually load a project by ID */
  loadProject: (id: string) => Promise<void>;
  /** Reload the current project */
  reloadProject: () => Promise<void>;
}


/**
 * Hook for initializing the application with project data.
 *
 * Loads project metadata, documents, and entities from the database
 * and hydrates the Zustand stores with the loaded data.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isLoading, error, project, loadProject } = useProjectLoader({
 *     projectId: "project-123",
 *     autoLoad: true,
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (error) return <ErrorDisplay message={error} />;
 *   if (!project) return <ProjectSelector onSelect={loadProject} />;
 *
 *   return <Editor project={project} />;
 * }
 * ```
 */
export function useProjectLoader(
  options: UseProjectLoaderOptions
): UseProjectLoaderResult {
  const { projectId, autoLoad = true } = options;

  // Local state for loading/error
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store the currently loaded project ID to handle reloading
  const loadedProjectIdRef = useRef<string | null>(null);

  // Store actions
  const setCurrentProject = useMythosStore((state) => state.setCurrentProject);
  const setProjectLoading = useMythosStore((state) => state.setProjectLoading);
  const setProjectError = useMythosStore((state) => state.setProjectError);
  const setDocuments = useMythosStore((state) => state.setDocuments);
  const setEntities = useMythosStore((state) => state.setEntities);
  const setRelationships = useMythosStore((state) => state.setRelationships);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);
  const resetForProjectSwitch = useMythosStore((state) => state.resetForProjectSwitch);

  // Get current project from store
  const currentProject = useMythosStore((state) => state.project.currentProject);

  /**
   * Clear the current project state
   */
  const clearProjectState = useCallback(() => {
    setCurrentProject(null);
    resetForProjectSwitch();
  }, [setCurrentProject, resetForProjectSwitch]);

  /**
   * Load a project by ID and hydrate the stores
   */
  const loadProject = useCallback(
    async (id: string): Promise<void> => {
      if (!id) {
        setError("Project ID is required");
        return;
      }

      setIsLoading(true);
      setError(null);
      setProjectLoading(true);
      setProjectError(null);

      // Clear old state before loading new project data
      resetForProjectSwitch();

      try {
        // Load project metadata
        const dbProject = await getProject(id);
        if (!dbProject) {
          throw new Error(`Project not found: ${id}`);
        }

        const project = mapDbProjectToProject(dbProject);

        // Load documents, entities, and relationships in parallel
        const [dbDocuments, dbEntities, dbRelationships] = await Promise.all([
          getDocuments(id),
          getEntities(id),
          getRelationships(id),
        ]);

        // Convert database types to core types and batch update stores
        const documents = dbDocuments.map(mapDbDocumentToDocument);
        const entities = dbEntities.map(mapDbEntityToEntity);
        const relationships = dbRelationships.map(mapDbRelationshipToRelationship);

        // Hydrate the store with project
        setCurrentProject(project);

        // Batch set all documents
        setDocuments(documents);

        // Set the first document as current if available
        if (documents.length > 0) {
          const firstDoc = documents.find((d) => d.parentId === undefined) ?? documents[0];
          setCurrentDocument(firstDoc);
        }

        // Batch set all entities
        setEntities(entities);

        // Batch set all relationships
        setRelationships(relationships);

        // Track the loaded project ID for reloading
        loadedProjectIdRef.current = id;

        setProjectLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load project";
        setError(errorMessage);
        setProjectError(errorMessage);
        setProjectLoading(false);
        clearProjectState();
      } finally {
        setIsLoading(false);
      }
    },
    [
      setProjectLoading,
      setProjectError,
      resetForProjectSwitch,
      setCurrentProject,
      setDocuments,
      setCurrentDocument,
      setEntities,
      setRelationships,
      clearProjectState,
    ]
  );

  /**
   * Reload the current project
   */
  const reloadProject = useCallback(async (): Promise<void> => {
    const idToReload = loadedProjectIdRef.current ?? projectId;
    if (!idToReload) {
      setError("No project to reload");
      return;
    }

    // Clear current state before reloading
    clearProjectState();

    await loadProject(idToReload);
  }, [projectId, loadProject, clearProjectState]);

  // Auto-load project on mount or when projectId changes
  useEffect(() => {
    if (autoLoad && projectId && projectId !== loadedProjectIdRef.current) {
      loadProject(projectId);
    }
  }, [autoLoad, projectId, loadProject]);

  return {
    isLoading,
    error,
    project: currentProject,
    loadProject,
    reloadProject,
  };
}

export default useProjectLoader;
