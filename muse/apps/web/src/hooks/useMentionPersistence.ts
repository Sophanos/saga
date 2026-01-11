import { useCallback, useState } from "react";
import type { PersistenceResult, BasePersistenceState } from "./usePersistence";

/**
 * Mention type (local definition until Convex schema is added)
 */
export interface Mention {
  id: string;
  entity_id: string;
  document_id: string;
  position_start: number;
  position_end: number;
  context: string;
  created_at?: string;
}

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
 * Hook for entity mention persistence operations
 *
 * TODO: Implement Convex backend for mentions
 * Currently stubbed out - operations are no-ops that return empty results.
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
 * ```
 */
export function useMentionPersistence(): UseMentionPersistenceResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Load all mentions for a specific document
   * TODO: Implement with Convex query
   */
  const loadMentionsForDocument = useCallback(
    async (_documentId: string): Promise<PersistenceResult<Mention[]>> => {
      // Stub: return empty array until Convex mentions schema is implemented
      console.debug("[useMentionPersistence] loadMentionsForDocument not yet implemented for Convex");
      return { data: [] };
    },
    []
  );

  /**
   * Replace all mentions for a document
   * TODO: Implement with Convex mutation
   */
  const saveMentions = useCallback(
    async (
      _documentId: string,
      mentions: MentionBatchInput[]
    ): Promise<PersistenceResult<Mention[]>> => {
      // Stub: return the input as-is with generated IDs
      console.debug("[useMentionPersistence] saveMentions not yet implemented for Convex");
      const savedMentions: Mention[] = mentions.map((m, i) => ({
        ...m,
        id: `temp_mention_${i}`,
        document_id: _documentId,
      }));
      return { data: savedMentions };
    },
    []
  );

  /**
   * Create a single mention
   * TODO: Implement with Convex mutation
   */
  const addMention = useCallback(
    async (mention: MentionInput): Promise<PersistenceResult<Mention>> => {
      console.debug("[useMentionPersistence] addMention not yet implemented for Convex");
      const newMention: Mention = {
        ...mention,
        id: `temp_mention_${Date.now()}`,
      };
      return { data: newMention };
    },
    []
  );

  /**
   * Delete a single mention by ID
   * TODO: Implement with Convex mutation
   */
  const removeMention = useCallback(
    async (_id: string): Promise<PersistenceResult<void>> => {
      console.debug("[useMentionPersistence] removeMention not yet implemented for Convex");
      return {};
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
