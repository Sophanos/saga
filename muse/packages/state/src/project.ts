/**
 * Project state store
 * Platform-agnostic project/document state
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { LooseProject, Document, Entity, Relationship } from "@mythos/core";

export interface ProjectState {
  // Current project
  currentProjectId: string | null;
  project: LooseProject | null;

  // Documents
  documents: Document[];
  currentDocumentId: string | null;

  // World state
  entities: Entity[];
  relationships: Relationship[];

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  setProject: (project: LooseProject | null) => void;
  setCurrentProjectId: (id: string | null) => void;
  setDocuments: (documents: Document[]) => void;
  setCurrentDocumentId: (id: string | null) => void;
  setEntities: (entities: Entity[]) => void;
  setRelationships: (relationships: Relationship[]) => void;
  addEntity: (entity: Entity) => void;
  updateEntity: (id: string, updates: Partial<Entity>) => void;
  removeEntity: (id: string) => void;
  addRelationship: (relationship: Relationship) => void;
  removeRelationship: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  currentProjectId: null,
  project: null,
  documents: [],
  currentDocumentId: null,
  entities: [],
  relationships: [],
  isLoading: false,
  error: null,
};

export const useProjectStore = create<ProjectState>()(
  immer((set) => ({
    ...initialState,

    setProject: (project) =>
      set((state) => {
        state.project = project;
        state.currentProjectId = project?.id ?? null;
      }),

    setCurrentProjectId: (id) =>
      set((state) => {
        state.currentProjectId = id;
      }),

    setDocuments: (documents) =>
      set((state) => {
        state.documents = documents;
      }),

    setCurrentDocumentId: (id) =>
      set((state) => {
        state.currentDocumentId = id;
      }),

    setEntities: (entities) =>
      set((state) => {
        state.entities = entities;
      }),

    setRelationships: (relationships) =>
      set((state) => {
        state.relationships = relationships;
      }),

    addEntity: (entity) =>
      set((state) => {
        state.entities.push(entity);
      }),

    updateEntity: (id, updates) =>
      set((state) => {
        const index = state.entities.findIndex((e) => e.id === id);
        if (index !== -1) {
          state.entities[index] = { ...state.entities[index], ...updates };
        }
      }),

    removeEntity: (id) =>
      set((state) => {
        state.entities = state.entities.filter((e) => e.id !== id);
        state.relationships = state.relationships.filter(
          (r) => r.sourceId !== id && r.targetId !== id
        );
      }),

    addRelationship: (relationship) =>
      set((state) => {
        state.relationships.push(relationship);
      }),

    removeRelationship: (id) =>
      set((state) => {
        state.relationships = state.relationships.filter((r) => r.id !== id);
      }),

    setLoading: (isLoading) =>
      set((state) => {
        state.isLoading = isLoading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
      }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const useCurrentProject = () => useProjectStore((s) => s.project);
export const useDocuments = () => useProjectStore((s) => s.documents);
export const useEntities = () => useProjectStore((s) => s.entities);
export const useRelationships = () => useProjectStore((s) => s.relationships);
export const useProjectLoading = () => useProjectStore((s) => s.isLoading);
export const useProjectError = () => useProjectStore((s) => s.error);

// Entity selectors
export const useEntitiesByType = (type: string) =>
  useProjectStore((s) => s.entities.filter((e) => e.type === type));

export const useEntityById = (id: string) =>
  useProjectStore((s) => s.entities.find((e) => e.id === id));
