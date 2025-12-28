import { useCallback, useState } from "react";
import {
  createEntity as dbCreateEntity,
  updateEntity as dbUpdateEntity,
  deleteEntity as dbDeleteEntity,
} from "@mythos/db";
import type { Entity } from "@mythos/core";
import { useMythosStore } from "../stores";
import {
  mapCoreEntityToDbInsert,
  mapCoreEntityToDbFullUpdate,
  mapDbEntityToEntity,
} from "../utils/dbMappers";

/**
 * Result type for entity persistence operations
 */
export interface EntityPersistenceResult<T = void> {
  data: T | null;
  error: string | null;
}

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

/**
 * Hook for entity persistence operations with Supabase
 *
 * Provides CRUD operations that sync between the Supabase database
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

  // Store state and actions
  const entities = useMythosStore((state) => state.world.entities);
  const addEntityToStore = useMythosStore((state) => state.addEntity);
  const updateEntityInStore = useMythosStore((state) => state.updateEntity);
  const removeEntityFromStore = useMythosStore((state) => state.removeEntity);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Create a new entity in the database and add to store
   */
  const createEntity = useCallback(
    async (
      entity: Entity,
      projectId: string
    ): Promise<EntityPersistenceResult<Entity>> => {
      setIsLoading(true);
      setError(null);

      try {
        // Map core entity to DB insert format
        const dbInsert = mapCoreEntityToDbInsert(entity, projectId);

        // Insert into database
        const dbEntity = await dbCreateEntity(dbInsert);

        // Map back to core entity format
        const coreEntity = mapDbEntityToEntity(dbEntity);

        // Add to store
        addEntityToStore(coreEntity);

        return { data: coreEntity, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create entity";
        setError(errorMessage);
        console.error("[useEntityPersistence] Create error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [addEntityToStore]
  );

  /**
   * Update an existing entity in the database and store
   *
   * Merges the updates with the current entity state to ensure
   * all entity data (properties, archetype, etc.) is persisted.
   */
  const updateEntity = useCallback(
    async (
      entityId: string,
      updates: Partial<Entity>
    ): Promise<EntityPersistenceResult<Entity>> => {
      setIsLoading(true);
      setError(null);

      try {
        // Get current entity from store
        const currentEntity = entities.get(entityId);
        if (!currentEntity) {
          throw new Error(`Entity ${entityId} not found in store`);
        }

        // Merge current entity with updates to get complete state
        const mergedEntity: Entity = { ...currentEntity, ...updates };

        // Map complete entity to DB update format (includes properties & archetype)
        const dbUpdate = mapCoreEntityToDbFullUpdate(mergedEntity);

        // Update in database
        const dbEntity = await dbUpdateEntity(entityId, dbUpdate);

        // Map back to core entity format
        const coreEntity = mapDbEntityToEntity(dbEntity);

        // Update in store
        updateEntityInStore(entityId, coreEntity);

        return { data: coreEntity, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update entity";
        setError(errorMessage);
        console.error("[useEntityPersistence] Update error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [entities, updateEntityInStore]
  );

  /**
   * Delete an entity from the database and store
   */
  const deleteEntity = useCallback(
    async (entityId: string): Promise<EntityPersistenceResult<void>> => {
      setIsLoading(true);
      setError(null);

      try {
        // Delete from database
        await dbDeleteEntity(entityId);

        // Remove from store
        removeEntityFromStore(entityId);

        return { data: undefined, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete entity";
        setError(errorMessage);
        console.error("[useEntityPersistence] Delete error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [removeEntityFromStore]
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
