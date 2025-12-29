import { useCallback, useEffect, useRef, useState } from "react";
import { writingCoach } from "@mythos/ai";
import type { SceneMetrics, StyleIssue } from "@mythos/core";
import { useAnalysisStore } from "../stores/analysis";
import { useHistoryStore } from "../stores/history";
import { useMythosStore } from "../stores";
import { simpleHash } from "../utils/hash";
import { getAnalysisPersistenceQueue, type PersistenceQueueState } from "../services/analysis";

/**
 * Debounce delay in milliseconds before triggering analysis
 */
const DEBOUNCE_DELAY = 1000;

/**
 * Minimum content length to trigger analysis
 */
const MIN_CONTENT_LENGTH = 50;

/**
 * Options for the useWritingAnalysis hook
 */
interface UseWritingAnalysisOptions {
  /** Content to analyze */
  content: string;
  /** Whether auto-analysis is enabled */
  autoAnalyze?: boolean;
  /** Custom debounce delay */
  debounceMs?: number;
  /** Whether the hook is enabled (false disables all analysis) */
  enabled?: boolean;
}

/**
 * Persistence status for tracking pending DB operations
 */
interface PersistenceStatus {
  /** Number of pending persistence operations */
  pendingCount: number;
  /** Number of failed persistence operations */
  failedCount: number;
  /** Whether there are any pending or in-progress operations */
  hasPending: boolean;
  /** Whether there are any failed operations */
  hasFailed: boolean;
  /** Error messages from failed operations */
  errors: string[];
}

/**
 * Return type for the useWritingAnalysis hook
 */
interface UseWritingAnalysisResult {
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Current scene metrics */
  metrics: SceneMetrics | null;
  /** List of detected style issues */
  issues: StyleIssue[];
  /** AI-generated insights */
  insights: string[];
  /** Error message if analysis failed */
  error: string | null;
  /** Manually trigger analysis */
  runAnalysis: () => Promise<void>;
  /** Clear all analysis data */
  clearAnalysis: () => void;
  /** Persistence operation status */
  persistence: PersistenceStatus;
  /** Force-flush all pending persistence operations */
  flushPersistence: () => Promise<{ succeeded: number; failed: number }>;
  /** Retry all failed persistence operations */
  retryFailedPersistence: () => Promise<{ succeeded: number; stillFailed: number }>;
  /** Clear all failed operations (acknowledge data loss) */
  clearFailedPersistence: () => number;
}

/**
 * Hook for managing writing analysis with the Writing Coach AI
 *
 * Features:
 * - Debounced auto-analysis after typing stops
 * - Manual analysis trigger
 * - Integration with analysis store
 * - Error handling
 *
 * @param options - Hook configuration options
 * @returns Analysis state and controls
 */
