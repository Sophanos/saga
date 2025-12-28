import { useCallback, useState } from "react";
import {
  createRelationship as dbCreateRelationship,
  updateRelationship as dbUpdateRelationship,
  deleteRelationship as dbDeleteRelationship,
  getRelationshipsByEntity as dbGetRelationshipsByEntity,
} from "@mythos/db";
import type { Relationship } from "@mythos/core";
import { useMythosStore } from "../stores";
import {
  mapCoreRelationshipToDbInsert,
  mapCoreRelationshipToDbFullUpdate,
  mapDbRelationshipToRelationship,
} from "../utils/dbMappers";

/**
 * Result type for relationship persistence operations
 */
export interface RelationshipPersistenceResult<T = void> {
  data: T | null;
  error: string | null;
}

/**
 * Return type for the useRelationshipPersistence hook
 */
export interface UseRelationshipPersistenceResult {
  /** Create a new relationship in DB and add to store */
  createRelationship: (
    relationship: Relationship,
    projectId: string
  ) => Promise<RelationshipPersistenceResult<Relationship>>;
  /** Update an existing relationship in DB and store */
  updateRelationship: (
    relationshipId: string,
    updates: Partial<Relationship>
  ) => Promise<RelationshipPersistenceResult<Relationship>>;
  /** Delete a relationship from DB and store */
  deleteRelationship: (
    relationshipId: string
  ) => Promise<RelationshipPersistenceResult<void>>;
  /** Fetch relationships for a specific entity and add to store */
  fetchRelationshipsByEntity: (
    projectId: string,
    entityId: string
  ) => Promise<RelationshipPersistenceResult<Relationship[]>>;
  /** Whether any operation is currently in progress */
  isLoading: boolean;
  /** Last error message (if any) */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
}

/**
 * Hook for relationship persistence operations with Supabase
 *
 * Provides CRUD operations that sync between the Supabase database
 * and the local Zustand store. All operations handle errors gracefully
 * and return structured results.
 *
 * @example
 * ```tsx
 * const { createRelationship, updateRelationship, deleteRelationship, isLoading, error } = useRelationshipPersistence();
 *
 * // Create a new relationship
 * const result = await createRelationship(newRelationship, projectId);
 * if (result.error) {
 *   console.error('Failed to create:', result.error);
 * }
 *
 * // Update a relationship
 * await updateRelationship(relationshipId, { strength: 8 });
 *
 * // Delete a relationship
 * await deleteRelationship(relationshipId);
 * ```
 */
export function useRelationshipPersistence(): UseRelationshipPersistenceResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store state and actions
  const relationships = useMythosStore((state) => state.world.relationships);
  const addRelationshipToStore = useMythosStore(
    (state) => state.addRelationship
  );
  const updateRelationshipInStore = useMythosStore(
    (state) => state.updateRelationship
  );
  const removeRelationshipFromStore = useMythosStore(
    (state) => state.removeRelationship
  );

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Create a new relationship in the database and add to store
   */
  const createRelationship = useCallback(
    async (
      relationship: Relationship,
      projectId: string
    ): Promise<RelationshipPersistenceResult<Relationship>> => {
      setIsLoading(true);
      setError(null);

      try {
        // Map core relationship to DB insert format
        const dbInsert = mapCoreRelationshipToDbInsert(relationship, projectId);

        // Insert into database
        const dbRelationship = await dbCreateRelationship(dbInsert);

        // Map back to core relationship format
        const coreRelationship = mapDbRelationshipToRelationship(dbRelationship);

        // Add to store
        addRelationshipToStore(coreRelationship);

        return { data: coreRelationship, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create relationship";
        setError(errorMessage);
        console.error("[useRelationshipPersistence] Create error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [addRelationshipToStore]
  );

  /**
   * Update an existing relationship in the database and store
   *
   * Merges the updates with the current relationship state to ensure
   * all relationship data is persisted.
   */
  const updateRelationship = useCallback(
    async (
      relationshipId: string,
      updates: Partial<Relationship>
    ): Promise<RelationshipPersistenceResult<Relationship>> => {
      setIsLoading(true);
      setError(null);

      try {
        // Get current relationship from store
        const currentRelationship = relationships.find(
          (r) => r.id === relationshipId
        );
        if (!currentRelationship) {
          throw new Error(`Relationship ${relationshipId} not found in store`);
        }

        // Merge current relationship with updates to get complete state
        const mergedRelationship: Relationship = {
          ...currentRelationship,
          ...updates,
        };

        // Map complete relationship to DB update format
        const dbUpdate = mapCoreRelationshipToDbFullUpdate(mergedRelationship);

        // Update in database
        const dbRelationship = await dbUpdateRelationship(
          relationshipId,
          dbUpdate
        );

        // Map back to core relationship format
        const coreRelationship = mapDbRelationshipToRelationship(dbRelationship);

        // Update in store
        updateRelationshipInStore(relationshipId, coreRelationship);

        return { data: coreRelationship, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update relationship";
        setError(errorMessage);
        console.error("[useRelationshipPersistence] Update error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [relationships, updateRelationshipInStore]
  );

  /**
   * Delete a relationship from the database and store
   */
  const deleteRelationship = useCallback(
    async (
      relationshipId: string
    ): Promise<RelationshipPersistenceResult<void>> => {
      setIsLoading(true);
      setError(null);

      try {
        // Delete from database
        await dbDeleteRelationship(relationshipId);

        // Remove from store
        removeRelationshipFromStore(relationshipId);

        return { data: undefined, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete relationship";
        setError(errorMessage);
        console.error("[useRelationshipPersistence] Delete error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [removeRelationshipFromStore]
  );

  /**
   * Fetch relationships for a specific entity from the database
   * and add them to the store
   */
  const fetchRelationshipsByEntity = useCallback(
    async (
      projectId: string,
      entityId: string
    ): Promise<RelationshipPersistenceResult<Relationship[]>> => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch from database
        const dbRelationships = await dbGetRelationshipsByEntity(
          projectId,
          entityId
        );

        // Map to core relationship format
        const coreRelationships = dbRelationships.map(
          mapDbRelationshipToRelationship
        );

        // Add each relationship to store (if not already present)
        coreRelationships.forEach((relationship) => {
          const exists = relationships.some((r) => r.id === relationship.id);
          if (!exists) {
            addRelationshipToStore(relationship);
          }
        });

        return { data: coreRelationships, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to fetch relationships by entity";
        setError(errorMessage);
        console.error(
          "[useRelationshipPersistence] Fetch by entity error:",
          err
        );
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [relationships, addRelationshipToStore]
  );

  return {
    createRelationship,
    updateRelationship,
    deleteRelationship,
    fetchRelationshipsByEntity,
    isLoading,
    error,
    clearError,
  };
}
