import { useState, useCallback, useRef } from "react";
import type {
  DetectedEntity,
  DetectionWarning,
  DetectionStats,
  DetectionOptions,
  EntityType,
} from "@mythos/core";
import type { Entity, Mention } from "@mythos/core";
import type { Editor } from "@mythos/editor";
import {
  createEntity as dbCreateEntity,
  updateEntity as dbUpdateEntity,
  mapCoreEntityToDbInsert,
  mapCoreEntityToDbUpdate,
  mapDbEntityToEntity,
} from "@mythos/db";
import { useMythosStore, useEntities } from "../stores";
import { useApiKey } from "./useApiKey";
import { useEntityMarks } from "./useEntityMarks";
import { detectEntitiesViaEdge, DetectApiError } from "../services/ai";

/**
 * Generate a simple UUID v4
 */
function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Options for configuring the entity detection hook
 */
export interface UseEntityDetectionOptions {
  /** Minimum text length to trigger detection (default: 100) */
  minLength?: number;
  /** Detection options passed to the AI agent */
  detectionOptions?: DetectionOptions;
  /** Whether detection is enabled (default: true) */
  enabled?: boolean;
  /** Editor instance for applying EntityMarks */
  editor?: Editor | null;
}

/**
 * Return type for the useEntityDetection hook
 */
export interface UseEntityDetectionResult {
  // State
  /** Whether detection is currently running */
  isDetecting: boolean;
  /** Detected entities pending review */
  detectedEntities: DetectedEntity[];
  /** Warnings from detection */
  warnings: DetectionWarning[];
  /** Whether the modal is open */
  isModalOpen: boolean;
  /** Whether entities are being created */
  isCreating: boolean;
  /** Error message if detection failed */
  error: string | null;
  /** Statistics from last detection */
  stats: DetectionStats | null;

  // Actions
  /** Callback to pass to PasteHandler.onSubstantialPaste */
  handlePaste: (text: string, pastePosition: number) => void;
  /** Manually trigger detection on text */
  detectInText: (text: string) => Promise<void>;
  /** Open modal with current detected entities */
  openModal: () => void;
  /** Close modal and clear pending entities */
  closeModal: () => void;
  /** Apply selected entities (creates them in store) */
  applyEntities: (selectedEntities: DetectedEntity[]) => Promise<void>;
  /** Clear all detection state */
  clearDetection: () => void;
}

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: Omit<Required<UseEntityDetectionOptions>, "editor"> = {
  minLength: 100,
  detectionOptions: {},
  enabled: true,
};

/**
 * Convert DetectedEntity to Entity for store persistence
 */
function convertToEntity(
  detected: DetectedEntity,
  documentId: string
): Entity {
  const now = new Date();

  // Convert occurrences to mentions
  const mentions: Mention[] = detected.occurrences.map((occ) => ({
    id: generateId(),
    documentId,
    positionStart: occ.startOffset,
    positionEnd: occ.endOffset,
    context: occ.context,
    timestamp: now,
  }));

  // Base entity
  const entity: Entity = {
    id: detected.matchedExistingId || generateId(),
    name: detected.name,
    aliases: detected.suggestedAliases,
    type: detected.type,
    properties: (detected.inferredProperties || {}) as Record<string, string | number | boolean>,
    mentions,
    createdAt: now,
    updatedAt: now,
  };

  return entity;
}

/**
 * Hook for managing AI-powered entity detection from pasted text
 *
 * Features:
 * - Integration with PasteHandler extension
 * - AI-powered entity detection via EntityDetector agent
 * - Modal workflow for reviewing/selecting detected entities
 * - Store integration for creating confirmed entities
 * - Error handling and loading states
 *
 * @param options - Hook configuration
 * @returns Detection state and controls
 */
