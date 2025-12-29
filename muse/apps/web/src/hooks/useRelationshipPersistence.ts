import { useCallback } from "react";
import {
  createRelationship as dbCreateRelationship,
  updateRelationship as dbUpdateRelationship,
  deleteRelationship as dbDeleteRelationship,
  getRelationshipsByEntity as dbGetRelationshipsByEntity,
  mapCoreRelationshipToDbInsert,
  mapCoreRelationshipToDbFullUpdate,
  mapDbRelationshipToRelationship,
} from "@mythos/db";
import type { Relationship } from "@mythos/core";
import { useMythosStore } from "../stores";
import { usePersistenceState, type PersistenceResult } from "./usePersistence";

/**
 * Return type for the useRelationshipPersistence hook
 */
export interface UseRelationshipPersistenceResult {
  /** Create a new relationship in DB and add to store */
  createRelationship: (
    relationship: Relationship,
    projectId: string
  ) => Promise<PersistenceResult<Relationship>>;
  /** Update an existing relationship in DB and store */
  updateRelationship: (
    relationshipId: string,
    updates: Partial<Relationship>
  ) => Promise<PersistenceResult<Relationship>>;
  /** Delete a relationship from DB and store */
  deleteRelationship: (
    relationshipId: string
  ) => Promise<PersistenceResult<void>>;
  /** Fetch relationships for a specific entity and add to store */
  fetchRelationshipsByEntity: (
    projectId: string,
    entityId: string
  ) => Promise<PersistenceResult<Relationship[]>>;
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
  // Use shared persistence state helper
  const { isLoading, error, clearError, wrapOperation } =
    usePersistenceState("Relationship");

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
   * Create a new relationship in the database and add to store
   */
  const createRelationship = useCallback(
    (
      relationship: Relationship,
      projectId: string
    ): Promise<PersistenceResult<Relationship>> =>
      wrapOperation(async () => {
        // Map core relationship to DB insert format
        const dbInsert = mapCoreRelationshipToDbInsert(relationship, projectId);

        // Insert into database
        const dbRelationship = await dbCreateRelationship(dbInsert);

        // Map back to core relationship format
        const coreRelationship = mapDbRelationshipToRelationship(dbRelationship);

        // Add to store
        addRelationshipToStore(coreRelationship);

        return coreRelationship;
      }, "Failed to create relationship"),
    [addRelationshipToStore, wrapOperation]
  );

  /**
   * Update an existing relationship in the database and store
   *
   * Merges the updates with the current relationship state to ensure
   * all relationship data is persisted.
   */
  const updateRelationship = useCallback(
    (
      relationshipId: string,
      updates: Partial<Relationship>
    ): Promise<PersistenceResult<Relationship>> =>
      wrapOperation(async () => {
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

        return coreRelationship;
      }, "Failed to update relationship"),
    [relationships, updateRelationshipInStore, wrapOperation]
  );

  /**
   * Delete a relationship from the database and store
   */
  const deleteRelationship = useCallback(
    (relationshipId: string): Promise<PersistenceResult<void>> =>
      wrapOperation(async () => {
        // Delete from database
        await dbDeleteRelationship(relationshipId);

        // Remove from store
        removeRelationshipFromStore(relationshipId);
      }, "Failed to delete relationship"),
    [removeRelationshipFromStore, wrapOperation]
  );

  /**
   * Fetch relationships for a specific entity from the database
   * and add them to the store
   */
  const fetchRelationshipsByEntity = useCallback(
    (
      projectId: string,
      entityId: string
    ): Promise<PersistenceResult<Relationship[]>> =>
      wrapOperation(async () => {
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

        return coreRelationships;
      }, "Failed to fetch relationships by entity"),
    [relationships, addRelationshipToStore, wrapOperation]
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
