import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { immer } from "zustand/middleware/immer";
import { persist } from "zustand/middleware";
import type { SceneMetrics } from "@mythos/core";

/**
 * A single analysis record in history
 */
export interface AnalysisRecord {
  /** When the analysis was performed */
  timestamp: Date;
  /** ID of the scene that was analyzed */
  sceneId: string;
  /** The metrics from the analysis */
  metrics: SceneMetrics;
}

/**
 * Session statistics for the current writing session
 */
export interface SessionStats {
  /** Total words written this session */
  wordsWritten: number;
  /** Number of issues fixed this session */
  issuesFixed: number;
  /** Number of analysis runs this session */
  analysisRuns: number;
  /** Session start time */
  sessionStartedAt: Date | null;
}

/**
 * Improvement insight generated from historical data
 */
export interface ImprovementInsight {
  /** Category of insight */
  type: "tension" | "showDontTell" | "sensory" | "general";
  /** The insight message */
  message: string;
  /** Whether this is positive or needs attention */
  sentiment: "positive" | "neutral" | "attention";
}

/**
 * Sync status for database synchronization
 */
export type SyncStatus = "idle" | "syncing" | "synced" | "error";

/**
 * History store state interface
 */
interface HistoryState {
  /** Current project ID for scoped history */
  currentProjectId: string | null;
  /** Historical analysis records */
  analysisHistory: AnalysisRecord[];
  /** Current session statistics */
  sessionStats: SessionStats;
  /** Maximum number of records to keep */
  maxHistorySize: number;
  /** Database sync status */
  syncStatus: SyncStatus;
  /** Sync error message if any */
  syncError: string | null;
}

/**
 * History store actions interface
 */
interface HistoryActions {
  /** Add a new analysis record to history */
  addAnalysisRecord: (record: Omit<AnalysisRecord, "timestamp">) => void;
  /** Hydrate history with records from database */
  hydrateHistory: (projectId: string, records: AnalysisRecord[]) => void;
  /** Set sync status */
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  /** Set current project ID */
  setCurrentProjectId: (projectId: string | null) => void;
  /** Increment a session stat */
  incrementStat: (stat: keyof Omit<SessionStats, "sessionStartedAt">) => void;
  /** Add to words written count */
  addWordsWritten: (count: number) => void;
  /** Get trend data for a specific metric */
  getMetricsTrend: (metricKey: "tension" | "showDontTell" | "sensory") => number[];
  /** Get average tension over history */
  getAverageTension: () => number;
  /** Get show-dont-tell score trend */
  getShowDontTellTrend: () => number[];
  /** Get sensory balance averages */
  getSensoryTrends: () => { sight: number[]; sound: number[]; touch: number[]; smell: number[]; taste: number[] };
  /** Generate improvement insights from historical data */
  generateInsights: () => ImprovementInsight[];
  /** Clear all history */
  clearHistory: () => void;
  /** Reset session stats */
  resetSessionStats: () => void;
  /** Start a new session */
  startSession: () => void;
}

/**
 * Combined history store type
 */
type HistoryStore = HistoryState & HistoryActions;

/**
 * Default session stats
 */
const defaultSessionStats: SessionStats = {
  wordsWritten: 0,
  issuesFixed: 0,
  analysisRuns: 0,
  sessionStartedAt: null,
};

/**
 * History store for tracking analysis metrics over time
 * Uses persist middleware to save data across sessions
 */
