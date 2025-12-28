import { useCallback, useEffect, useRef } from "react";
import { writingCoach } from "@mythos/ai";
import type { SceneMetrics, StyleIssue } from "@mythos/core";
import { useAnalysisStore } from "../stores/analysis";
import { useHistoryStore } from "../stores/history";
import { useMythosStore } from "../stores";
import { simpleHash } from "../utils/hash";
import { persistAnalysisRecord } from "../services/analysis";

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
  } = useAnalysisStore();

  // History store actions
  const addAnalysisRecord = useHistoryStore((state) => state.addAnalysisRecord);

  // Get current project and document for database persistence
  const currentProject = useMythosStore((state) => state.project.currentProject);
  const currentDocument = useMythosStore((state) => state.document.currentDocument);

  // Refs for debouncing
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentRef = useRef<string>("");
  const abortControllerRef = useRef<AbortController | null>(null);

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
      if (currentProject?.id) {
        // Fire and forget - don't block the UI for database persistence
        persistAnalysisRecord({
          projectId: currentProject.id,
          documentId: currentDocument?.id,
          sceneId: contentHash,
          metrics: result.metrics,
          wordCount: content.split(/\s+/).filter(Boolean).length,
        }).catch((err) => {
          // Log but don't fail - local history is already saved
          console.warn("[useWritingAnalysis] Failed to persist to database:", err);
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

  return {
    isAnalyzing,
    metrics,
    issues,
    insights,
    error,
    runAnalysis,
    clearAnalysis,
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
