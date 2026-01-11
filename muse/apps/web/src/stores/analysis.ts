import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import type { SceneMetrics, StyleIssue, ReadabilityMetrics } from "@mythos/core";

/**
 * Coach mode types for Writing / Clarity / Policy modes
 */
export type CoachMode = "writing" | "clarity" | "policy";

/**
 * Persistence operation state for tracking pending DB operations
 */
interface PersistenceState {
  /** Number of pending persistence operations */
  pendingCount: number;
  /** Number of failed persistence operations */
  failedCount: number;
  /** Number of in-progress persistence operations */
  inProgressCount: number;
  /** Error messages from failed operations */
  persistenceErrors: string[];
}

/**
 * Policy compliance metrics from policy_check tool
 */
export interface PolicyComplianceMetrics {
  score: number;
  policiesChecked: number;
  conflictsFound: number;
}

/**
 * Analysis store state interface
 */
interface AnalysisState {
  /** Current coach mode (writing/clarity/policy) */
  coachMode: CoachMode;
  /** Current scene metrics from the writing coach */
  metrics: SceneMetrics | null;
  /** List of detected style issues (from coach) */
  issues: StyleIssue[];
  /** List of clarity issues (from clarity_check tool) */
  clarityIssues: StyleIssue[];
  /** List of policy issues (from policy_check tool) */
  policyIssues: StyleIssue[];
  /** Policy compliance metrics */
  policyCompliance: PolicyComplianceMetrics | null;
  /** Summary from policy check */
  policySummary: string | null;
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
  /** Persistence operation tracking state */
  persistence: PersistenceState;
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
  /** Set coach mode (writing/clarity/policy) */
  setCoachMode: (mode: CoachMode) => void;
  /** Set policy issues */
  setPolicyIssues: (issues: StyleIssue[]) => void;
  /** Set policy compliance metrics */
  setPolicyCompliance: (metrics: PolicyComplianceMetrics | null) => void;
  /** Set policy summary */
  setPolicySummary: (summary: string | null) => void;
  /** Clear all policy data */
  clearPolicy: () => void;
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
  /** Update persistence state from queue */
  updatePersistenceState: (state: PersistenceState) => void;
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
    coachMode: "writing" as CoachMode,
    metrics: null,
    issues: [],
    clarityIssues: [],
    policyIssues: [],
    policyCompliance: null,
    policySummary: null,
    readabilityMetrics: null,
    insights: [],
    isAnalyzing: false,
    lastAnalyzedAt: null,
    error: null,
    lastAnalyzedHash: null,
    selectedStyleIssueId: null,
    persistence: {
      pendingCount: 0,
      failedCount: 0,
      inProgressCount: 0,
      persistenceErrors: [],
    },

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
        state.coachMode = "writing";
        state.metrics = null;
        state.issues = [];
        state.clarityIssues = [];
        state.policyIssues = [];
        state.policyCompliance = null;
        state.policySummary = null;
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

    setCoachMode: (mode) =>
      set((state) => {
        state.coachMode = mode;
      }),

    setPolicyIssues: (issues) =>
      set((state) => {
        state.policyIssues = issues;
        // Clear selection if the selected issue no longer exists in combined list
        if (
          state.selectedStyleIssueId &&
          ![...state.issues, ...state.clarityIssues, ...issues].some(
            (i) => i.id === state.selectedStyleIssueId
          )
        ) {
          state.selectedStyleIssueId = null;
        }
      }),

    setPolicyCompliance: (metrics) =>
      set((state) => {
        state.policyCompliance = metrics;
      }),

    setPolicySummary: (summary) =>
      set((state) => {
        state.policySummary = summary;
      }),

    clearPolicy: () =>
      set((state) => {
        state.policyIssues = [];
        state.policyCompliance = null;
        state.policySummary = null;
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
      const { issues, clarityIssues, policyIssues, selectedStyleIssueId } = get();
      const allIssues = [...issues, ...clarityIssues, ...policyIssues];
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
      const { issues, clarityIssues, policyIssues, selectedStyleIssueId } = get();
      const allIssues = [...issues, ...clarityIssues, ...policyIssues];
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

    updatePersistenceState: (persistenceState) =>
      set((state) => {
        state.persistence = persistenceState;
      }),
  }))
);

// Selectors for individual metrics

/**
 * Get tension array from metrics
 */
export const useTension = () =>
  useAnalysisStore(useShallow((state) => state.metrics?.tension ?? []));

/**
 * Get sensory balance from metrics
 */
export const useSensoryBalance = () =>
  useAnalysisStore(
    useShallow((state) => state.metrics?.sensory ?? defaultMetrics.sensory)
  );

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
  useAnalysisStore(
    useShallow((state) => [...state.issues, ...state.clarityIssues, ...state.policyIssues])
  );

/**
 * Get current coach mode
 */
export const useCoachMode = () =>
  useAnalysisStore((state) => state.coachMode);

/**
 * Get policy issues
 */
export const usePolicyIssues = () =>
  useAnalysisStore(useShallow((state) => state.policyIssues));

/**
 * Get policy compliance metrics
 */
export const usePolicyCompliance = () =>
  useAnalysisStore(useShallow((state) => state.policyCompliance));

/**
 * Get policy summary
 */
export const usePolicySummary = () =>
  useAnalysisStore((state) => state.policySummary);

/**
 * Get readability metrics from clarity analysis
 */
export const useReadabilityMetrics = () =>
  useAnalysisStore(useShallow((state) => state.readabilityMetrics));

/**
 * Get insights
 */
export const useInsights = () =>
  useAnalysisStore(useShallow((state) => state.insights));

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
      // Writing coach types
      telling: 0,
      passive: 0,
      adverb: 0,
      repetition: 0,
      // Clarity types
      ambiguous_pronoun: 0,
      unclear_antecedent: 0,
      cliche: 0,
      filler_word: 0,
      dangling_modifier: 0,
      // Policy types
      policy_conflict: 0,
      unverifiable: 0,
      not_testable: 0,
      policy_gap: 0,
    };
    [...state.issues, ...state.clarityIssues, ...state.policyIssues].forEach((issue) => {
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
  useAnalysisStore((state) => {
    if (!state.selectedStyleIssueId) return null;
    const allIssues = [...state.issues, ...state.clarityIssues, ...state.policyIssues];
    return allIssues.find((i) => i.id === state.selectedStyleIssueId) ?? null;
  });

/**
 * Get the persistence state
 */
export const usePersistenceState = () =>
  useAnalysisStore(useShallow((state) => state.persistence));

/**
 * Check if there are pending persistence operations
 */
export const useHasPendingPersistence = () =>
  useAnalysisStore(
    (state) => state.persistence.pendingCount > 0 || state.persistence.inProgressCount > 0
  );

/**
 * Check if there are failed persistence operations
 */
export const useHasFailedPersistence = () =>
  useAnalysisStore((state) => state.persistence.failedCount > 0);

/**
 * Get persistence errors
 */
export const usePersistenceErrors = () =>
  useAnalysisStore(useShallow((state) => state.persistence.persistenceErrors));
