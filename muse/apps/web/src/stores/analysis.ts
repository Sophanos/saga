import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SceneMetrics, StyleIssue } from "@mythos/core";

/**
 * Analysis store state interface
 */
interface AnalysisState {
  /** Current scene metrics from the writing coach */
  metrics: SceneMetrics | null;
  /** List of detected style issues */
  issues: StyleIssue[];
  /** AI-generated insights about the writing */
  insights: string[];
  /** Whether analysis is currently running */
  isAnalyzing: boolean;
  /** Timestamp of last analysis */
  lastAnalyzedAt: Date | null;
  /** Error message if analysis failed */
  error: string | null;
  /** Hash of the last analyzed content for deduplication */
  lastAnalyzedHash: string | null;
}

/**
 * Analysis store actions interface
 */
interface AnalysisActions {
  /** Set the current scene metrics */
  setMetrics: (metrics: SceneMetrics) => void;
  /** Set the list of style issues */
  setIssues: (issues: StyleIssue[]) => void;
  /** Set the insights array */
  setInsights: (insights: string[]) => void;
  /** Set the analyzing state */
  setAnalyzing: (isAnalyzing: boolean) => void;
  /** Set an error message */
  setError: (error: string | null) => void;
  /** Clear all analysis data */
  clearAnalysis: () => void;
  /** Update all analysis data at once */
  updateAnalysis: (data: {
    metrics: SceneMetrics;
    issues: StyleIssue[];
    insights: string[];
    contentHash?: string;
  }) => void;
  /** Set the last analyzed content hash */
  setLastAnalyzedHash: (hash: string) => void;
}

/**
 * Combined analysis store type
 */
type AnalysisStore = AnalysisState & AnalysisActions;

/**
 * Default metrics for initialization
 */
const defaultMetrics: SceneMetrics = {
  tension: [],
  sensory: {
    sight: 0,
    sound: 0,
    touch: 0,
    smell: 0,
    taste: 0,
  },
  pacing: "steady",
  mood: "neutral",
  showDontTellScore: 50,
  showDontTellGrade: "C",
};

/**
 * Analysis store for writing coach data
 */
export const useAnalysisStore = create<AnalysisStore>()(
  immer((set) => ({
    // Initial state
    metrics: null,
    issues: [],
    insights: [],
    isAnalyzing: false,
    lastAnalyzedAt: null,
    error: null,
    lastAnalyzedHash: null,

    // Actions
    setMetrics: (metrics) =>
      set((state) => {
        state.metrics = metrics;
        state.lastAnalyzedAt = new Date();
        state.error = null;
      }),

    setIssues: (issues) =>
      set((state) => {
        state.issues = issues;
      }),

    setInsights: (insights) =>
      set((state) => {
        state.insights = insights;
      }),

    setAnalyzing: (isAnalyzing) =>
      set((state) => {
        state.isAnalyzing = isAnalyzing;
        if (isAnalyzing) {
          state.error = null;
        }
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isAnalyzing = false;
      }),

    clearAnalysis: () =>
      set((state) => {
        state.metrics = null;
        state.issues = [];
        state.insights = [];
        state.lastAnalyzedAt = null;
        state.error = null;
        state.lastAnalyzedHash = null;
      }),

    updateAnalysis: (data) =>
      set((state) => {
        state.metrics = data.metrics;
        state.issues = data.issues;
        state.insights = data.insights;
        state.lastAnalyzedAt = new Date();
        state.isAnalyzing = false;
        state.error = null;
        if (data.contentHash) {
          state.lastAnalyzedHash = data.contentHash;
        }
      }),

    setLastAnalyzedHash: (hash) =>
      set((state) => {
        state.lastAnalyzedHash = hash;
      }),
  }))
);

// Selectors for individual metrics

/**
 * Get tension array from metrics
 */
export const useTension = () =>
  useAnalysisStore((state) => state.metrics?.tension ?? []);

/**
 * Get sensory balance from metrics
 */
export const useSensoryBalance = () =>
  useAnalysisStore((state) => state.metrics?.sensory ?? defaultMetrics.sensory);

/**
 * Get pacing from metrics
 */
export const usePacing = () =>
  useAnalysisStore((state) => state.metrics?.pacing ?? "steady");

/**
 * Get mood from metrics
 */
export const useMood = () =>
  useAnalysisStore((state) => state.metrics?.mood ?? "neutral");

/**
 * Get show-don't-tell score from metrics
 */
export const useShowDontTellScore = () =>
  useAnalysisStore((state) => state.metrics?.showDontTellScore ?? 50);

/**
 * Get show-don't-tell grade from metrics
 */
export const useShowDontTellGrade = () =>
  useAnalysisStore((state) => state.metrics?.showDontTellGrade ?? "C");

/**
 * Get style issues
 */
export const useStyleIssues = () =>
  useAnalysisStore((state) => state.issues);

/**
 * Get insights
 */
export const useInsights = () =>
  useAnalysisStore((state) => state.insights);

/**
 * Get analyzing state
 */
export const useIsAnalyzing = () =>
  useAnalysisStore((state) => state.isAnalyzing);

/**
 * Get analysis error
 */
export const useAnalysisError = () =>
  useAnalysisStore((state) => state.error);

/**
 * Get total sensory count
 */
export const useTotalSensoryCount = () =>
  useAnalysisStore((state) => {
    const sensory = state.metrics?.sensory;
    if (!sensory) return 0;
    return sensory.sight + sensory.sound + sensory.touch + sensory.smell + sensory.taste;
  });

/**
 * Get issues count by type
 */
export const useIssueCountByType = () =>
  useAnalysisStore((state) => {
    const counts = { telling: 0, passive: 0, adverb: 0, repetition: 0 };
    state.issues.forEach((issue) => {
      counts[issue.type]++;
    });
    return counts;
  });

/**
 * Get last analyzed content hash
 */
export const useLastAnalyzedHash = () =>
  useAnalysisStore((state) => state.lastAnalyzedHash);
