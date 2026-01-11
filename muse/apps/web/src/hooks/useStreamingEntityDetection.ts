/**
 * useStreamingEntityDetection - Progressive Entity Detection Hook
 *
 * Uses Convex action for entity detection with progressive UI feedback.
 * Entities are added one-by-one to the state for visual feedback,
 * simulating streaming behavior.
 *
 * @example
 * ```tsx
 * const { detectEntities, entities, stats, isStreaming, error } = useStreamingEntityDetection();
 *
 * // Start detection
 * await detectEntities(text, projectId, { minConfidence: 0.7 });
 *
 * // Entities appear progressively in `entities` array
 * // Stats available after completion in `stats`
 * ```
 */

import { useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
  DetectedEntity,
  DetectionStats,
  DetectionOptions,
  EntityType,
} from "@mythos/core";

// ============================================================================
// Types
// ============================================================================

export interface StreamingDetectionState {
  /** Entities detected so far (grows as they're added progressively) */
  entities: DetectedEntity[];
  /** Final stats (available after detection completes) */
  stats: DetectionStats | null;
  /** Whether detection is currently in progress */
  isStreaming: boolean;
  /** Error if detection failed */
  error: string | null;
  /** Number of entities detected so far */
  entityCount: number;
}

export interface StreamingDetectionOptions extends DetectionOptions {
  /** Callback fired for each entity as it's added to state */
  onEntity?: (entity: DetectedEntity) => void;
  /** Callback fired when all detection is complete */
  onComplete?: (entities: DetectedEntity[], stats: DetectionStats) => void;
  /** Callback fired on error */
  onError?: (error: string) => void;
  /** Delay between adding entities to state (ms) for visual effect. Default: 50 */
  progressiveDelayMs?: number;
}

export interface ExistingEntityRef {
  id: string;
  name: string;
  aliases: string[];
  type: EntityType;
}

// ============================================================================
// Helper: Convert Convex result to @mythos/core types
// ============================================================================

function toCanonicalName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function mapToDetectedEntity(
  entity: {
    name: string;
    type: string;
    aliases: string[];
    confidence: number;
    properties: Record<string, unknown>;
    textSpan?: { start: number; end: number; text: string };
  },
  index: number
): DetectedEntity {
  return {
    tempId: `temp_${index}`,
    name: entity.name,
    canonicalName: toCanonicalName(entity.name),
    type: entity.type as EntityType,
    confidence: entity.confidence,
    occurrences: entity.textSpan
      ? [
          {
            startOffset: entity.textSpan.start,
            endOffset: entity.textSpan.end,
            matchedText: entity.textSpan.text,
            context: entity.name,
          },
        ]
      : [],
    suggestedAliases: entity.aliases,
    inferredProperties: entity.properties as Record<string, unknown>,
  };
}

function mapToDetectionStats(
  result: { totalFound: number; byType: Record<string, number> },
  textLength: number
): DetectionStats {
  return {
    charactersAnalyzed: textLength,
    totalEntities: result.totalFound,
    byType: result.byType as Record<EntityType, number>,
    matchedToExisting: 0,
    newEntities: result.totalFound,
    processingTimeMs: 0,
  };
}

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

  const abortRef = useRef(false);
  const detectEntitiesAction = useAction(api.ai.detect.detectEntitiesPublic);

  /**
   * Cancel any in-progress detection
   */
  const cancel = useCallback(() => {
    abortRef.current = true;
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  /**
   * Start entity detection with progressive UI feedback
   */
  const detectEntities = useCallback(
    async (
      text: string,
      projectId: Id<"projects">,
      options?: StreamingDetectionOptions
    ): Promise<DetectedEntity[]> => {
      // Cancel any existing detection
      cancel();
      abortRef.current = false;

      // Reset state
      setState({
        entities: [],
        stats: null,
        isStreaming: true,
        error: null,
        entityCount: 0,
      });

      try {
        // Call Convex action
        const result = await detectEntitiesAction({
          text,
          projectId,
          entityTypes: options?.entityTypes,
          minConfidence: options?.minConfidence,
          detectAliases: options?.detectAliases,
          matchExisting: options?.matchExisting,
          maxEntities: options?.maxEntities,
          includeContext: options?.includeContext,
          contextLength: options?.contextLength,
        });

        if (abortRef.current) {
          return [];
        }

        // Map result entities to DetectedEntity type
        const detectedEntities: DetectedEntity[] = result.entities.map((e: {
          name: string;
          type: string;
          aliases: string[];
          confidence: number;
          properties: Record<string, unknown>;
          textSpan?: { start: number; end: number; text: string };
        }, i: number) => mapToDetectedEntity(e, i));

        // Progressive UI feedback - add entities one by one
        const progressiveDelay = options?.progressiveDelayMs ?? 50;

        for (let i = 0; i < detectedEntities.length; i++) {
          if (abortRef.current) break;

          const entity = detectedEntities[i]!;

          setState((prev) => ({
            ...prev,
            entities: [...prev.entities, entity],
            entityCount: prev.entityCount + 1,
          }));

          options?.onEntity?.(entity);

          // Small delay for visual effect
          if (progressiveDelay > 0 && i < detectedEntities.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, progressiveDelay));
          }
        }

        // Create stats
        const stats = mapToDetectionStats(result.stats, text.length);

        setState((prev) => ({
          ...prev,
          stats,
          isStreaming: false,
        }));

        options?.onComplete?.(detectedEntities, stats);
        return detectedEntities;
      } catch (error) {
        if (abortRef.current) {
          return [];
        }

        const errorMessage = error instanceof Error ? error.message : "Detection failed";
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: errorMessage,
        }));
        options?.onError?.(errorMessage);
        throw error;
      }
    },
    [detectEntitiesAction, cancel]
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
// Alternative: Direct action call for simpler use cases
// ============================================================================

/**
 * Direct entity detection without progressive UI.
 * Returns all entities at once.
 */
export async function detectEntitiesSimple(
  detectAction: ReturnType<typeof useAction<typeof api.ai.detect.detectEntitiesPublic>>,
  text: string,
  projectId: Id<"projects">,
  options?: DetectionOptions
): Promise<{ entities: DetectedEntity[]; stats: DetectionStats }> {
  const result = await detectAction({
    text,
    projectId,
    entityTypes: options?.entityTypes,
    minConfidence: options?.minConfidence,
    detectAliases: options?.detectAliases,
    matchExisting: options?.matchExisting,
    maxEntities: options?.maxEntities,
    includeContext: options?.includeContext,
    contextLength: options?.contextLength,
  });

  const entities: DetectedEntity[] = result.entities.map((e: {
    name: string;
    type: string;
    aliases: string[];
    confidence: number;
    properties: Record<string, unknown>;
    textSpan?: { start: number; end: number; text: string };
  }, i: number) => mapToDetectedEntity(e, i));

  const stats = mapToDetectionStats(result.stats, text.length);

  return { entities, stats };
}
