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
import { embedTextViaEdge, EmbeddingApiError } from "../services/ai";

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
  const notes = (entity as Record<string, unknown>).notes;
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

  /**
   * Generate entity embedding and index to Qdrant
   * Fire-and-forget: errors are logged but don't affect the main operation
   *
   * Qdrant-only architecture: embeddings stored in Qdrant with 4096 dimensions
   * for best quality with Qwen3-Embedding-8B model.
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
        // Generate embedding and index to Qdrant in one call
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
        // Log but don't propagate - embedding failures must not affect entity operations
        if (error instanceof EmbeddingApiError) {
          console.warn("[useEntityPersistence] Embedding generation failed:", error.message);
        } else {
          console.warn("[useEntityPersistence] Embedding generation failed:", error);
        }
      }
    },
    []
  );

  // Wrap to maintain backward-compatible naming and add embedding generation
  const createEntity = useCallback(
    async (entity: Entity, projectId: string) => {
      const result = await create(entity, projectId);

      // Trigger embedding generation on success (fire-and-forget)
      if (result.data) {
        void generateEntityEmbedding(result.data, projectId);
      }

      return result;
    },
    [create, generateEntityEmbedding]
  );

  const updateEntity = useCallback(
    async (entityId: string, updates: Partial<Entity>) => {
      const result = await update(entityId, updates);

      // Trigger embedding generation on success (fire-and-forget)
      if (result.data) {
        const projectId = (result.data as Entity & { projectId?: string }).projectId;
        if (projectId) {
          void generateEntityEmbedding(result.data, projectId);
        }
      }

      return result;
    },
    [update, generateEntityEmbedding]
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
