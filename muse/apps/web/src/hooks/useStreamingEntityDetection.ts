/**
 * useStreamingEntityDetection - Progressive Entity Detection Hook
 *
 * Consumes the ai-detect-stream SSE endpoint to receive entities one-by-one
 * as they're detected, providing immediate visual feedback in the UI.
 *
 * @example
 * ```tsx
 * const { detectEntities, entities, stats, isStreaming, error } = useStreamingEntityDetection();
 *
 * // Start detection
 * await detectEntities(text, { minConfidence: 0.7 });
 *
 * // Entities appear one-by-one in `entities` array
 * // Stats available after completion in `stats`
 * ```
 */

import { useState, useCallback, useRef } from "react";
import type {
  DetectedEntity,
  DetectionStats,
  DetectionOptions,
  EntityType,
} from "@mythos/core";
// Configuration from environment
const SUPABASE_URL = import.meta.env["VITE_SUPABASE_URL"] || "";

/**
 * Get API key from store or local storage
 * This mirrors the pattern used in other AI service clients
 */
function getApiKey(): string | undefined {
  // Try to get from localStorage (where settings are stored)
  try {
    const settings = localStorage.getItem("mythos-settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      if (parsed.state?.apiKey) {
        return parsed.state.apiKey;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return undefined;
}

// ============================================================================
// Types
// ============================================================================

export interface StreamingDetectionState {
  /** Entities detected so far (grows as stream progresses) */
  entities: DetectedEntity[];
  /** Final stats (available after stream completes) */
  stats: DetectionStats | null;
  /** Whether detection is currently streaming */
  isStreaming: boolean;
  /** Error if detection failed */
  error: string | null;
  /** Number of entities detected so far */
  entityCount: number;
}

export interface StreamingDetectionOptions extends DetectionOptions {
  /** Callback fired for each entity as it's detected */
  onEntity?: (entity: DetectedEntity) => void;
  /** Callback fired when all detection is complete */
  onComplete?: (entities: DetectedEntity[], stats: DetectionStats) => void;
  /** Callback fired on error */
  onError?: (error: string) => void;
}

export interface ExistingEntityRef {
  id: string;
  name: string;
  aliases: string[];
  type: EntityType;
}

// ============================================================================
// SSE Event Types
// ============================================================================

interface SSEEntityEvent {
  type: "entity";
  data: DetectedEntity;
}

interface SSEStatsEvent {
  type: "stats";
  data: DetectionStats;
}

interface SSEDoneEvent {
  type: "done";
}

interface SSEErrorEvent {
  type: "error";
  message: string;
}

interface SSEContextEvent {
  type: "context";
  data: SSEEvent;
}

type SSEEvent = SSEEntityEvent | SSEStatsEvent | SSEDoneEvent | SSEErrorEvent | SSEContextEvent;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStreamingEntityDetection() {
  const [state, setState] = useState<StreamingDetectionState>({
    entities: [],
    stats: null,
    isStreaming: false,
    error: null,
    entityCount: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Cancel any in-progress detection
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  /**
   * Start progressive entity detection
   */
  const detectEntities = useCallback(
    async (
      text: string,
      existingEntities?: ExistingEntityRef[],
      options?: StreamingDetectionOptions
    ): Promise<DetectedEntity[]> => {
      // Cancel any existing detection
      cancel();

      // Reset state
      setState({
        entities: [],
        stats: null,
        isStreaming: true,
        error: null,
        entityCount: 0,
      });

      const apiKey = getApiKey();

      if (!apiKey || !SUPABASE_URL) {
        const error = "API key or Supabase URL not configured";
        setState((prev) => ({ ...prev, isStreaming: false, error }));
        options?.onError?.(error);
        throw new Error(error);
      }

      // Create abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const detectedEntities: DetectedEntity[] = [];

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-detect-stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-openrouter-key": apiKey,
          },
          body: JSON.stringify({
            text,
            existingEntities,
            options: {
              minConfidence: options?.minConfidence,
              entityTypes: options?.entityTypes,
              detectAliases: options?.detectAliases,
              matchExisting: options?.matchExisting,
              maxEntities: options?.maxEntities,
              includeContext: options?.includeContext,
              contextLength: options?.contextLength,
            },
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Detection failed: ${response.status} ${errorText}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalStats: DetectionStats | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || ""; // Keep incomplete event in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const eventData = JSON.parse(line.slice(6)) as SSEEvent;

              if (eventData.type === "context") {
                // Handle wrapped context event (from sendContext)
                const innerEvent = (eventData as unknown as { data: SSEEvent }).data;
                
                if (innerEvent.type === "entity") {
                  const entity = innerEvent.data;
                  detectedEntities.push(entity);
                  
                  setState((prev) => ({
                    ...prev,
                    entities: [...prev.entities, entity],
                    entityCount: prev.entityCount + 1,
                  }));

                  options?.onEntity?.(entity);
                } else if (innerEvent.type === "stats") {
                  finalStats = innerEvent.data;
                  setState((prev) => ({ ...prev, stats: finalStats }));
                }
              } else if (eventData.type === "done") {
                // Stream complete
                setState((prev) => ({ ...prev, isStreaming: false }));
                
                if (finalStats) {
                  options?.onComplete?.(detectedEntities, finalStats);
                }
              } else if (eventData.type === "error") {
                throw new Error(eventData.message);
              }
            } catch (parseError) {
              console.warn("[useStreamingEntityDetection] Failed to parse SSE event:", parseError);
            }
          }
        }

        return detectedEntities;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Detection was cancelled
          return detectedEntities;
        }

        const errorMessage = error instanceof Error ? error.message : "Detection failed";
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: errorMessage,
        }));
        options?.onError?.(errorMessage);
        throw error;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [cancel]
  );

  /**
   * Reset state to initial
   */
  const reset = useCallback(() => {
    cancel();
    setState({
      entities: [],
      stats: null,
      isStreaming: false,
      error: null,
      entityCount: 0,
    });
  }, [cancel]);

  return {
    ...state,
    detectEntities,
    cancel,
    reset,
  };
}

// ============================================================================
// Alternative: Event-based streaming for more control
// ============================================================================

/**
 * Lower-level streaming detection that yields entities as async iterator.
 * Useful for more complex integration scenarios.
 *
 * @example
 * ```ts
 * for await (const event of streamEntityDetection(text)) {
 *   if (event.type === 'entity') {
 *     console.log('Detected:', event.data.name);
 *   }
 * }
 * ```
 */
export async function* streamEntityDetection(
  text: string,
  existingEntities?: ExistingEntityRef[],
  options?: DetectionOptions,
  signal?: AbortSignal
): AsyncGenerator<SSEEntityEvent | SSEStatsEvent | SSEDoneEvent> {
  const apiKey = getApiKey();

  if (!apiKey || !SUPABASE_URL) {
    throw new Error("API key or Supabase URL not configured");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-detect-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-openrouter-key": apiKey,
    },
    body: JSON.stringify({
      text,
      existingEntities,
      options,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Detection failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      try {
        const eventData = JSON.parse(line.slice(6)) as SSEEvent;

        if (eventData.type === "context") {
          const innerEvent = (eventData as unknown as { data: SSEEvent }).data;
          if (innerEvent.type === "entity" || innerEvent.type === "stats") {
            yield innerEvent;
          }
        } else if (eventData.type === "done") {
          yield eventData;
          return;
        } else if (eventData.type === "error") {
          throw new Error(eventData.message);
        }
      } catch (parseError) {
        console.warn("[streamEntityDetection] Parse error:", parseError);
      }
    }
  }
}
