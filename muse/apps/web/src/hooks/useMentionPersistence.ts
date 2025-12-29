import { useCallback } from "react";
import {
  getMentionsByDocument,
  createMention as dbCreateMention,
  deleteMention as dbDeleteMention,
  replaceMentionsForDocument,
} from "@mythos/db";
import type { Database } from "@mythos/db";
import {
  usePersistenceState,
  type PersistenceResult,
  type BasePersistenceState,
} from "./usePersistence";

/**
 * Database mention types
 */
type Mention = Database["public"]["Tables"]["mentions"]["Row"];
type MentionInsert = Database["public"]["Tables"]["mentions"]["Insert"];

/**
 * Input type for creating mentions (without auto-generated fields)
 */
export interface MentionInput {
  entity_id: string;
  document_id: string;
  position_start: number;
  position_end: number;
  context: string;
}

/**
 * Input for batch saving mentions (document_id is provided separately)
 */
export interface MentionBatchInput {
  entity_id: string;
  position_start: number;
  position_end: number;
  context: string;
}

/**
 * Return type for the useMentionPersistence hook
 */
export interface UseMentionPersistenceResult extends BasePersistenceState {
  /** Load all mentions for a document */
  loadMentionsForDocument: (
    documentId: string
  ) => Promise<PersistenceResult<Mention[]>>;
  /** Replace all mentions for a document (useful after entity detection) */
  saveMentions: (
    documentId: string,
    mentions: MentionBatchInput[]
  ) => Promise<PersistenceResult<Mention[]>>;
  /** Create a single mention */
  addMention: (mention: MentionInput) => Promise<PersistenceResult<Mention>>;
  /** Delete a single mention by ID */
  removeMention: (id: string) => Promise<PersistenceResult<void>>;
}

/**
 * Hook for entity mention persistence operations with Supabase
 *
 * Provides CRUD operations for managing entity mentions in documents.
 * Unlike entities, mentions are managed per-document and don't require
 * global store management - they can be returned directly to the caller.
 *
 * @example
 * ```tsx
 * const { loadMentionsForDocument, saveMentions, addMention, removeMention, isLoading, error } = useMentionPersistence();
 *
 * // Load mentions for a document
 * const result = await loadMentionsForDocument(documentId);
 * if (result.data) {
 *   console.log('Found mentions:', result.data);
 * }
 *
 * // Replace all mentions after entity detection
 * const detectedMentions = [
 *   { entity_id: 'char-1', position_start: 0, position_end: 5, context: 'Alice walked...' },
 *   { entity_id: 'loc-1', position_start: 20, position_end: 28, context: '...to the forest' }
 * ];
 * await saveMentions(documentId, detectedMentions);
 *
 * // Add a single mention
 * await addMention({
 *   entity_id: 'char-2',
 *   document_id: documentId,
 *   position_start: 50,
 *   position_end: 55,
 *   context: 'Bob said...'
 * });
 *
 * // Remove a mention
 * await removeMention(mentionId);
 * ```
 */
export function useMentionPersistence(): UseMentionPersistenceResult {
  const { isLoading, error, clearError, wrapOperation } =
    usePersistenceState("Mention");

  /**
   * Load all mentions for a specific document
   */
  const loadMentionsForDocument = useCallback(
    (documentId: string): Promise<PersistenceResult<Mention[]>> =>
      wrapOperation(
        () => getMentionsByDocument(documentId),
        "Failed to load mentions"
      ),
    [wrapOperation]
  );

  /**
   * Replace all mentions for a document
   *
   * This is the primary method for updating mentions after entity detection.
   * It deletes all existing mentions for the document and inserts the new ones.
   */
  const saveMentions = useCallback(
    (
      documentId: string,
      mentions: MentionBatchInput[]
    ): Promise<PersistenceResult<Mention[]>> =>
      wrapOperation(
        () => replaceMentionsForDocument(documentId, mentions),
        "Failed to save mentions"
      ),
    [wrapOperation]
  );

  /**
   * Create a single mention
   */
  const addMention = useCallback(
    (mention: MentionInput): Promise<PersistenceResult<Mention>> =>
      wrapOperation(async () => {
        const insertData: MentionInsert = {
          entity_id: mention.entity_id,
          document_id: mention.document_id,
          position_start: mention.position_start,
          position_end: mention.position_end,
          context: mention.context,
        };
        return dbCreateMention(insertData);
      }, "Failed to create mention"),
    [wrapOperation]
  );

  /**
   * Delete a single mention by ID
   */
  const removeMention = useCallback(
    (id: string): Promise<PersistenceResult<void>> =>
      wrapOperation(() => dbDeleteMention(id), "Failed to delete mention"),
    [wrapOperation]
  );

  return {
    loadMentionsForDocument,
    saveMentions,
    addMention,
    removeMention,
    isLoading,
    error,
    clearError,
  };
}
