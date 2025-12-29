import { useCallback, useState } from "react";

/**
 * Generic result type for persistence operations
 */
export interface PersistenceResult<T = void> {
  data: T | null;
  error: string | null;
}

/**
 * Configuration for the persistence hook factory
 *
 * @template TEntity - The core entity type (e.g., Entity, Relationship)
 * @template TInsert - The database insert type
 * @template TUpdate - The database update type
 * @template TDbRow - The database row type returned from queries
 */
export interface PersistenceConfig<TEntity, TInsert, TUpdate, TDbRow> {
  /** Name for error logging (e.g., "Entity", "Relationship") */
  name: string;

  // Database operations
  /** Create a new record in the database */
  dbCreate: (data: TInsert) => Promise<TDbRow>;
  /** Update an existing record in the database */
  dbUpdate: (id: string, data: TUpdate) => Promise<TDbRow>;
  /** Delete a record from the database */
  dbDelete: (id: string) => Promise<void>;

  // Store operations
  /** Add entity to the local store */
  storeAdd: (entity: TEntity) => void;
  /** Update entity in the local store */
  storeUpdate: (id: string, updates: Partial<TEntity>) => void;
  /** Remove entity from the local store */
  storeRemove: (id: string) => void;
  /** Get entity from store by ID (for update operations) */
  storeGet: (id: string) => TEntity | undefined;

  // Mappers
  /** Map core entity to database insert format */
  mapToDbInsert: (entity: TEntity, projectId: string) => TInsert;
  /** Map core entity to database update format */
  mapToDbUpdate: (entity: TEntity) => TUpdate;
  /** Map database row back to core entity */
  mapFromDb: (row: TDbRow) => TEntity;
}

/**
 * Base state and utilities returned by the persistence hook
 */
export interface BasePersistenceState {
  /** Whether any operation is currently in progress */
  isLoading: boolean;
  /** Last error message (if any) */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
}

/**
 * Return type for hooks created with createPersistenceHook
 */
export interface UsePersistenceResult<TEntity> extends BasePersistenceState {
  /** Create a new entity in DB and add to store */
  create: (entity: TEntity, projectId: string) => Promise<PersistenceResult<TEntity>>;
  /** Update an existing entity in DB and store */
  update: (id: string, updates: Partial<TEntity>) => Promise<PersistenceResult<TEntity>>;
  /** Delete an entity from DB and store */
  remove: (id: string) => Promise<PersistenceResult<void>>;
}

/**
 * Low-level hook for persistence state management
 *
 * Provides loading/error state and a wrapper function for async operations.
 * Use this when you need custom operation patterns that don't fit the
 * standard CRUD model.
 *
 * @example
 * ```tsx
 * function useCustomPersistence() {
 *   const { isLoading, error, clearError, wrapOperation } = usePersistenceState('Custom');
 *
 *   const customOperation = useCallback(
 *     () => wrapOperation(async () => {
 *       // Your async logic here
 *       const result = await someDbOperation();
 *       return result;
 *     }),
 *     [wrapOperation]
 *   );
 *
 *   return { customOperation, isLoading, error, clearError };
 * }
 * ```
 */
export function usePersistenceState(name: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Wrap an async operation with loading state and error handling
   */
  const wrapOperation = useCallback(
    async <T>(
      operation: () => Promise<T>,
      errorMessage = `Failed to perform ${name} operation`
    ): Promise<PersistenceResult<T>> => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await operation();
        return { data, error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : errorMessage;
        setError(message);
        console.error(`[use${name}Persistence] Error:`, err);
        return { data: null, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [name]
  );

  return {
    isLoading,
    error,
    clearError,
    wrapOperation,
  };
}

/**
 * Factory function to create a typed persistence hook
 *
 * Creates a hook with standardized CRUD operations that sync between
 * the database and local Zustand store. All operations handle errors
 * gracefully and return structured results.
 *
 * @template TEntity - The core entity type
 * @template TInsert - The database insert type
 * @template TUpdate - The database update type
 * @template TDbRow - The database row type
 *
 * @example
 * ```tsx
 * // Create the hook
 * const useEntityPersistence = createPersistenceHook({
 *   name: 'Entity',
 *   dbCreate: createEntity,
 *   dbUpdate: updateEntity,
 *   dbDelete: deleteEntity,
 *   storeAdd: (entity) => store.addEntity(entity),
 *   storeUpdate: (id, updates) => store.updateEntity(id, updates),
 *   storeRemove: (id) => store.removeEntity(id),
 *   storeGet: (id) => store.entities.get(id),
 *   mapToDbInsert: mapCoreEntityToDbInsert,
 *   mapToDbUpdate: mapCoreEntityToDbFullUpdate,
 *   mapFromDb: mapDbEntityToEntity,
 * });
 *
 * // Use in component
 * function MyComponent({ projectId }) {
 *   const { create, update, remove, isLoading, error } = useEntityPersistence();
 *
 *   const handleCreate = async () => {
 *     const result = await create(newEntity, projectId);
 *     if (result.error) {
 *       console.error('Failed:', result.error);
 *     }
 *   };
 * }
 * ```
 */
export function createPersistenceHook<TEntity, TInsert, TUpdate, TDbRow>(
  configFn: () => PersistenceConfig<TEntity, TInsert, TUpdate, TDbRow>
) {
  return function usePersistence(): UsePersistenceResult<TEntity> {
    // Get config (this allows hooks like useMythosStore to be called inside)
    const config = configFn();

    const { isLoading, error, clearError, wrapOperation } = usePersistenceState(config.name);

    /**
     * Create a new entity in the database and add to store
     */
    const create = useCallback(
      async (
        entity: TEntity,
        projectId: string
      ): Promise<PersistenceResult<TEntity>> => {
        return wrapOperation(async () => {
          // Map core entity to DB insert format
          const dbInsert = config.mapToDbInsert(entity, projectId);

          // Insert into database
          const dbRow = await config.dbCreate(dbInsert);

          // Map back to core entity format
          const coreEntity = config.mapFromDb(dbRow);

          // Add to store
          config.storeAdd(coreEntity);

          return coreEntity;
        }, `Failed to create ${config.name.toLowerCase()}`);
      },
      [config, wrapOperation]
    );

    /**
     * Update an existing entity in the database and store
     */
    const update = useCallback(
      async (
        id: string,
        updates: Partial<TEntity>
      ): Promise<PersistenceResult<TEntity>> => {
        return wrapOperation(async () => {
          // Get current entity from store
          const current = config.storeGet(id);
          if (!current) {
            throw new Error(`${config.name} ${id} not found in store`);
          }

          // Merge current entity with updates to get complete state
          const merged = { ...current, ...updates } as TEntity;

          // Map complete entity to DB update format
          const dbUpdate = config.mapToDbUpdate(merged);

          // Update in database
          const dbRow = await config.dbUpdate(id, dbUpdate);

          // Map back to core entity format
          const coreEntity = config.mapFromDb(dbRow);

          // Update in store
          config.storeUpdate(id, coreEntity);

          return coreEntity;
        }, `Failed to update ${config.name.toLowerCase()}`);
      },
      [config, wrapOperation]
    );

    /**
     * Delete an entity from the database and store
     */
    const remove = useCallback(
      async (id: string): Promise<PersistenceResult<void>> => {
        return wrapOperation(async () => {
          // Delete from database
          await config.dbDelete(id);

          // Remove from store
          config.storeRemove(id);
        }, `Failed to delete ${config.name.toLowerCase()}`);
      },
      [config, wrapOperation]
    );

    return {
      create,
      update,
      remove,
      isLoading,
      error,
      clearError,
    };
  };
}