export function useEntityDetection(
  options: UseEntityDetectionOptions = {}
): UseEntityDetectionResult {
  const { minLength, detectionOptions, enabled, editor } = {
    ...DEFAULT_OPTIONS,
    editor: null,
    ...options,
  };

  // Store actions
  const addEntity = useMythosStore((state) => state.addEntity);
  const updateEntity = useMythosStore((state) => state.updateEntity);
  const currentDocument = useMythosStore(
    (state) => state.document.currentDocument
  );
  const existingEntities = useEntities();

  // API key for BYOK
  const { key: apiKey } = useApiKey();

  // EntityMark application
  const { applyMarksForDetectedEntities } = useEntityMarks(editor);

  // Local state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedEntities, setDetectedEntities] = useState<DetectedEntity[]>(
    []
  );
  const [warnings, setWarnings] = useState<DetectionWarning[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DetectionStats | null>(null);

  // Track paste position for potential highlighting
  const lastPastePositionRef = useRef<number>(0);

  // Abort controller for cancelling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Run entity detection on the provided text
   */
  const detectInText = useCallback(
    async (text: string) => {
      if (!enabled) return;
      if (text.length < minLength) return;

      // Cancel any pending detection
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsDetecting(true);
      setError(null);

      try {
        // Prepare existing entities for matching
        const existingForMatching = existingEntities.map((e) => ({
          id: e.id,
          name: e.name,
          aliases: e.aliases || [],
          type: e.type as EntityType,
        }));

        // Call the entity detection edge function via service client
        const result = await detectEntitiesViaEdge(
          {
            text,
            existingEntities: existingForMatching,
            options: detectionOptions,
          },
          {
            apiKey: apiKey || undefined,
            signal: abortControllerRef.current.signal,
          }
        );

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        // Update state with results
        setDetectedEntities(result.entities);
        setWarnings(result.warnings);
        setStats(result.stats);

        // Auto-open modal if entities were detected
        if (result.entities.length > 0) {
          setIsModalOpen(true);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof DetectApiError && err.code === "ABORTED") {
          return;
        }

        const message =
          err instanceof Error ? err.message : "Entity detection failed";
        setError(message);
        console.error("[useEntityDetection] Error:", err);
      } finally {
        setIsDetecting(false);
      }
    },
    [enabled, minLength, detectionOptions, existingEntities, apiKey]
  );

  /**
   * Handle substantial paste - callback for PasteHandler extension
   */
  const handlePaste = useCallback(
    (text: string, pastePosition: number) => {
      if (!enabled) return;

      lastPastePositionRef.current = pastePosition;
      detectInText(text);
    },
    [enabled, detectInText]
  );

  /**
   * Open the entity suggestion modal
   */
  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  /**
   * Close the modal and optionally clear state
   */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  /**
   * Apply selected entities - create or update in DB and store, then apply EntityMarks
   */
  const applyEntities = useCallback(
    async (selectedEntities: DetectedEntity[]) => {
      if (selectedEntities.length === 0) {
        closeModal();
        return;
      }

      setIsCreating(true);
      setError(null);

      try {
        const documentId = currentDocument?.id || "unknown";

        // Get projectId for DB persistence
        const projectId = useMythosStore.getState().project.currentProject?.id;
        if (!projectId) {
          throw new Error("No project loaded - cannot persist entities");
        }

        // Collect entity IDs for marking (use existing ID or generate new one)
        const entitiesWithIds = selectedEntities.map((detected) => ({
          ...detected,
          tempId: detected.matchedExistingId || generateId(),
        }));

        for (const detected of entitiesWithIds) {
          const entity = convertToEntity(
            { ...detected, matchedExistingId: detected.tempId },
            documentId
          );

          if (detected.matchedExistingId && detected.matchedExistingId === detected.tempId) {
            // Update existing entity with new mentions
            const existing = existingEntities.find(
              (e) => e.id === detected.matchedExistingId
            );
            if (existing) {
              const updates = {
                mentions: [...(existing.mentions || []), ...(entity.mentions || [])],
                aliases: [
                  ...new Set([...(existing.aliases || []), ...(entity.aliases || [])]),
                ],
                updatedAt: new Date(),
              };

              try {
                // Persist to DB first
                const dbUpdate = mapCoreEntityToDbUpdate(updates);
                const dbEntity = await dbUpdateEntity(detected.matchedExistingId, dbUpdate);
                const persistedEntity = mapDbEntityToEntity(dbEntity);

                // Then update in store
                updateEntity(detected.matchedExistingId, persistedEntity);
              } catch (dbErr) {
                console.error("[useEntityDetection] DB update failed, updating store only:", dbErr);
                // Fallback to store-only update
                updateEntity(detected.matchedExistingId, updates);
              }
            }
          } else {
            // Create new entity with the tempId
            const newEntity = { ...entity, id: detected.tempId };

            try {
              // Persist to DB first
              const dbInsert = mapCoreEntityToDbInsert(newEntity, projectId);
              const dbEntity = await dbCreateEntity(dbInsert);
              const persistedEntity = mapDbEntityToEntity(dbEntity);

              // Then add to store with DB-returned data
              addEntity(persistedEntity);
            } catch (dbErr) {
              console.error("[useEntityDetection] DB create failed, adding to store only:", dbErr);
              // Fallback to store-only add
              addEntity(newEntity);
            }
          }
        }

        // Apply EntityMarks to the detected text ranges
        // Use the paste position offset for accurate positioning
        applyMarksForDetectedEntities(entitiesWithIds, lastPastePositionRef.current);

        // Clear detection state and close modal
        setDetectedEntities([]);
        setWarnings([]);
        setStats(null);
        closeModal();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create entities";
        setError(message);
        console.error("[useEntityDetection] Error creating entities:", err);
      } finally {
        setIsCreating(false);
      }
    },
    [
      currentDocument,
      existingEntities,
      addEntity,
      updateEntity,
      closeModal,
      applyMarksForDetectedEntities,
    ]
  );

  /**
   * Clear all detection state
   */
  const clearDetection = useCallback(() => {
    setDetectedEntities([]);
    setWarnings([]);
    setStats(null);
    setError(null);
    setIsModalOpen(false);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    // State
    isDetecting,
    detectedEntities,
    warnings,
    isModalOpen,
    isCreating,
    error,
    stats,

    // Actions
    handlePaste,
    detectInText,
    openModal,
    closeModal,
    applyEntities,
    clearDetection,
  };
}
