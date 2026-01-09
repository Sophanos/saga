import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Entity } from "@mythos/core";
import { useMythosStore } from "../stores";
import type { PersistenceResult } from "./usePersistence";
import { embedTextViaEdge, deleteVectorsViaEdge, EmbeddingApiError } from "../services/ai";

/**
 * Check if embeddings feature is enabled (Qdrant-only architecture)
 * Embeddings are enabled by default - set VITE_EMBEDDINGS_ENABLED=false to disable
 */
const EMBEDDINGS_ENABLED = import.meta.env["VITE_EMBEDDINGS_ENABLED"] !== "false";

/**
 * Format entity data for embedding generation
 * Creates a deterministic text representation of the entity
 */
function formatEntityForEmbedding(entity: Entity): string {
  const parts: string[] = [
    `type: ${entity.type}`,
    `name: ${entity.name}`,
  ];

  if (entity.aliases && entity.aliases.length > 0) {
    parts.push(`aliases: ${entity.aliases.join(", ")}`);
  }

  // Add notes/description if available
  const entityRecord = entity as unknown as Record<string, unknown>;
  const notes = entityRecord["notes"];
  if (typeof notes === "string" && notes.trim()) {
    parts.push(`notes: ${notes}`);
  }

  // Add properties
  if (entity.properties && Object.keys(entity.properties).length > 0) {
    parts.push(`properties: ${JSON.stringify(entity.properties)}`);
  }

  return parts.join("\n");
}

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

  /**
   * Generate entity embedding and index to Qdrant
   * Fire-and-forget: errors are logged but don't affect the main operation
   */
  const generateEntityEmbedding = useCallback(
    async (entity: Entity, projectId: string) => {
      if (!EMBEDDINGS_ENABLED) {
        return;
      }

      const text = formatEntityForEmbedding(entity);
      if (!text.trim()) {
        return;
      }

      try {
        await embedTextViaEdge(text, {
          qdrant: {
            enabled: true,
            pointId: `ent_${entity.id}`,
            payload: {
              project_id: projectId,
              type: "entity",
              entity_id: entity.id,
              entity_type: entity.type,
              title: entity.name,
              content_preview: text.slice(0, 500),
            },
          },
        });

        console.debug("[useEntityPersistence] Entity embedding generated and indexed to Qdrant");
      } catch (error) {
        if (error instanceof EmbeddingApiError) {
          console.warn("[useEntityPersistence] Embedding generation failed:", error.message);
        } else {
          console.warn("[useEntityPersistence] Embedding generation failed:", error);
        }
      }
    },
    []
  );

  const createEntity = useCallback(
    async (entity: Entity, projectId: string): Promise<EntityPersistenceResult<Entity>> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await createEntityMutation({
          projectId: projectId as Id<"projects">,
          type: entity.type,
          name: entity.name,
          aliases: entity.aliases,
          properties: entity.properties as Record<string, string | number | boolean>,
          notes: (entity as unknown as Record<string, unknown>)["notes"] as string | undefined,
        });

        // Map Convex result to Entity type
        const createdEntity: Entity = {
          id: result,
          type: entity.type,
          name: entity.name,
          aliases: entity.aliases || [],
          properties: entity.properties || {},
        };

        // Add to store
        addEntity(createdEntity);

        // Generate embedding (fire-and-forget)
        void generateEntityEmbedding(createdEntity, projectId);

        return { data: createdEntity };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create entity";
        setError(message);
        return { error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [createEntityMutation, addEntity, generateEntityEmbedding]
  );

  const updateEntity = useCallback(
    async (entityId: string, updates: Partial<Entity>): Promise<EntityPersistenceResult<Entity>> => {
      setIsLoading(true);
      setError(null);

      try {
        await updateEntityMutation({
          id: entityId as Id<"entities">,
          ...updates,
          properties: updates.properties as Record<string, string | number | boolean> | undefined,
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
        };

        // Update store
        updateEntityStore(entityId, updates);

        // Generate embedding (fire-and-forget)
        const projectId = (updatedEntity as Entity & { projectId?: string }).projectId;
        if (projectId) {
          void generateEntityEmbedding(updatedEntity, projectId);
        }

        return { data: updatedEntity };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update entity";
        setError(message);
        return { error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [updateEntityMutation, updateEntityStore, generateEntityEmbedding]
  );

  const deleteEntity = useCallback(
    async (entityId: string): Promise<EntityPersistenceResult<void>> => {
      setIsLoading(true);
      setError(null);

      try {
        await deleteEntityMutation({
          id: entityId as Id<"entities">,
        });

        // Remove from store
        removeEntity(entityId);

        // Delete vector from Qdrant (fire-and-forget)
        void deleteVectorsViaEdge([`ent_${entityId}`]);

        return {};
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete entity";
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