export function useWritingAnalysis(
  options: UseWritingAnalysisOptions
): UseWritingAnalysisResult {
  const { content, autoAnalyze = true, debounceMs = DEBOUNCE_DELAY, enabled = true } = options;

  // Store state and actions
  const {
    metrics,
    issues,
    insights,
    isAnalyzing,
    error,
    lastAnalyzedHash,
    setAnalyzing,
    setError,
    updateAnalysis,
    clearAnalysis,
    updatePersistenceState,
  } = useAnalysisStore();

  // History store actions
  const addAnalysisRecord = useHistoryStore((state) => state.addAnalysisRecord);

  // Get current project and document for database persistence
  const currentProject = useMythosStore((state) => state.project.currentProject);
  const currentDocument = useMythosStore((state) => state.document.currentDocument);

  // Persistence queue state
  const [persistenceState, setPersistenceState] = useState<PersistenceQueueState>({
    pendingCount: 0,
    failedCount: 0,
    inProgressCount: 0,
    errors: [],
    operations: [],
  });

  // Get the persistence queue singleton
  const queueRef = useRef(getAnalysisPersistenceQueue());

  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set up queue state change listener
  useEffect(() => {
    const queue = queueRef.current;
    const handleStateChange = (state: PersistenceQueueState) => {
      setPersistenceState(state);
      updatePersistenceState({
        pendingCount: state.pendingCount,
        failedCount: state.failedCount,
        inProgressCount: state.inProgressCount,
        persistenceErrors: state.errors,
      });
    };
    queue.setOnStateChange(handleStateChange);
    // Get initial state
    handleStateChange(queue.getState());

    return () => {
      queue.setOnStateChange(null);
    };
  }, [updatePersistenceState]);

  /**
   * Run the writing analysis
   */
  const runAnalysis = useCallback(async () => {
    // Don't analyze if disabled or content is too short
    if (!enabled || content.length < MIN_CONTENT_LENGTH) {
      return;
    }

    // Check if content hash matches last analyzed - skip if same
    const contentHash = simpleHash(content);
    if (contentHash === lastAnalyzedHash) {
      return;
    }

    // Cancel any pending analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    setAnalyzing(true);
    setError(null);

    try {
      const result = await writingCoach.quickAnalyze(content);

      // Check if we were aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      updateAnalysis({
        metrics: result.metrics,
        issues: result.issues,
        insights: result.insights,
        contentHash,
      });

      // Save to history store for historical tracking
      addAnalysisRecord({
        sceneId: contentHash, // Use content hash as scene identifier
        metrics: result.metrics,
      });

      // Persist to database if we have a project context
      // Uses persistence queue with retry logic to prevent data loss
      if (currentProject?.id) {
        queueRef.current.enqueue({
          projectId: currentProject.id,
          documentId: currentDocument?.id,
          sceneId: contentHash,
          metrics: result.metrics,
          wordCount: content.split(/\s+/).filter(Boolean).length,
        });
      }

      // Update last analyzed content
      lastContentRef.current = content;
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      const message = err instanceof Error ? err.message : "Analysis failed";
      setError(message);
      console.error("[useWritingAnalysis] Error:", err);
    } finally {
      setAnalyzing(false);
    }
  }, [content, lastAnalyzedHash, setAnalyzing, setError, updateAnalysis, addAnalysisRecord, currentProject, currentDocument]);

  /**
   * Debounced auto-analysis effect
   */
  useEffect(() => {
    // Skip if disabled or auto-analyze is disabled
    if (!enabled || !autoAnalyze) {
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
      runAnalysis();
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, autoAnalyze, debounceMs, runAnalysis]);

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

  // Persistence control functions
  const flushPersistence = useCallback(async () => {
    return queueRef.current.flush();
  }, []);

  const retryFailedPersistence = useCallback(async () => {
    return queueRef.current.retryFailed();
  }, []);

  const clearFailedPersistence = useCallback(() => {
    return queueRef.current.clearFailed();
  }, []);

  // Compute persistence status
  const persistence: PersistenceStatus = {
    pendingCount: persistenceState.pendingCount,
    failedCount: persistenceState.failedCount,
    hasPending: persistenceState.pendingCount > 0 || persistenceState.inProgressCount > 0,
    hasFailed: persistenceState.failedCount > 0,
    errors: persistenceState.errors,
  };

  return {
    isAnalyzing,
    metrics,
    issues,
    insights,
    error,
    runAnalysis,
    clearAnalysis,
    persistence,
    flushPersistence,
    retryFailedPersistence,
    clearFailedPersistence,
  };
}

/**
 * Hook for accessing analysis store without content binding
 * Useful for components that just need to read analysis data
 */
export function useAnalysisData() {
  const metrics = useAnalysisStore((state) => state.metrics);
  const issues = useAnalysisStore((state) => state.issues);
  const insights = useAnalysisStore((state) => state.insights);
  const isAnalyzing = useAnalysisStore((state) => state.isAnalyzing);
  const error = useAnalysisStore((state) => state.error);

  return { metrics, issues, insights, isAnalyzing, error };
}
