import { useState, useCallback, useRef } from "react";
import type {
  DetectedEntity,
  DetectionWarning,
  DetectionStats,
  DetectionOptions,
  EntityType,
} from "@mythos/core";
import type { Entity, Mention } from "@mythos/core";
import { useMythosStore, useEntities } from "../stores";
import { useApiKey } from "./useApiKey";

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
const DEFAULT_OPTIONS: Required<UseEntityDetectionOptions> = {
  minLength: 100,
  detectionOptions: {},
  enabled: true,
};

// Supabase edge function URL
const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

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
  const { minLength, detectionOptions, enabled } = {
    ...DEFAULT_OPTIONS,
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
          aliases: e.aliases,
          type: e.type as EntityType,
        }));

        // Call the entity detection edge function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-detect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey && { "x-openrouter-key": apiKey }),
          },
          body: JSON.stringify({
            text,
            existingEntities: existingForMatching,
            options: detectionOptions,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Detection failed: ${response.status}`);
        }

        const result = await response.json();

        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        // Update state with results
        setDetectedEntities(result.entities || []);
        setWarnings(result.warnings || []);
        setStats(result.stats || null);

        // Auto-open modal if entities were detected
        if (result.entities && result.entities.length > 0) {
          setIsModalOpen(true);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
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
   * Apply selected entities - create or update in store
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

        for (const detected of selectedEntities) {
          const entity = convertToEntity(detected, documentId);

          if (detected.matchedExistingId) {
            // Update existing entity with new mentions
            const existing = existingEntities.find(
              (e) => e.id === detected.matchedExistingId
            );
            if (existing) {
              updateEntity(detected.matchedExistingId, {
                mentions: [...(existing.mentions || []), ...(entity.mentions || [])],
                aliases: [
                  ...new Set([...(existing.aliases || []), ...(entity.aliases || [])]),
                ],
                updatedAt: new Date(),
              });
            }
          } else {
            // Create new entity
            addEntity(entity);
          }
        }

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
