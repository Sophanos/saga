import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Entity, PropertyValue } from "@mythos/core";
import { useMythosStore } from "../stores";
import type { PersistenceResult } from "./usePersistence";
import { deleteVectorsViaEdge } from "../services/ai";
import { formatGraphErrorMessage } from "../utils";


/**
 * Result type for entity persistence operations
 * @deprecated Use PersistenceResult<T> from usePersistence instead
 */
export type EntityPersistenceResult<T = void> = PersistenceResult<T>;

/**
 * Return type for the useEntityPersistence hook
 */
export interface UseEntityPersistenceResult {
  /** Create a new entity in DB and add to store */
  createEntity: (
    entity: Entity,
    projectId: string
  ) => Promise<EntityPersistenceResult<Entity>>;
  /** Update an existing entity in DB and store */
  updateEntity: (
    entityId: string,
    updates: Partial<Entity>
  ) => Promise<EntityPersistenceResult<Entity>>;
  /** Delete an entity from DB and store */
  deleteEntity: (entityId: string) => Promise<EntityPersistenceResult<void>>;
  /** Whether any operation is currently in progress */
  isLoading: boolean;
  /** Last error message (if any) */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
}

function pickEntityMutationUpdates(updates: Partial<Entity>): {
  name?: string;
  aliases?: string[];
  properties?: Record<string, PropertyValue>;
  notes?: string;
  portraitUrl?: string;
} {
  return {
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.aliases !== undefined ? { aliases: updates.aliases } : {}),
    ...(updates.properties !== undefined
      ? { properties: updates.properties as Record<string, PropertyValue> }
      : {}),
    ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
    ...(updates.portraitUrl !== undefined ? { portraitUrl: updates.portraitUrl } : {}),
  };
}

/**
 * Hook for entity persistence operations with Convex
 *
 * Provides CRUD operations that sync between the Convex database
 * and the local Zustand store. All operations handle errors gracefully
 * and return structured results.
 *
 * @example
 * ```tsx
 * const { createEntity, updateEntity, deleteEntity, isLoading, error } = useEntityPersistence();
 *
 * // Create a new character
 * const result = await createEntity(newCharacter, projectId);
 * if (result.error) {
 *   console.error('Failed to create:', result.error);
 * }
 *
 * // Update an entity
 * await updateEntity(entityId, { name: 'New Name' });
 *
 * // Delete an entity
 * await deleteEntity(entityId);
 * ```
 */
export function useEntityPersistence(): UseEntityPersistenceResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex mutations
  const createEntityMutation = useMutation(api.entities.create);
  const updateEntityMutation = useMutation(api.entities.update);
  const deleteEntityMutation = useMutation(api.entities.remove);

  // Store actions
  const addEntity = useMythosStore((state) => state.addEntity);
  const updateEntityStore = useMythosStore((state) => state.updateEntity);
  const removeEntity = useMythosStore((state) => state.removeEntity);

  const clearError = useCallback(() => setError(null), []);


  const createEntity = useCallback(
    async (entity: Entity, projectId: string): Promise<EntityPersistenceResult<Entity>> => {
      setIsLoading(true);
      setError(null);

      try {
        const now = new Date();
        const result = await createEntityMutation({
          projectId: projectId as Id<"projects">,
          type: entity.type,
          name: entity.name,
          aliases: entity.aliases,
          properties: entity.properties as Record<string, PropertyValue>,
          notes: (entity as unknown as Record<string, unknown>)["notes"] as string | undefined,
        });

        // Map Convex result to Entity type
        const createdEntity: Entity & { projectId?: string } = {
          id: result,
          type: entity.type,
          name: entity.name,
          aliases: entity.aliases || [],
          properties: entity.properties || {},
          notes: entity.notes,
          portraitUrl: entity.portraitUrl,
          portraitAssetId: entity.portraitAssetId,
          mentions: entity.mentions ?? [],
          createdAt: now,
          updatedAt: now,
          projectId,
        };

        // Add to store
        addEntity(createdEntity);

        return { data: createdEntity };
      } catch (err) {
        const message = formatGraphErrorMessage(err, "Failed to create entity");
        setError(message);
        return { error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [createEntityMutation, addEntity]
  );

  const updateEntity = useCallback(
    async (entityId: string, updates: Partial<Entity>): Promise<EntityPersistenceResult<Entity>> => {
      setIsLoading(true);
      setError(null);

      try {
        const now = new Date();
        const mutationUpdates = pickEntityMutationUpdates(updates);
        await updateEntityMutation({
          id: entityId as Id<"entities">,
          ...mutationUpdates,
        });

        // Get the updated entity from store and merge with updates
        const entities = useMythosStore.getState().world.entities;
        const existingEntity = entities.get(entityId);

        if (!existingEntity) {
          throw new Error("Entity not found in store");
        }

        const updatedEntity: Entity = {
          ...existingEntity,
          ...updates,
          updatedAt: now,
        };

        // Update store
        updateEntityStore(entityId, { ...updates, updatedAt: now });

        return { data: updatedEntity };
      } catch (err) {
        const message = formatGraphErrorMessage(err, "Failed to update entity");
        setError(message);
        return { error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [updateEntityMutation, updateEntityStore]
  );

  const deleteEntity = useCallback(
    async (entityId: string): Promise<EntityPersistenceResult<void>> => {
      setIsLoading(true);
      setError(null);

      try {
        const existingEntity = useMythosStore.getState().world.entities.get(entityId);
        const projectId = (existingEntity as Entity & { projectId?: string } | undefined)
          ?.projectId;

        await deleteEntityMutation({
          id: entityId as Id<"entities">,
        });

        // Remove from store
        removeEntity(entityId);

        // Delete vector from Qdrant (fire-and-forget)
        if (projectId) {
          void deleteVectorsViaEdge({
            projectId,
            type: "entity",
            targetId: entityId,
          });
        }

        return {};
      } catch (err) {
        const message = formatGraphErrorMessage(err, "Failed to delete entity");
        setError(message);
        return { error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [deleteEntityMutation, removeEntity]
  );

  return {
    createEntity,
    updateEntity,
    deleteEntity,
    isLoading,
    error,
    clearError,
  };
}
