/**
 * Analysis state store
 * Platform-agnostic writing analysis state
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SceneMetrics, StyleIssue } from "@mythos/core/analysis";

export interface AnalysisState {
  // Metrics
  metrics: SceneMetrics | null;
  issues: StyleIssue[];
  insights: string[];

  // Status
  isAnalyzing: boolean;
  lastAnalyzedHash: string | null;
  lastAnalyzedAt: Date | null;
  error: string | null;

  // Selection
  selectedIssueId: string | null;

  // Actions
  setMetrics: (metrics: SceneMetrics) => void;
  setIssues: (issues: StyleIssue[]) => void;
  setInsights: (insights: string[]) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setLastAnalyzedHash: (hash: string) => void;
  setSelectedIssueId: (id: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  metrics: null,
  issues: [],
  insights: [],
  isAnalyzing: false,
  lastAnalyzedHash: null,
  lastAnalyzedAt: null,
  error: null,
  selectedIssueId: null,
};

export const useAnalysisStore = create<AnalysisState>()(
  immer((set) => ({
    ...initialState,

    setMetrics: (metrics) =>
      set((state) => {
        state.metrics = metrics;
        state.lastAnalyzedAt = new Date();
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

    setLastAnalyzedHash: (hash) =>
      set((state) => {
        state.lastAnalyzedHash = hash;
      }),

    setSelectedIssueId: (id) =>
      set((state) => {
        state.selectedIssueId = id;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isAnalyzing = false;
      }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const useMetrics = () => useAnalysisStore((s) => s.metrics);
export const useTension = () => useAnalysisStore((s) => s.metrics?.tension ?? []);
export const useSensoryBalance = () => useAnalysisStore((s) => s.metrics?.sensory ?? null);
export const usePacing = () => useAnalysisStore((s) => s.metrics?.pacing ?? "steady");
export const useMood = () => useAnalysisStore((s) => s.metrics?.mood ?? "neutral");
export const useShowDontTellScore = () => useAnalysisStore((s) => s.metrics?.showDontTellScore ?? 0);
export const useShowDontTellGrade = () => useAnalysisStore((s) => s.metrics?.showDontTellGrade ?? "C");
export const useStyleIssues = () => useAnalysisStore((s) => s.issues);
export const useInsights = () => useAnalysisStore((s) => s.insights);
export const useIsAnalyzing = () => useAnalysisStore((s) => s.isAnalyzing);
export const useAnalysisError = () => useAnalysisStore((s) => s.error);

// Computed selectors
export const useTotalSensoryCount = () =>
  useAnalysisStore((s) => {
    const sensory = s.metrics?.sensory;
    if (!sensory) return 0;
    return sensory.sight + sensory.sound + sensory.touch + sensory.smell + sensory.taste;
  });

export const useIssueCountByType = () =>
  useAnalysisStore((s) => {
    const counts: Record<string, number> = {};
    s.issues.forEach((issue) => {
      counts[issue.type] = (counts[issue.type] || 0) + 1;
    });
    return counts;
  });
