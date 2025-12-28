import { useCallback, useEffect, useRef } from "react";
import type { Interaction } from "@mythos/core";
import { useDynamicsStore } from "../stores/dynamics";
import { useApiKey } from "./useApiKey";
import { extractDynamicsViaEdge, DynamicsApiError } from "../services/ai";
import { simpleHash } from "../utils/hash";

/**
 * Debounce delay in milliseconds before triggering extraction
 */
const DEBOUNCE_DELAY = 2000;

/**
 * Minimum content length to trigger extraction
 */
const MIN_CONTENT_LENGTH = 100;

/**
 * Options for the useDynamicsExtraction hook
 */
interface UseDynamicsExtractionOptions {
  /** Content to analyze */
  content: string;
  /** Whether auto-extraction is enabled */
  autoExtract?: boolean;
  /** Custom debounce delay */
  debounceMs?: number;
  /** Optional document ID for tracking */
  documentId?: string;
  /** Optional scene marker for context */
  sceneMarker?: string;
  /** Whether the hook is enabled (false disables all extraction) */
  enabled?: boolean;
  /** Optional known entities for name resolution */
  knownEntities?: Array<{ id: string; name: string; type: string }>;
}

/**
 * Return type for the useDynamicsExtraction hook
 */
interface UseDynamicsExtractionResult {
  /** Whether extraction is currently running */
  isExtracting: boolean;
  /** List of extracted interactions */
  interactions: Interaction[];
  /** Error message if extraction failed */
  error: string | null;
  /** Manually trigger extraction */
  runExtraction: () => Promise<void>;
  /** Clear all extracted interactions */
  clearInteractions: () => void;
}

/**
 * Hook for managing dynamics extraction from prose content
 *
 * Features:
 * - Debounced auto-extraction after typing stops (2000ms default)
 * - Content hash deduplication to avoid re-analyzing same content
 * - Manual extraction trigger
 * - Integration with dynamics store
 * - BYOK (Bring Your Own Key) support via edge function
 * - Error handling with specific error codes
 *
 * @param options - Hook configuration options
 * @returns Extraction state and controls
 */
export function useDynamicsExtraction(
  options: UseDynamicsExtractionOptions
): UseDynamicsExtractionResult {
  const {
    content,
    autoExtract = true,
    debounceMs = DEBOUNCE_DELAY,
    documentId,
    sceneMarker,
    enabled = true,
    knownEntities,
  } = options;

  // API key for BYOK pattern
  const { key: apiKey } = useApiKey();

  // Store state and actions
  const interactions = useDynamicsStore((state) => state.interactions);
  const isLoading = useDynamicsStore((state) => state.isLoading);
  const error = useDynamicsStore((state) => state.error);
  const addInteraction = useDynamicsStore((state) => state.addInteraction);
  const setLoading = useDynamicsStore((state) => state.setLoading);
  const setError = useDynamicsStore((state) => state.setError);
  const clearInteractions = useDynamicsStore((state) => state.clearInteractions);

  // Refs for debouncing and deduplication
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<string>("");
  const lastContentHashRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Run the dynamics extraction via edge function
   */
  const runExtraction = useCallback(async () => {
    // Don't extract if disabled or content is too short
    if (!enabled || content.length < MIN_CONTENT_LENGTH) {
      return;
    }

    // Check if content hash matches last extracted - skip if same
    const contentHash = simpleHash(content);
    if (contentHash === lastContentHashRef.current) {
      return;
    }

    // Cancel any pending extraction
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // Call the edge function
      const result = await extractDynamicsViaEdge(
        {
          content,
          documentId,
          sceneMarker,
          knownEntities,
        },
        {
          apiKey: apiKey || undefined,
          signal: abortControllerRef.current.signal,
        }
      );

      // Check if we were aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Update store with new interactions
      // Merge with existing interactions, avoiding duplicates by ID
      const existingIds = new Set(interactions.map((i) => i.id));
      const newInteractions = result.interactions.filter(
        (i) => !existingIds.has(i.id)
      );

      // Add new interactions to the store
      for (const interaction of newInteractions) {
        addInteraction(interaction);
      }

      // Update last analyzed content hash
      lastContentHashRef.current = contentHash;
      lastContentRef.current = content;
    } catch (err) {
      // Handle DynamicsApiError with specific error codes
      if (err instanceof DynamicsApiError) {
        // Ignore abort errors
        if (err.code === "ABORTED") {
          return;
        }

        // Handle specific error codes
        let errorMessage = err.message;
        switch (err.code) {
          case "UNAUTHORIZED":
            errorMessage = "API key required. Please add your OpenRouter API key in settings.";
            break;
          case "RATE_LIMITED":
            errorMessage = "Rate limit exceeded. Please wait a moment before trying again.";
            break;
          case "CONFIGURATION_ERROR":
            errorMessage = "Configuration error. Please check your environment settings.";
            break;
          case "VALIDATION_ERROR":
            errorMessage = `Validation error: ${err.message}`;
            break;
          case "SERVER_ERROR":
            errorMessage = "Server error. Please try again later.";
            break;
        }

        setError(errorMessage);
        console.error("[useDynamicsExtraction] DynamicsApiError:", err.code, err.message);
        return;
      }

      // Handle generic abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : "Extraction failed";
      setError(message);
      console.error("[useDynamicsExtraction] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [
    content,
    documentId,
    sceneMarker,
    knownEntities,
    apiKey,
    interactions,
    setLoading,
    setError,
    addInteraction,
    enabled,
  ]);

  /**
   * Debounced auto-extraction effect
   */
  useEffect(() => {
    // Skip if disabled or auto-extract is disabled
    if (!enabled || !autoExtract) {
      return;
    }

    // Skip if content hasn't changed
    if (content === lastContentRef.current) {
      return;
    }

    // Skip if content is too short
    if (content.length < MIN_CONTENT_LENGTH) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer
    debounceTimerRef.current = setTimeout(() => {
      runExtraction();
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, autoExtract, debounceMs, runExtraction, enabled]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isExtracting: isLoading,
    interactions,
    error,
    runExtraction,
    clearInteractions,
  };
}

/**
 * Hook for accessing dynamics store without content binding
 * Useful for components that just need to read dynamics data
 */
export function useDynamicsData() {
  const interactions = useDynamicsStore((state) => state.interactions);
  const isLoading = useDynamicsStore((state) => state.isLoading);
  const error = useDynamicsStore((state) => state.error);
  const selectedInteractionId = useDynamicsStore(
    (state) => state.selectedInteractionId
  );

  const selectedInteraction = interactions.find(
    (i) => i.id === selectedInteractionId
  );

  return {
    interactions,
    isLoading,
    error,
    selectedInteraction,
  };
}

/**
 * Hook for getting interactions filtered by type
 */
export function useInteractionsByType(type: "neutral" | "hostile" | "hidden" | "passive") {
  const interactions = useDynamicsStore((state) => state.interactions);
  return interactions.filter((i) => i.type === type);
}

/**
 * Hook for getting interactions for a specific entity
 */
export function useEntityInteractions(entityName: string) {
  const interactions = useDynamicsStore((state) => state.interactions);
  return interactions.filter(
    (i) => i.source === entityName || i.target === entityName
  );
}
