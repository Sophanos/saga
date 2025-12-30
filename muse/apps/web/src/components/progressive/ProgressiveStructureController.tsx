/**
 * ProgressiveStructureController
 * 
 * Manages progressive disclosure state transitions:
 * - Tracks word count and triggers phase transitions
 * - Detects substantial pastes for entity discovery
 * - Monitors writing time for feature unlock suggestions
 * - Triggers nudges at appropriate moments
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMythosStore } from "../../stores";
import {
  useProgressiveStore,
  useActiveProjectId,
  useActivePhase,
  useIsGardenerMode,
  useIsEntityNudgeSnoozed,
  type EntityDiscoveryNudge,
  type FeatureUnlockNudge,
} from "@mythos/state";
import { useEntityDetection } from "../../hooks/useEntityDetection";
import { setPasteHandler } from "./pasteEvents";

// ============================================================================
// Constants
// ============================================================================

/** Word count threshold to trigger entity detection (Phase 1 -> 2) */
const WORD_COUNT_THRESHOLD = 500;

/** Word count interval for re-running entity detection */
const WORD_COUNT_INTERVAL = 500;

/** Minimum paste length to trigger entity detection */
const MIN_PASTE_LENGTH = 200;

/** Interval for tracking writing time (ms) */
const WRITING_TIME_INTERVAL = 5000;

/** Idle threshold before stopping writing time tracking (ms) */
const IDLE_THRESHOLD = 30000;

/** Throttle interval for word count updates (ms) */
const WORD_COUNT_THROTTLE_MS = 500;

/** Thresholds for feature unlock suggestions */
const UNLOCK_THRESHOLDS = {
  manifest: { writingTimeHours: 0.5 }, // 30 minutes
  console: { writingTimeHours: 1 },    // 1 hour
  world_graph: { characters: 5, writingTimeHours: 2 },
  timeline: { projectAgeDays: 7 },
};

// ============================================================================
// Hook: useWordCount
// ============================================================================

