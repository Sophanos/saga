import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { SceneMetrics, StyleIssue, ReadabilityMetrics } from "@mythos/core";

/**
 * Analysis store state interface
 */
interface AnalysisState {
  /** Current scene metrics from the writing coach */
  metrics: SceneMetrics | null;
  /** List of detected style issues (from coach) */
  issues: StyleIssue[];
  /** List of clarity issues (from clarity_check tool) */
  clarityIssues: StyleIssue[];
  /** Readability metrics from clarity analysis */
  readabilityMetrics: ReadabilityMetrics | null;
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
  /** Currently selected style issue ID for navigation/highlighting */
  selectedStyleIssueId: string | null;
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
  /** Dismiss a specific style issue by id */
  dismissStyleIssue: (issueId: string) => void;
  /** Set clarity issues */
  setClarityIssues: (issues: StyleIssue[]) => void;
  /** Set readability metrics */
  setReadabilityMetrics: (metrics: ReadabilityMetrics | null) => void;
  /** Clear all clarity data */
  clearClarity: () => void;
  /** Update all analysis data at once */
  updateAnalysis: (data: {
    metrics: SceneMetrics;
    issues: StyleIssue[];
    insights: string[];
    contentHash?: string;
  }) => void;
  /** Set the last analyzed content hash */
  setLastAnalyzedHash: (hash: string) => void;
  /** Set the currently selected style issue ID */
  setSelectedStyleIssueId: (issueId: string | null) => void;
  /** Select the next style issue in document order */
  selectNextStyleIssue: () => void;
  /** Select the previous style issue in document order */
  selectPreviousStyleIssue: () => void;
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
  immer((set, get) => ({
    // Initial state
    metrics: null,
    issues: [],
    clarityIssues: [],
    readabilityMetrics: null,
    insights: [],
    isAnalyzing: false,
    lastAnalyzedAt: null,
    error: null,
    lastAnalyzedHash: null,
    selectedStyleIssueId: null,

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
        // Clear selection if the selected issue no longer exists
        if (
          state.selectedStyleIssueId &&
          !issues.some((i) => i.id === state.selectedStyleIssueId)
        ) {
          state.selectedStyleIssueId = null;
        }
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
        state.clarityIssues = [];
        state.readabilityMetrics = null;
        state.insights = [];
        state.lastAnalyzedAt = null;
        state.error = null;
        state.lastAnalyzedHash = null;
        state.selectedStyleIssueId = null;
      }),

    dismissStyleIssue: (issueId) =>
      set((state) => {
        // Remove from both issues and clarityIssues
        const inIssues = state.issues.some((i) => i.id === issueId);
        const inClarity = state.clarityIssues.some((i) => i.id === issueId);

        // If dismissing the selected issue, advance to nearest neighbor or clear
        if (state.selectedStyleIssueId === issueId) {
          const allIssues = [...state.issues, ...state.clarityIssues];
          const currentIndex = allIssues.findIndex((i) => i.id === issueId);
          const newIssues = allIssues.filter((i) => i.id !== issueId);
          if (newIssues.length > 0) {
            // Select the next issue, or the previous if we were at the end
            const nextIndex = Math.min(currentIndex, newIssues.length - 1);
            state.selectedStyleIssueId = newIssues[nextIndex].id;
          } else {
            state.selectedStyleIssueId = null;
          }
        }

        if (inIssues) {
          state.issues = state.issues.filter((i) => i.id !== issueId);
        }
        if (inClarity) {
          state.clarityIssues = state.clarityIssues.filter((i) => i.id !== issueId);
        }
      }),

    setClarityIssues: (issues) =>
      set((state) => {
        state.clarityIssues = issues;
        // Clear selection if the selected issue no longer exists in combined list
        if (
          state.selectedStyleIssueId &&
          ![...state.issues, ...issues].some((i) => i.id === state.selectedStyleIssueId)
        ) {
          state.selectedStyleIssueId = null;
        }
      }),

    setReadabilityMetrics: (metrics) =>
      set((state) => {
        state.readabilityMetrics = metrics;
      }),

    clearClarity: () =>
      set((state) => {
        state.clarityIssues = [];
        state.readabilityMetrics = null;
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
        // Clear selection if the selected issue no longer exists
        if (
          state.selectedStyleIssueId &&
          !data.issues.some((i) => i.id === state.selectedStyleIssueId)
        ) {
          state.selectedStyleIssueId = null;
        }
      }),

    setLastAnalyzedHash: (hash) =>
      set((state) => {
        state.lastAnalyzedHash = hash;
      }),

    setSelectedStyleIssueId: (issueId) =>
      set((state) => {
        state.selectedStyleIssueId = issueId;
      }),

    selectNextStyleIssue: () => {
      const { issues, clarityIssues, selectedStyleIssueId } = get();
      const allIssues = [...issues, ...clarityIssues];
      if (allIssues.length === 0) return;

      // Sort issues by line (document order)
      const sortedIssues = [...allIssues].sort(
        (a, b) => (a.line ?? 0) - (b.line ?? 0)
      );

      if (!selectedStyleIssueId) {
        // No selection - select the first issue
        set((state) => {
          state.selectedStyleIssueId = sortedIssues[0].id;
        });
        return;
      }

      const currentIndex = sortedIssues.findIndex(
        (i) => i.id === selectedStyleIssueId
      );
      // Wrap around to first issue if at end
      const nextIndex = (currentIndex + 1) % sortedIssues.length;
      set((state) => {
        state.selectedStyleIssueId = sortedIssues[nextIndex].id;
      });
    },

    selectPreviousStyleIssue: () => {
      const { issues, clarityIssues, selectedStyleIssueId } = get();
      const allIssues = [...issues, ...clarityIssues];
      if (allIssues.length === 0) return;

      // Sort issues by line (document order)
      const sortedIssues = [...allIssues].sort(
        (a, b) => (a.line ?? 0) - (b.line ?? 0)
      );

      if (!selectedStyleIssueId) {
        // No selection - select the last issue
        set((state) => {
          state.selectedStyleIssueId = sortedIssues[sortedIssues.length - 1].id;
        });
        return;
      }

      const currentIndex = sortedIssues.findIndex(
        (i) => i.id === selectedStyleIssueId
      );
      // Wrap around to last issue if at beginning
      const prevIndex =
        (currentIndex - 1 + sortedIssues.length) % sortedIssues.length;
      set((state) => {
        state.selectedStyleIssueId = sortedIssues[prevIndex].id;
      });
    },
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
/**
 * Get combined style issues (coach + clarity)
 */
export const useStyleIssues = () =>
  useAnalysisStore((state) => [...state.issues, ...state.clarityIssues]);

/**
 * Get readability metrics from clarity analysis
 */
export const useReadabilityMetrics = () =>
  useAnalysisStore((state) => state.readabilityMetrics);

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
    const counts: Record<string, number> = {
      telling: 0,
      passive: 0,
      adverb: 0,
      repetition: 0,
      ambiguous_pronoun: 0,
      unclear_antecedent: 0,
      cliche: 0,
      filler_word: 0,
      dangling_modifier: 0,
    };
    [...state.issues, ...state.clarityIssues].forEach((issue) => {
      if (counts[issue.type] !== undefined) {
        counts[issue.type]++;
      }
    });
    return counts;
  });

/**
 * Get last analyzed content hash
 */
export const useLastAnalyzedHash = () =>
  useAnalysisStore((state) => state.lastAnalyzedHash);

/**
 * Get the selected style issue ID
 */
export const useSelectedStyleIssueId = () =>
  useAnalysisStore((state) => state.selectedStyleIssueId);

/**
 * Get the selected style issue object
 */
export const useSelectedStyleIssue = () =>
  useAnalysisStore((state) =>
    state.selectedStyleIssueId
      ? state.issues.find((i) => i.id === state.selectedStyleIssueId) ?? null
      : null
  );
