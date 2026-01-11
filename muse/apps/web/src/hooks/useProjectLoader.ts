import { useState, useCallback, useRef, useEffect } from "react";
import { useConvex } from "convex/react";
import { useProgressiveStore } from "@mythos/state";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Project, Document, Entity, Relationship } from "@mythos/core";
import { LAST_DOCUMENT_KEY } from "../constants/storageKeys";
import { useMythosStore } from "../stores";

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const ENTITY_LIST_LIMIT = 10000;

type ConvexProject = {
  _id: Id<"projects">;
  name: string;
  description?: string | null;
  genre?: string | null;
  styleConfig?: Record<string, unknown> | null;
  linterConfig?: Record<string, unknown> | null;
  templateId?: string | null;
  templateOverrides?: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
};

type ConvexDocument = {
  _id: Id<"documents">;
  projectId: Id<"projects">;
  parentId?: Id<"documents"> | null;
  type: string;
  title?: string | null;
  content?: Record<string, unknown> | null;
  orderIndex: number;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
};

type ConvexEntity = {
  _id: Id<"entities">;
  projectId: Id<"projects">;
  type: string;
  name: string;
  aliases: string[];
  properties: Record<string, unknown>;
  notes?: string | null;
  portraitUrl?: string | null;
  portraitAssetId?: string | null;
  createdAt: number;
  updatedAt: number;
};

type ConvexRelationship = {
  _id: Id<"relationships">;
  sourceId: Id<"entities">;
  targetId: Id<"entities">;
  type: string;
  bidirectional: boolean;
  strength?: number | null;
  metadata?: Record<string, unknown> | null;
  notes?: string | null;
  createdAt: number;
};

function mapConvexProjectToProject(project: ConvexProject): Project {
  const styleConfig =
    project.styleConfig && typeof project.styleConfig === "object"
      ? (project.styleConfig as Project["config"])
      : ({} as Project["config"]);

  const config = {
    ...styleConfig,
    ...(project.genre ? { genre: project.genre as Project["config"]["genre"] } : {}),
    ...(project.linterConfig ? { linterConfig: project.linterConfig as Project["config"]["linterConfig"] } : {}),
  };

  return {
    id: project._id,
    name: project.name,
    description: project.description ?? undefined,
    templateId: project.templateId as Project["templateId"],
    templateOverrides: project.templateOverrides as Project["templateOverrides"] | undefined,
    config,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
  };
}

function mapConvexDocumentToDocument(document: ConvexDocument): Document {
  return {
    id: document._id,
    projectId: document.projectId,
    parentId: document.parentId ?? undefined,
    type: document.type as Document["type"],
    title: document.title ?? undefined,
    content: document.content ?? EMPTY_TIPTAP_DOC,
    orderIndex: document.orderIndex ?? 0,
    wordCount: document.wordCount ?? 0,
    createdAt: new Date(document.createdAt),
    updatedAt: new Date(document.updatedAt),
  };
}

function mapConvexEntityToEntity(entity: ConvexEntity): Entity {
  return {
    id: entity._id,
    name: entity.name,
    aliases: entity.aliases ?? [],
    type: entity.type as Entity["type"],
    properties: (entity.properties ?? {}) as Entity["properties"],
    mentions: [],
    createdAt: new Date(entity.createdAt),
    updatedAt: new Date(entity.updatedAt),
    notes: entity.notes ?? undefined,
    portraitUrl: entity.portraitUrl ?? undefined,
    portraitAssetId: entity.portraitAssetId ?? undefined,
    projectId: entity.projectId,
  } as Entity & { projectId?: string };
}

function mapConvexRelationshipToRelationship(relationship: ConvexRelationship): Relationship {
  return {
    id: relationship._id,
    sourceId: relationship.sourceId,
    targetId: relationship.targetId,
    type: relationship.type as Relationship["type"],
    bidirectional: relationship.bidirectional,
    strength: relationship.strength ?? undefined,
    metadata: relationship.metadata as Relationship["metadata"],
    notes: relationship.notes ?? undefined,
    createdAt: new Date(relationship.createdAt),
  };
}

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

function readLastDocumentId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(LAST_DOCUMENT_KEY);
}

function selectInitialDocument(documents: Document[]): Document | null {
  if (documents.length === 0) {
    return null;
  }

  const lastDocumentId = readLastDocumentId();
  if (lastDocumentId) {
    const match = documents.find((doc) => doc.id === lastDocumentId);
    if (match) {
      return match;
    }
  }

  const topLevel = documents.find((doc) => doc.parentId === undefined);
  return topLevel ?? documents[0];
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
  const convex = useConvex();

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
        const dbProject = await convex.query(api.projects.get, {
          id: id as Id<"projects">,
        });
        if (!dbProject) {
          throw new Error(`Project not found: ${id}`);
        }

        const project = mapConvexProjectToProject(dbProject as ConvexProject);

        // Load documents, entities, and relationships in parallel
        const [dbDocuments, dbEntities, dbRelationships] = await Promise.all([
          convex.query(api.documents.list, {
            projectId: id as Id<"projects">,
          }),
          convex.query(api.entities.list, {
            projectId: id as Id<"projects">,
            limit: ENTITY_LIST_LIMIT,
          }),
          convex.query(api.relationships.list, {
            projectId: id as Id<"projects">,
          }),
        ]);

        // Convert database types to core types and batch update stores
        const documents = (dbDocuments ?? []).map((doc: ConvexDocument) =>
          mapConvexDocumentToDocument(doc)
        );
        const entities = (dbEntities ?? []).map((entity: ConvexEntity) =>
          mapConvexEntityToEntity(entity)
        );
        const relationships = (dbRelationships ?? []).map((relationship: ConvexRelationship) =>
          mapConvexRelationshipToRelationship(relationship)
        );

        // Hydrate the store with project
        setCurrentProject(project);

        // Batch set all documents
        setDocuments(documents);

        // Set the preferred document as current if available
        const preferredDoc = selectInitialDocument(documents);
        if (preferredDoc) {
          setCurrentDocument(preferredDoc);
        }

        // Batch set all entities
        setEntities(entities);

        // Batch set all relationships
        setRelationships(relationships);

        // Track the loaded project ID for reloading
        loadedProjectIdRef.current = id;

        // Initialize progressive state for this project
        // For legacy projects without progressive state, default to architect mode (full features)
        const progressive = useProgressiveStore.getState();
        progressive.setActiveProject(id);
        progressive.ensureProject(id, {
          creationMode: "architect",
          phase: 4,
          entityMentionCounts: {},
          unlockedModules: { editor: true, manifest: true, console: true, project_graph: true },
          totalWritingTimeSec: 0,
          neverAsk: {},
        });

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
      convex,
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
