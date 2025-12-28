import { useCallback, useState } from "react";
import {
  getMentionsByDocument,
  createMention as dbCreateMention,
  deleteMention as dbDeleteMention,
  replaceMentionsForDocument,
} from "@mythos/db";
import type { Database } from "@mythos/db";

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
 * Result type for mention persistence operations
 */
export interface MentionPersistenceResult<T = void> {
  data: T | null;
  error: string | null;
}

/**
 * Return type for the useMentionPersistence hook
 */
export interface UseMentionPersistenceResult {
  /** Load all mentions for a document */
  loadMentionsForDocument: (
    documentId: string
  ) => Promise<MentionPersistenceResult<Mention[]>>;
  /** Replace all mentions for a document (useful after entity detection) */
  saveMentions: (
    documentId: string,
    mentions: MentionBatchInput[]
  ) => Promise<MentionPersistenceResult<Mention[]>>;
  /** Create a single mention */
  addMention: (
    mention: MentionInput
  ) => Promise<MentionPersistenceResult<Mention>>;
  /** Delete a single mention by ID */
  removeMention: (id: string) => Promise<MentionPersistenceResult<void>>;
  /** Whether any operation is currently in progress */
  isLoading: boolean;
  /** Last error message (if any) */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Load all mentions for a specific document
   */
  const loadMentionsForDocument = useCallback(
    async (documentId: string): Promise<MentionPersistenceResult<Mention[]>> => {
      setIsLoading(true);
      setError(null);

      try {
        const mentions = await getMentionsByDocument(documentId);
        return { data: mentions, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load mentions";
        setError(errorMessage);
        console.error("[useMentionPersistence] Load error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Replace all mentions for a document
   *
   * This is the primary method for updating mentions after entity detection.
   * It deletes all existing mentions for the document and inserts the new ones.
   */
  const saveMentions = useCallback(
    async (
      documentId: string,
      mentions: MentionBatchInput[]
    ): Promise<MentionPersistenceResult<Mention[]>> => {
      setIsLoading(true);
      setError(null);

      try {
        const savedMentions = await replaceMentionsForDocument(
          documentId,
          mentions
        );
        return { data: savedMentions, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to save mentions";
        setError(errorMessage);
        console.error("[useMentionPersistence] Save error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Create a single mention
   */
  const addMention = useCallback(
    async (mention: MentionInput): Promise<MentionPersistenceResult<Mention>> => {
      setIsLoading(true);
      setError(null);

      try {
        const insertData: MentionInsert = {
          entity_id: mention.entity_id,
          document_id: mention.document_id,
          position_start: mention.position_start,
          position_end: mention.position_end,
          context: mention.context,
        };

        const createdMention = await dbCreateMention(insertData);
        return { data: createdMention, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create mention";
        setError(errorMessage);
        console.error("[useMentionPersistence] Create error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Delete a single mention by ID
   */
  const removeMention = useCallback(
    async (id: string): Promise<MentionPersistenceResult<void>> => {
      setIsLoading(true);
      setError(null);

      try {
        await dbDeleteMention(id);
        return { data: undefined, error: null };
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete mention";
        setError(errorMessage);
        console.error("[useMentionPersistence] Delete error:", err);
        return { data: null, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    []
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
