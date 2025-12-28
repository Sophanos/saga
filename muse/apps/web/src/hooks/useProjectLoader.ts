import { useState, useCallback, useRef, useEffect } from "react";
import { useMythosStore } from "../stores";
import {
  getProject,
  getDocuments,
  getEntities,
} from "@mythos/db";
import type { Database } from "@mythos/db";
import type {
  Project,
  Document,
  Entity,
  Character,
  Location,
  Item,
  MagicSystem,
  Faction,
  PropertyValue,
} from "@mythos/core";

// Database row types
type DbProject = Database["public"]["Tables"]["projects"]["Row"];
type DbDocument = Database["public"]["Tables"]["documents"]["Row"];
type DbEntity = Database["public"]["Tables"]["entities"]["Row"];

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
 * Helper to safely get a property from an object using bracket notation
 */
function getProp<T>(obj: Record<string, unknown> | null | undefined, key: string): T | undefined {
  if (!obj) return undefined;
  return obj[key] as T | undefined;
}

/**
 * Converts a database project row to a core Project type
 */
function mapDbProjectToProject(dbProject: DbProject): Project {
  const styleConfig = dbProject.style_config as Record<string, unknown> | null;

  return {
    id: dbProject.id,
    name: dbProject.name,
    description: dbProject.description ?? undefined,
    config: {
      genre: dbProject.genre as Project["config"]["genre"],
      styleMode: getProp<Project["config"]["styleMode"]>(styleConfig, "styleMode") ?? "manga",
      arcTemplate: getProp<Project["config"]["arcTemplate"]>(styleConfig, "arcTemplate") ?? "three_act",
      linterConfig: (dbProject.linter_config as Project["config"]["linterConfig"]) ?? {},
    },
    createdAt: new Date(dbProject.created_at),
    updatedAt: new Date(dbProject.updated_at),
  };
}

/**
 * Converts a database document row to a core Document type
 */
function mapDbDocumentToDocument(dbDoc: DbDocument): Document {
  return {
    id: dbDoc.id,
    projectId: dbDoc.project_id,
    parentId: dbDoc.parent_id ?? undefined,
    type: dbDoc.type as Document["type"],
    title: dbDoc.title ?? undefined,
    content: dbDoc.content,
    orderIndex: dbDoc.order_index,
    wordCount: dbDoc.word_count,
    createdAt: new Date(dbDoc.created_at),
    updatedAt: new Date(dbDoc.updated_at),
  };
}

/**
 * Converts a database entity row to a core Entity type
 * Reconstructs the specific entity type (Character, Location, etc.) from properties
 */
function mapDbEntityToEntity(dbEntity: DbEntity): Entity {
  const props = dbEntity.properties as Record<string, unknown>;

  const baseEntity: Entity = {
    id: dbEntity.id,
    name: dbEntity.name,
    aliases: dbEntity.aliases ?? [],
    type: dbEntity.type as Entity["type"],
    properties: dbEntity.properties as Record<string, PropertyValue>,
    mentions: [], // Mentions would need to be loaded separately
    createdAt: new Date(dbEntity.created_at),
    updatedAt: new Date(dbEntity.updated_at),
    notes: getProp<string>(props, "notes"),
  };

  switch (dbEntity.type) {
    case "character": {
      const character: Character = {
        ...baseEntity,
        type: "character",
        archetype: dbEntity.archetype as Character["archetype"],
        traits: getProp<Character["traits"]>(props, "traits") ?? [],
        status: getProp<Character["status"]>(props, "status") ?? {},
        visualDescription: getProp<Character["visualDescription"]>(props, "visualDescription") ?? {},
        backstory: getProp<string>(props, "backstory"),
        goals: getProp<string[]>(props, "goals"),
        fears: getProp<string[]>(props, "fears"),
        voiceNotes: getProp<string>(props, "voiceNotes"),
      };
      return character;
    }

    case "location": {
      const location: Location = {
        ...baseEntity,
        type: "location",
        parentLocation: getProp<string>(props, "parentLocation"),
        climate: getProp<string>(props, "climate"),
        atmosphere: getProp<string>(props, "atmosphere"),
        inhabitants: getProp<string[]>(props, "inhabitants"),
        connectedTo: getProp<string[]>(props, "connectedTo"),
      };
      return location;
    }

    case "item": {
      const item: Item = {
        ...baseEntity,
        type: "item",
        category: getProp<Item["category"]>(props, "category") ?? "other",
        rarity: getProp<Item["rarity"]>(props, "rarity"),
        owner: getProp<string>(props, "owner"),
        location: getProp<string>(props, "location"),
        abilities: getProp<string[]>(props, "abilities"),
      };
      return item;
    }

    case "magic_system": {
      const magicSystem: MagicSystem = {
        ...baseEntity,
        type: "magic_system",
        rules: getProp<string[]>(props, "rules") ?? [],
        limitations: getProp<string[]>(props, "limitations") ?? [],
        costs: getProp<string[]>(props, "costs"),
        users: getProp<string[]>(props, "users"),
        spells: getProp<MagicSystem["spells"]>(props, "spells"),
      };
      return magicSystem;
    }

    case "faction": {
      const faction: Faction = {
        ...baseEntity,
        type: "faction",
        leader: getProp<string>(props, "leader"),
        members: getProp<string[]>(props, "members"),
        headquarters: getProp<string>(props, "headquarters"),
        goals: getProp<string[]>(props, "goals"),
        rivals: getProp<string[]>(props, "rivals"),
        allies: getProp<string[]>(props, "allies"),
      };
      return faction;
    }

    default:
      return baseEntity;
  }
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
  const addEntity = useMythosStore((state) => state.addEntity);
  const addDocument = useMythosStore((state) => state.addDocument);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);

  // Get current project from store
  const currentProject = useMythosStore((state) => state.project.currentProject);

  /**
   * Clear the current project state
   */
  const clearProjectState = useCallback(() => {
    setCurrentProject(null);
    setCurrentDocument(null);
    // Note: We don't clear entities/documents here as they may be needed
    // for reference during project switching. A full clear would require
    // additional store actions.
  }, [setCurrentProject, setCurrentDocument]);

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

      try {
        // Load project metadata
        const dbProject = await getProject(id);
        if (!dbProject) {
          throw new Error(`Project not found: ${id}`);
        }

        const project = mapDbProjectToProject(dbProject);

        // Load documents and entities in parallel
        const [dbDocuments, dbEntities] = await Promise.all([
          getDocuments(id),
          getEntities(id),
        ]);

        // Convert database types to core types
        const documents = dbDocuments.map(mapDbDocumentToDocument);
        const entities = dbEntities.map(mapDbEntityToEntity);

        // Hydrate the store with project
        setCurrentProject(project);

        // Add all documents to store
        documents.forEach((doc) => {
          addDocument(doc);
        });

        // Set the first document as current if available
        if (documents.length > 0) {
          const firstDoc = documents.find((d) => d.parentId === undefined) ?? documents[0];
          setCurrentDocument(firstDoc);
        }

        // Add all entities to store
        entities.forEach((entity) => {
          addEntity(entity);
        });

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
      setCurrentProject,
      addDocument,
      setCurrentDocument,
      addEntity,
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