function useWordCount(): number {
  const editorInstance = useMythosStore((s) => s.editor.editorInstance);
  const [wordCount, setWordCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache the last calculated word count to avoid recalculation
  const cachedWordCountRef = useRef<{ text: string; count: number } | null>(null);

  // Calculate word count from editor text with memoization
  const calculateWordCount = useCallback(() => {
    if (!editorInstance) return 0;
    const text = (editorInstance as { getText?: () => string })?.getText?.() ?? "";

    // Return cached value if text hasn't changed
    if (cachedWordCountRef.current && cachedWordCountRef.current.text === text) {
      return cachedWordCountRef.current.count;
    }

    // Calculate and cache
    const words = text.trim().split(/\s+/).filter(Boolean);
    const count = words.length;
    cachedWordCountRef.current = { text, count };
    return count;
  }, [editorInstance]);

  // Subscribe to editor updates with debouncing (only calculate after typing stops)
  useEffect(() => {
    if (!editorInstance) {
      setWordCount(0);
      cachedWordCountRef.current = null;
      return;
    }

    // Initial word count (calculate once on mount)
    setWordCount(calculateWordCount());

    const handleUpdate = () => {
      // Cancel any pending debounced calculation
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce: wait until typing stops for WORD_COUNT_THROTTLE_MS
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        setWordCount(calculateWordCount());
      }, WORD_COUNT_THROTTLE_MS);
    };

    // Subscribe to editor updates
    const editor = editorInstance as {
      on?: (event: string, handler: () => void) => void;
      off?: (event: string, handler: () => void) => void
    };
    editor.on?.("update", handleUpdate);

    return () => {
      editor.off?.("update", handleUpdate);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [editorInstance, calculateWordCount]);

  return wordCount;
}

// ============================================================================
// Hook: useCharacterCount
// ============================================================================

function useCharacterCount(): number {
  const entities = useMythosStore(
    useShallow((s) =>
      Array.from(s.world.entities.values()).filter((e) => e.type === "character")
    )
  );
  return entities.length;
}

// ============================================================================
// Main Controller Component
// ============================================================================

export interface ProgressiveStructureControllerProps {
  /** Called when entity detection completes */
  onEntityDetectionComplete?: () => void;
}

export function ProgressiveStructureController({
  onEntityDetectionComplete,
}: ProgressiveStructureControllerProps) {
  const projectId = useActiveProjectId();
  const phase = useActivePhase();
  const isGardener = useIsGardenerMode();
  const isSnoozed = useIsEntityNudgeSnoozed();
  
  const wordCount = useWordCount();
  const characterCount = useCharacterCount();
  
  const editorInstance = useMythosStore((s) => s.editor.editorInstance);
  const currentProject = useMythosStore((s) => s.project.currentProject);
  
  const {
    setPhase,
    showNudge,
    setLastEntityNudgeWordCount,
    addWritingTime,
  } = useProgressiveStore.getState();

  // Entity detection hook
  const { detectInText } = useEntityDetection({
    enabled: isGardener && phase !== null && phase < 3,
    minLength: 100,
  });

  // Track last activity time for writing time calculation
  const lastActivityRef = useRef<number>(Date.now());

  // ========================================================================
  // Phase 1 -> 2 Transition: Entity Detection on Word Count Threshold
  // ========================================================================

  useEffect(() => {
    if (!isGardener || !projectId || phase !== 1) return;
    if (isSnoozed) return;

    const lastNudgeAt = useProgressiveStore.getState().projects[projectId]?.lastEntityNudgeAtWordCount ?? 0;

    // Check if we've crossed a threshold
    if (wordCount >= WORD_COUNT_THRESHOLD && wordCount >= lastNudgeAt + WORD_COUNT_INTERVAL) {
      // Get plain text from editor for detection
      const text = (editorInstance as { getText?: () => string })?.getText?.() ?? "";
      
      if (text.length > 0) {
        // Run entity detection
        detectInText(text)
          .then(() => {
            // Only transition to Phase 2 if entities were detected
            const pendingEntities = useProgressiveStore.getState().pendingDetectedEntities;
            if (pendingEntities.length > 0) {
              // Transition to Phase 2
              setPhase(projectId, 2);
              setLastEntityNudgeWordCount(projectId, wordCount);

              // Show entity discovery nudge
              const nudge: EntityDiscoveryNudge = {
                id: `${projectId}:entity_discovery:${Date.now()}`,
                projectId,
                type: "entity_discovery",
                createdAt: new Date().toISOString(),
                entities: pendingEntities.map((e) => ({
                  tempId: e.tempId,
                  name: e.name,
                  type: e.type,
                  count: e.occurrences,
                  confidence: e.confidence,
                })),
              };
              showNudge(nudge);

              onEntityDetectionComplete?.();
            }
          })
          .catch((error) => {
            console.error("[ProgressiveStructureController] Entity detection failed:", error);
          });
      }
    }
  }, [
    isGardener,
    projectId,
    phase,
    wordCount,
    isSnoozed,
    editorInstance,
    detectInText,
    setPhase,
    setLastEntityNudgeWordCount,
    showNudge,
    onEntityDetectionComplete,
  ]);

  // ========================================================================
  // Writing Time Tracking with Enhanced Idle Detection
  // ========================================================================

  // Track whether user has been active in the current interval
  const isActiveRef = useRef<boolean>(false);

  // Enhanced activity tracking with multiple event sources
  useEffect(() => {
    if (!editorInstance) return;

    const markActive = () => {
      lastActivityRef.current = Date.now();
      isActiveRef.current = true;
    };

    // Type-safe editor interface
    interface EditorWithEvents {
      on?: (event: string, handler: () => void) => void;
      off?: (event: string, handler: () => void) => void;
      view?: { dom?: HTMLElement };
    }
    const editor = editorInstance as EditorWithEvents;

    // Subscribe to multiple editor events for better activity detection
    editor.on?.("update", markActive);
    editor.on?.("selectionUpdate", markActive);

    // Also track keyboard and mouse events on the editor element
    const editorElement = editor.view?.dom;
    if (editorElement) {
      editorElement.addEventListener("keydown", markActive);
      editorElement.addEventListener("mousedown", markActive);
      editorElement.addEventListener("input", markActive);
    }

    return () => {
      editor.off?.("update", markActive);
      editor.off?.("selectionUpdate", markActive);
      if (editorElement) {
        editorElement.removeEventListener("keydown", markActive);
        editorElement.removeEventListener("mousedown", markActive);
        editorElement.removeEventListener("input", markActive);
      }
    };
  }, [editorInstance]);

  // Interval-based time accumulation with idle detection
  useEffect(() => {
    if (!projectId) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityRef.current;

      // Only count time if user was active recently and in this interval
      if (timeSinceActivity < IDLE_THRESHOLD && isActiveRef.current) {
        addWritingTime(projectId, WRITING_TIME_INTERVAL / 1000);
      }

      // Always reset active flag after checking - user must be active again
      // in the next interval for time to be counted. This prevents over-counting
      // when user is idle but within the IDLE_THRESHOLD window.
      isActiveRef.current = false;
    }, WRITING_TIME_INTERVAL);

    return () => clearInterval(interval);
  }, [projectId, addWritingTime]);

  // ========================================================================
  // Phase 4: Feature Unlock Suggestions
  // ========================================================================

  useEffect(() => {
    if (!isGardener || !projectId || phase !== 4) return;

    const projectState = useProgressiveStore.getState().projects[projectId];
    if (!projectState) return;

    const writingTimeHours = projectState.totalWritingTimeSec / 3600;
    const projectCreatedAt = currentProject?.createdAt;
    const projectAgeDays = projectCreatedAt
      ? (Date.now() - new Date(projectCreatedAt).getTime()) / (1000 * 60 * 60 * 24)
      : 0;

    // Check for world graph unlock
    if (
      !projectState.unlockedModules.world_graph &&
      (characterCount >= UNLOCK_THRESHOLDS.world_graph.characters ||
        writingTimeHours >= UNLOCK_THRESHOLDS.world_graph.writingTimeHours)
    ) {
      const nudge: FeatureUnlockNudge = {
        id: `${projectId}:feature_unlock:world_graph:${Date.now()}`,
        projectId,
        type: "feature_unlock",
        createdAt: new Date().toISOString(),
        module: "world_graph",
        message: `You have ${characterCount} characters. View their relationships in the World Graph.`,
      };
      showNudge(nudge);
    }

    // Check for timeline unlock
    if (
      !projectState.unlockedModules.timeline &&
      projectAgeDays >= UNLOCK_THRESHOLDS.timeline.projectAgeDays
    ) {
      const nudge: FeatureUnlockNudge = {
        id: `${projectId}:feature_unlock:timeline:${Date.now()}`,
        projectId,
        type: "feature_unlock",
        createdAt: new Date().toISOString(),
        module: "timeline",
        message: "Track your story's events chronologically with the Timeline view.",
      };
      showNudge(nudge);
    }
  }, [
    isGardener,
    projectId,
    phase,
    characterCount,
    currentProject,
    showNudge,
  ]);

  // ========================================================================
  // Paste Detection Handler
  // ========================================================================

  const handleSubstantialPaste = useCallback(
    (text: string, _position: number) => {
      if (!isGardener || !projectId) return;
      if (phase !== 1 && phase !== 2) return;
      if (text.length < MIN_PASTE_LENGTH) return;
      if (isSnoozed) return;

      // Run entity detection on pasted text
      detectInText(text)
        .then(() => {
          // Only show nudge and transition phase if entities were detected
          const pendingEntities = useProgressiveStore.getState().pendingDetectedEntities;
          if (pendingEntities.length > 0) {
            if (phase === 1) {
              setPhase(projectId, 2);
            }

            // Show entity discovery nudge
            const nudge: EntityDiscoveryNudge = {
              id: `${projectId}:entity_discovery:paste:${Date.now()}`,
              projectId,
              type: "entity_discovery",
              createdAt: new Date().toISOString(),
              entities: pendingEntities.map((e) => ({
                tempId: e.tempId,
                name: e.name,
                type: e.type,
                count: e.occurrences,
                confidence: e.confidence,
              })),
            };
            showNudge(nudge);

            onEntityDetectionComplete?.();
          }
        })
        .catch((error) => {
          console.error("[ProgressiveStructureController] Paste entity detection failed:", error);
        });
    },
    [
      isGardener,
      projectId,
      phase,
      isSnoozed,
      detectInText,
      setPhase,
      showNudge,
      onEntityDetectionComplete,
    ]
  );

  // Register paste handler via event emitter pattern
  // This replaces the fragile window global with a clean module-based approach
  useEffect(() => {
    const unsubscribe = setPasteHandler(handleSubstantialPaste);
    return unsubscribe;
  }, [handleSubstantialPaste]);

  // This is a controller component - renders nothing
  return null;
}

export default ProgressiveStructureController;
