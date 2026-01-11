import { useState, useCallback, useRef, useEffect } from "react";
import { useConvex } from "convex/react";
import { useProgressiveStore } from "@mythos/state";
import {
  mapConvexProjectToCoreProject,
  type ConvexProjectLike,
  type Document,
  type Entity,
  type Relationship,
  type LooseProject,
} from "@mythos/core";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { LAST_DOCUMENT_KEY } from "../constants/storageKeys";
import { useMythosStore } from "../stores";

const EMPTY_TIPTAP_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const ENTITY_LIST_LIMIT = 10000;

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

function mapConvexDocumentToDocument(document: ConvexDocument): Document {
  return {
    id: document._id,
    projectId: document.projectId,
    parentId: document.parentId ?? undefined,
    type: document.type,
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

export interface UseProjectLoaderOptions {
  projectId: string | null;
  autoLoad?: boolean;
}

export interface UseProjectLoaderResult {
  isLoading: boolean;
  error: string | null;
  project: LooseProject | null;
  loadProject: (id: string) => Promise<void>;
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

export function useProjectLoader(
  options: UseProjectLoaderOptions
): UseProjectLoaderResult {
  const { projectId, autoLoad = true } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadedProjectIdRef = useRef<string | null>(null);
  const convex = useConvex();

  const setCurrentProject = useMythosStore((state) => state.setCurrentProject);
  const setProjectLoading = useMythosStore((state) => state.setProjectLoading);
  const setProjectError = useMythosStore((state) => state.setProjectError);
  const setDocuments = useMythosStore((state) => state.setDocuments);
  const setEntities = useMythosStore((state) => state.setEntities);
  const setRelationships = useMythosStore((state) => state.setRelationships);
  const setCurrentDocument = useMythosStore((state) => state.setCurrentDocument);
  const resetForProjectSwitch = useMythosStore((state) => state.resetForProjectSwitch);

  const currentProject = useMythosStore((state) => state.project.currentProject);

  const clearProjectState = useCallback(() => {
    setCurrentProject(null);
    resetForProjectSwitch();
  }, [setCurrentProject, resetForProjectSwitch]);

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

      resetForProjectSwitch();

      try {
        const dbProject = await convex.query(api.projects.get, {
          id: id as Id<"projects">,
        });
        if (!dbProject) {
          throw new Error(`Project not found: ${id}`);
        }

        // Use shared mapper from @mythos/core
        const project = mapConvexProjectToCoreProject(dbProject as ConvexProjectLike);

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

        const documents = (dbDocuments ?? []).map((doc: ConvexDocument) =>
          mapConvexDocumentToDocument(doc)
        );
        const entities = (dbEntities ?? []).map((entity: ConvexEntity) =>
          mapConvexEntityToEntity(entity)
        );
        const relationships = (dbRelationships ?? []).map((relationship: ConvexRelationship) =>
          mapConvexRelationshipToRelationship(relationship)
        );

        setCurrentProject(project);

        setDocuments(documents);

        const preferredDoc = selectInitialDocument(documents);
        if (preferredDoc) {
          setCurrentDocument(preferredDoc);
        }

        setEntities(entities);

        setRelationships(relationships);

        loadedProjectIdRef.current = id;

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

  const reloadProject = useCallback(async (): Promise<void> => {
    const idToReload = loadedProjectIdRef.current ?? projectId;
    if (!idToReload) {
      setError("No project to reload");
      return;
    }

    clearProjectState();

    await loadProject(idToReload);
  }, [projectId, loadProject, clearProjectState]);

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
