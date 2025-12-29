import { useCallback } from "react";
import {
  createEntity as dbCreateEntity,
  updateEntity as dbUpdateEntity,
  deleteEntity as dbDeleteEntity,
  mapCoreEntityToDbInsert,
  mapCoreEntityToDbFullUpdate,
  mapDbEntityToEntity,
} from "@mythos/db";
import type { Entity } from "@mythos/core";
import type { Database } from "@mythos/db";
import { useMythosStore } from "../stores";
import {
  createPersistenceHook,
  type PersistenceResult,
} from "./usePersistence";

/**
 * Database entity types
 */
type DbEntityRow = Database["public"]["Tables"]["entities"]["Row"];
type DbEntityInsert = Database["public"]["Tables"]["entities"]["Insert"];
type DbEntityUpdate = Database["public"]["Tables"]["entities"]["Update"];

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

/**
 * Internal hook created by the persistence factory
 */
const useEntityPersistenceBase = createPersistenceHook<
  Entity,
  DbEntityInsert,
  DbEntityUpdate,
  DbEntityRow
>(() => {
  // These hooks must be called inside the returned function
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const entities = useMythosStore((state) => state.world.entities);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const addEntity = useMythosStore((state) => state.addEntity);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updateEntity = useMythosStore((state) => state.updateEntity);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const removeEntity = useMythosStore((state) => state.removeEntity);

  return {
    name: "Entity",
    dbCreate: dbCreateEntity,
    dbUpdate: dbUpdateEntity,
    dbDelete: dbDeleteEntity,
    storeAdd: addEntity,
    storeUpdate: updateEntity,
    storeRemove: removeEntity,
    storeGet: (id: string) => entities.get(id),
    mapToDbInsert: mapCoreEntityToDbInsert,
    mapToDbUpdate: mapCoreEntityToDbFullUpdate,
    mapFromDb: mapDbEntityToEntity,
  };
});

/**
 * Hook for entity persistence operations with Supabase
 *
 * Provides CRUD operations that sync between the Supabase database
 * and the local Zustand store. All operations handle errors gracefully
 * and return structured results.
 *
 * This hook is built on top of the generic createPersistenceHook factory
 * but maintains backward compatibility with the original API.
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
  const { create, update, remove, isLoading, error, clearError } =
    useEntityPersistenceBase();

  // Wrap to maintain backward-compatible naming
  const createEntity = useCallback(
    (entity: Entity, projectId: string) => create(entity, projectId),
    [create]
  );

  const updateEntity = useCallback(
    (entityId: string, updates: Partial<Entity>) => update(entityId, updates),
    [update]
  );

  const deleteEntity = useCallback(
    (entityId: string) => remove(entityId),
    [remove]
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