export const useHistoryStore = create<HistoryStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      currentProjectId: null,
      analysisHistory: [],
      sessionStats: { ...defaultSessionStats },
      maxHistorySize: 100,
      syncStatus: "idle" as SyncStatus,
      syncError: null,

      // Actions
      addAnalysisRecord: (record) =>
        set((state) => {
          const newRecord: AnalysisRecord = {
            ...record,
            timestamp: new Date(),
          };
          state.analysisHistory.push(newRecord);

          // Trim history if it exceeds max size
          if (state.analysisHistory.length > state.maxHistorySize) {
            state.analysisHistory = state.analysisHistory.slice(-state.maxHistorySize);
          }

          // Increment analysis runs
          state.sessionStats.analysisRuns++;
        }),

      hydrateHistory: (projectId, records) =>
        set((state) => {
          state.currentProjectId = projectId;
          // Merge with existing records, avoiding duplicates by sceneId+timestamp
          const existingKeys = new Set(
            state.analysisHistory.map((r) => `${r.sceneId}-${r.timestamp.getTime()}`)
          );
          const newRecords = records.filter(
            (r) => !existingKeys.has(`${r.sceneId}-${r.timestamp.getTime()}`)
          );
          // Prepend DB records (they're older) and sort by timestamp
          state.analysisHistory = [...newRecords, ...state.analysisHistory]
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .slice(-state.maxHistorySize);
          state.syncStatus = "synced";
          state.syncError = null;
        }),

      setSyncStatus: (status, error = null) =>
        set((state) => {
          state.syncStatus = status;
          state.syncError = error ?? null;
        }),

      setCurrentProjectId: (projectId) =>
        set((state) => {
          // Clear history when switching projects
          if (projectId !== state.currentProjectId) {
            state.analysisHistory = [];
            state.syncStatus = "idle";
            state.syncError = null;
          }
          state.currentProjectId = projectId;
        }),

      incrementStat: (stat) =>
        set((state) => {
          state.sessionStats[stat]++;
        }),

      addWordsWritten: (count) =>
        set((state) => {
          state.sessionStats.wordsWritten += count;
        }),

      getMetricsTrend: (metricKey) => {
        const { analysisHistory } = get();

        switch (metricKey) {
          case "tension":
            return analysisHistory.map((record) => {
              const tensions = record.metrics.tension;
              if (tensions.length === 0) return 0;
              return tensions.reduce((a, b) => a + b, 0) / tensions.length;
            });
          case "showDontTell":
            return analysisHistory.map((record) => record.metrics.showDontTellScore);
          case "sensory":
            return analysisHistory.map((record) => {
              const s = record.metrics.sensory;
              return s.sight + s.sound + s.touch + s.smell + s.taste;
            });
          default:
            return [];
        }
      },

      getAverageTension: () => {
        const { analysisHistory } = get();
        if (analysisHistory.length === 0) return 0;

        const allTensions = analysisHistory.flatMap((r) => r.metrics.tension);
        if (allTensions.length === 0) return 0;

        return allTensions.reduce((a, b) => a + b, 0) / allTensions.length;
      },

      getShowDontTellTrend: () => {
        const { analysisHistory } = get();
        return analysisHistory.map((r) => r.metrics.showDontTellScore);
      },

      getSensoryTrends: () => {
        const { analysisHistory } = get();
        return {
          sight: analysisHistory.map((r) => r.metrics.sensory.sight),
          sound: analysisHistory.map((r) => r.metrics.sensory.sound),
          touch: analysisHistory.map((r) => r.metrics.sensory.touch),
          smell: analysisHistory.map((r) => r.metrics.sensory.smell),
          taste: analysisHistory.map((r) => r.metrics.sensory.taste),
        };
      },

      generateInsights: () => {
        const { analysisHistory } = get();
        const insights: ImprovementInsight[] = [];

        if (analysisHistory.length < 2) {
          insights.push({
            type: "general",
            message: "Keep writing to build up analysis history and see trends in your work.",
            sentiment: "neutral",
          });
          return insights;
        }

        // Compare recent vs older data
        const recentCount = Math.min(5, Math.floor(analysisHistory.length / 2));
        const recentRecords = analysisHistory.slice(-recentCount);
        const olderRecords = analysisHistory.slice(0, recentCount);

        // Tension trend analysis
        const recentAvgTension = recentRecords.flatMap((r) => r.metrics.tension);
        const olderAvgTension = olderRecords.flatMap((r) => r.metrics.tension);

        if (recentAvgTension.length > 0 && olderAvgTension.length > 0) {
          const recentTensionAvg = recentAvgTension.reduce((a, b) => a + b, 0) / recentAvgTension.length;
          const olderTensionAvg = olderAvgTension.reduce((a, b) => a + b, 0) / olderAvgTension.length;
          const tensionDiff = recentTensionAvg - olderTensionAvg;

          if (tensionDiff > 10) {
            insights.push({
              type: "tension",
              message: "Your scenes have become more tense recently - great for building towards a climax!",
              sentiment: "positive",
            });
          } else if (tensionDiff < -10) {
            insights.push({
              type: "tension",
              message: "Tension has decreased in recent scenes. Consider adding conflict or stakes.",
              sentiment: "attention",
            });
          }
        }

        // Show-don't-tell trend analysis
        const recentSDT = recentRecords.map((r) => r.metrics.showDontTellScore);
        const olderSDT = olderRecords.map((r) => r.metrics.showDontTellScore);

        if (recentSDT.length > 0 && olderSDT.length > 0) {
          const recentSDTAvg = recentSDT.reduce((a, b) => a + b, 0) / recentSDT.length;
          const olderSDTAvg = olderSDT.reduce((a, b) => a + b, 0) / olderSDT.length;
          const sdtDiff = recentSDTAvg - olderSDTAvg;

          if (sdtDiff > 5) {
            insights.push({
              type: "showDontTell",
              message: "Your 'show don't tell' quality has improved! Keep using vivid, action-based descriptions.",
              sentiment: "positive",
            });
          } else if (sdtDiff < -5) {
            insights.push({
              type: "showDontTell",
              message: "Recent writing has more 'telling'. Try converting explanations into actions and sensory details.",
              sentiment: "attention",
            });
          }
        }

        // Sensory balance analysis
        const recentSensory = recentRecords.map((r) => r.metrics.sensory);
        if (recentSensory.length > 0) {
          const avgSensory = {
            sight: recentSensory.reduce((a, b) => a + b.sight, 0) / recentSensory.length,
            sound: recentSensory.reduce((a, b) => a + b.sound, 0) / recentSensory.length,
            touch: recentSensory.reduce((a, b) => a + b.touch, 0) / recentSensory.length,
            smell: recentSensory.reduce((a, b) => a + b.smell, 0) / recentSensory.length,
            taste: recentSensory.reduce((a, b) => a + b.taste, 0) / recentSensory.length,
          };

          const weakSenses = Object.entries(avgSensory)
            .filter(([, value]) => value < 1)
            .map(([key]) => key);

          if (weakSenses.length >= 3) {
            insights.push({
              type: "sensory",
              message: `Consider adding more ${weakSenses.join(", ")} details to create a richer sensory experience.`,
              sentiment: "attention",
            });
          }

          const strongSenses = Object.entries(avgSensory)
            .filter(([, value]) => value >= 3)
            .map(([key]) => key);

          if (strongSenses.length >= 2) {
            insights.push({
              type: "sensory",
              message: `Great use of ${strongSenses.join(" and ")} in your descriptions!`,
              sentiment: "positive",
            });
          }
        }

        // General progress insight
        if (insights.length === 0) {
          insights.push({
            type: "general",
            message: "Your writing metrics are staying consistent. Keep up the steady work!",
            sentiment: "neutral",
          });
        }

        return insights;
      },

      clearHistory: () =>
        set((state) => {
          state.analysisHistory = [];
        }),

      resetSessionStats: () =>
        set((state) => {
          state.sessionStats = { ...defaultSessionStats };
        }),

      startSession: () =>
        set((state) => {
          state.sessionStats = {
            ...defaultSessionStats,
            sessionStartedAt: new Date(),
          };
        }),
    })),
    {
      name: "mythos-history-storage",
      // Custom serialization to handle Date objects
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const data = JSON.parse(str);
          // Rehydrate dates
          if (data.state?.analysisHistory) {
            data.state.analysisHistory = data.state.analysisHistory.map(
              (record: { timestamp: string } & Omit<AnalysisRecord, "timestamp">) => ({
                ...record,
                timestamp: new Date(record.timestamp),
              })
            );
          }
          if (data.state?.sessionStats?.sessionStartedAt) {
            data.state.sessionStats.sessionStartedAt = new Date(
              data.state.sessionStats.sessionStartedAt
            );
          }
          return data;
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          localStorage.removeItem(name);
        },
      },
    }
  )
);

