import { useCallback } from "react";
import { useConvex, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Relationship } from "@mythos/core";
import { useMythosStore } from "../stores";
import { usePersistenceState, type PersistenceResult } from "./usePersistence";
import { formatGraphErrorMessage } from "../utils";

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

function mapConvexRelationshipToRelationship(
  relationship: ConvexRelationship
): Relationship {
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

  const convex = useConvex();
  const createRelationshipMutation = useMutation(api.relationships.create);
  const updateRelationshipMutation = useMutation(api.relationships.update);
  const deleteRelationshipMutation = useMutation(api.relationships.remove);

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
        try {
          const relationshipId = await createRelationshipMutation({
            projectId: projectId as Id<"projects">,
            sourceId: relationship.sourceId as Id<"entities">,
            targetId: relationship.targetId as Id<"entities">,
            type: relationship.type,
            bidirectional: relationship.bidirectional ?? false,
            strength: relationship.strength,
            metadata: relationship.metadata,
            notes: relationship.notes,
          });

          const coreRelationship: Relationship = {
            id: relationshipId,
            sourceId: relationship.sourceId,
            targetId: relationship.targetId,
            type: relationship.type,
            bidirectional: relationship.bidirectional ?? false,
            strength: relationship.strength,
            metadata: relationship.metadata,
            notes: relationship.notes,
            createdAt: new Date(),
          };

          // Add to store
          addRelationshipToStore(coreRelationship);

          return coreRelationship;
        } catch (err) {
          throw new Error(
            formatGraphErrorMessage(err, "Failed to create relationship")
          );
        }
      }, "Failed to create relationship"),
    [addRelationshipToStore, createRelationshipMutation, wrapOperation]
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

          await updateRelationshipMutation({
            id: relationshipId as Id<"relationships">,
            type: updates.type,
            bidirectional: updates.bidirectional,
            strength: updates.strength,
            metadata: updates.metadata,
            notes: updates.notes,
          });

          // Update in store
          updateRelationshipInStore(relationshipId, mergedRelationship);

          return mergedRelationship;
        } catch (err) {
          throw new Error(
            formatGraphErrorMessage(err, "Failed to update relationship")
          );
        }
      }, "Failed to update relationship"),
    [relationships, updateRelationshipInStore, updateRelationshipMutation, wrapOperation]
  );

  /**
   * Delete a relationship from the database and store
   */
  const deleteRelationship = useCallback(
    (relationshipId: string): Promise<PersistenceResult<void>> =>
      wrapOperation(async () => {
        try {
          // Delete from database
          await deleteRelationshipMutation({
            id: relationshipId as Id<"relationships">,
          });

          // Remove from store
          removeRelationshipFromStore(relationshipId);
        } catch (err) {
          throw new Error(
            formatGraphErrorMessage(err, "Failed to delete relationship")
          );
        }
      }, "Failed to delete relationship"),
    [deleteRelationshipMutation, removeRelationshipFromStore, wrapOperation]
  );

  /**
   * Fetch relationships for a specific entity from the database
   * and add them to the store
   */
  const fetchRelationshipsByEntity = useCallback(
    (
      _projectId: string,
      entityId: string
    ): Promise<PersistenceResult<Relationship[]>> =>
      wrapOperation(async () => {
        const dbRelationships = await convex.query(api.relationships.getForEntity, {
          entityId: entityId as Id<"entities">,
        });

        const combined = [
          ...(dbRelationships?.outgoing ?? []),
          ...(dbRelationships?.incoming ?? []),
        ];

        const uniqueById = new Map<string, Relationship>();
        for (const relationship of combined) {
          const mapped = mapConvexRelationshipToRelationship(
            relationship as ConvexRelationship
          );
          uniqueById.set(mapped.id, mapped);
        }

        const coreRelationships = Array.from(uniqueById.values());

        // Add each relationship to store (if not already present)
        coreRelationships.forEach((relationship) => {
          const exists = relationships.some((r) => r.id === relationship.id);
          if (!exists) {
            addRelationshipToStore(relationship);
          }
        });

        return coreRelationships;
      }, "Failed to fetch relationships by entity"),
    [convex, relationships, addRelationshipToStore, wrapOperation]
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