// Selectors

/**
 * Get analysis history
 */
export const useAnalysisHistory = () =>
  useHistoryStore(useShallow((state) => state.analysisHistory));

/**
 * Get session stats
 */
export const useSessionStats = () =>
  useHistoryStore(useShallow((state) => state.sessionStats));

/**
 * Get history record count
 */
export const useHistoryCount = () =>
  useHistoryStore((state) => state.analysisHistory.length);

/**
 * Get the most recent analysis record
 */
export const useLatestAnalysis = () =>
  useHistoryStore(
    useShallow((state) =>
      state.analysisHistory.length > 0
        ? state.analysisHistory[state.analysisHistory.length - 1]
        : null
    )
  );

/**
 * Get analysis records for a specific scene
 */
export const useSceneHistory = (sceneId: string) =>
  useHistoryStore(
    useShallow((state) =>
      state.analysisHistory.filter((r) => r.sceneId === sceneId)
    )
  );

/**
 * Check if session is active
 */
export const useIsSessionActive = () =>
  useHistoryStore((state) => state.sessionStats.sessionStartedAt !== null);

/**
 * Get sync status
 */
export const useSyncStatus = () =>
  useHistoryStore((state) => state.syncStatus);

/**
 * Get sync error
 */
export const useSyncError = () =>
  useHistoryStore((state) => state.syncError);

/**
 * Get current project ID
 */
export const useCurrentProjectId = () =>
  useHistoryStore((state) => state.currentProjectId);

/**
 * Check if history is syncing
 */
export const useIsSyncing = () =>
  useHistoryStore((state) => state.syncStatus === "syncing");

/**
 * Check if history is synced
 */
export const useIsSynced = () =>
  useHistoryStore((state) => state.syncStatus === "synced");
