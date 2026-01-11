/**
 * Flow Mode Store - Distraction-free writing environment
 *
 * Inspired by iA Writer Focus Mode with sentence/paragraph dimming,
 * typewriter scrolling, and session tracking.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createStorageAdapter } from '@mythos/storage';

// ============================================================================
// TYPES
// ============================================================================

export type FocusLevel = 'none' | 'sentence' | 'paragraph';
export type TimerMode = 'pomodoro' | 'sprint' | 'custom' | 'none';
export type TimerState = 'idle' | 'running' | 'paused' | 'break';

export interface FlowPreferences {
  /** Focus level for text dimming */
  focusLevel: FocusLevel;
  /** Opacity for dimmed text (0-1) */
  dimOpacity: number;
  /** Keep cursor vertically centered */
  typewriterScrolling: boolean;
  /** Default timer mode */
  defaultTimerMode: TimerMode;
  /** Work duration in minutes */
  workDurationMin: number;
  /** Break duration in minutes */
  breakDurationMin: number;
  /** Session word goal (null = no goal) */
  sessionWordGoal: number | null;
  /** Auto-collapse panels when entering flow mode */
  autoCollapseOnEnter: boolean;
  /** Show summary modal on exit */
  showSummaryOnExit: boolean;
}

export interface FlowSession {
  /** Session start time (epoch ms) */
  startedAtMs: number;
  /** Words at session start */
  startingWordCount: number;
  /** Current word count */
  currentWordCount: number;
  /** Number of completed work periods */
  completedPomodoros: number;
  /** Total focused time in seconds */
  totalFocusedSeconds: number;
}

export interface FlowTimerData {
  mode: TimerMode;
  state: TimerState;
  /** Remaining seconds in current period */
  remainingSeconds: number;
  /** Is this a break period? */
  isBreak: boolean;
  /** User's selected duration in minutes */
  selectedDurationMin: number;
  /** Domain flag: true when threshold reached, UI decides what to show */
  shouldAutoReveal: boolean;
  /** Auto-reveal threshold in minutes (2/5/10) */
  revealThresholdMin: number;
  /** Last tick timestamp for drift correction (epoch ms) */
  lastTickAtMs: number | null;
}

export interface SessionStats {
  /** Session start time (epoch ms) */
  startedAtMs: number;
  /** Session end time (epoch ms) */
  endedAtMs: number;
  /** Total duration in seconds */
  durationSeconds: number;
  /** Words written during session */
  wordsWritten: number;
  /** Completed pomodoros */
  completedPomodoros: number;
}

interface FlowState {
  // Core state
  enabled: boolean;
  preferences: FlowPreferences;
  session: FlowSession | null;
  timer: FlowTimerData;

  // History (last 10 sessions)
  recentSessions: SessionStats[];

  // Actions - Core
  enterFlowMode: (startingWordCount?: number) => void;
  exitFlowMode: () => SessionStats | null;
  toggleFlowMode: (startingWordCount?: number) => void;

  // Actions - Preferences
  setFocusLevel: (level: FocusLevel) => void;
  setDimOpacity: (opacity: number) => void;
  setTypewriterScrolling: (enabled: boolean) => void;
  updatePreferences: (updates: Partial<FlowPreferences>) => void;

  // Actions - Timer
  startTimer: (mode?: TimerMode) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  tickTimer: () => void;
  skipToBreak: () => void;
  skipBreak: () => void;
  setSelectedDuration: (minutes: number) => void;
  setRevealThreshold: (minutes: number) => void;

  // Actions - Session
  updateWordCount: (count: number) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_PREFERENCES: FlowPreferences = {
  focusLevel: 'paragraph',
  dimOpacity: 0.3,
  typewriterScrolling: true,
  defaultTimerMode: 'pomodoro',
  workDurationMin: 25,
  breakDurationMin: 5,
  sessionWordGoal: null,
  autoCollapseOnEnter: true,
  showSummaryOnExit: true,
};

const DEFAULT_TIMER: FlowTimerData = {
  mode: 'none',
  state: 'idle',
  remainingSeconds: 0,
  isBreak: false,
  selectedDurationMin: 25,
  shouldAutoReveal: false,
  revealThresholdMin: 5,
  lastTickAtMs: null,
};

const initialState = {
  enabled: false,
  preferences: DEFAULT_PREFERENCES,
  session: null as FlowSession | null,
  timer: DEFAULT_TIMER,
  recentSessions: [] as SessionStats[],
};

// ============================================================================
// STORE
// ============================================================================

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================
      // Core Actions
      // ========================================

      enterFlowMode: (startingWordCount = 0) => {
        const { preferences, timer } = get();
        set({
          enabled: true,
          session: {
            startedAtMs: Date.now(),
            startingWordCount,
            currentWordCount: startingWordCount,
            completedPomodoros: 0,
            totalFocusedSeconds: 0,
          },
          timer: {
            mode: preferences.defaultTimerMode,
            state: 'idle',
            remainingSeconds: timer.selectedDurationMin * 60,
            isBreak: false,
            selectedDurationMin: timer.selectedDurationMin,
            shouldAutoReveal: false,
            revealThresholdMin: timer.revealThresholdMin,
            lastTickAtMs: null,
          },
        });
      },

      exitFlowMode: () => {
        const { session, recentSessions } = get();

        let stats: SessionStats | null = null;

        if (session) {
          const now = Date.now();
          const durationSeconds = Math.floor((now - session.startedAtMs) / 1000);

          stats = {
            startedAtMs: session.startedAtMs,
            endedAtMs: now,
            durationSeconds,
            wordsWritten: session.currentWordCount - session.startingWordCount,
            completedPomodoros: session.completedPomodoros,
          };

          // Add to recent sessions (keep last 10)
          const updatedSessions = [stats, ...recentSessions].slice(0, 10);

          set({
            enabled: false,
            session: null,
            timer: DEFAULT_TIMER,
            recentSessions: updatedSessions,
          });
        } else {
          set({
            enabled: false,
            session: null,
            timer: DEFAULT_TIMER,
          });
        }

        return stats;
      },

      toggleFlowMode: (startingWordCount) => {
        const { enabled, enterFlowMode, exitFlowMode } = get();
        if (enabled) {
          exitFlowMode();
        } else {
          enterFlowMode(startingWordCount);
        }
      },

      // ========================================
      // Preference Actions
      // ========================================

      setFocusLevel: (level) =>
        set((s) => ({
          preferences: { ...s.preferences, focusLevel: level },
        })),

      setDimOpacity: (opacity) =>
        set((s) => ({
          preferences: { ...s.preferences, dimOpacity: Math.max(0.1, Math.min(0.9, opacity)) },
        })),

      setTypewriterScrolling: (enabled) =>
        set((s) => ({
          preferences: { ...s.preferences, typewriterScrolling: enabled },
        })),

      updatePreferences: (updates) =>
        set((s) => ({
          preferences: { ...s.preferences, ...updates },
        })),

      // ========================================
      // Timer Actions
      // ========================================

      startTimer: (mode) => {
        const { preferences, timer } = get();
        const timerMode = mode ?? preferences.defaultTimerMode;

        if (timerMode === 'none') return;

        set({
          timer: {
            ...timer,
            mode: timerMode,
            state: 'running',
            remainingSeconds: timer.state === 'paused' ? timer.remainingSeconds : timer.selectedDurationMin * 60,
            isBreak: false,
            shouldAutoReveal: false,
            lastTickAtMs: Date.now(),
          },
        });
      },

      pauseTimer: () =>
        set((s) => ({
          timer: { ...s.timer, state: 'paused', lastTickAtMs: null },
        })),

      resumeTimer: () =>
        set((s) => ({
          timer: { ...s.timer, state: 'running', lastTickAtMs: Date.now() },
        })),

      resetTimer: () => {
        const { preferences, timer } = get();
        set({
          timer: {
            ...timer,
            mode: preferences.defaultTimerMode,
            state: 'idle',
            remainingSeconds: timer.selectedDurationMin * 60,
            isBreak: false,
            shouldAutoReveal: false,
            lastTickAtMs: null,
          },
        });
      },

      tickTimer: () => {
        const { timer, session, preferences } = get();

        // FIX: Allow both 'running' AND 'break' states to countdown
        const isCountingDown = timer.state === 'running' || timer.state === 'break';
        if (!isCountingDown || timer.remainingSeconds <= 0) return;

        // FIX: Calculate actual elapsed time to handle background tab drift
        const now = Date.now();
        const deltaSec = timer.lastTickAtMs
          ? Math.max(1, Math.floor((now - timer.lastTickAtMs) / 1000))
          : 1;

        const newRemaining = Math.max(0, timer.remainingSeconds - deltaSec);
        const thresholdSeconds = timer.revealThresholdMin * 60;

        // Set shouldAutoReveal when threshold is reached (domain flag)
        const newShouldAutoReveal = timer.shouldAutoReveal ||
          (newRemaining <= thresholdSeconds && newRemaining > 0);

        // Timer completed
        if (newRemaining <= 0) {
          if (timer.isBreak) {
            // Break ended, start new work period
            set({
              timer: {
                ...timer,
                state: 'idle',
                remainingSeconds: timer.selectedDurationMin * 60,
                isBreak: false,
                shouldAutoReveal: false,
                lastTickAtMs: null,
              },
            });
          } else {
            // Work period ended, start break (auto-starts countdown)
            const newPomodoros = (session?.completedPomodoros ?? 0) + 1;
            set({
              timer: {
                ...timer,
                state: 'break',
                remainingSeconds: preferences.breakDurationMin * 60,
                isBreak: true,
                shouldAutoReveal: true, // Always reveal at break start
                lastTickAtMs: now,
              },
              session: session ? {
                ...session,
                completedPomodoros: newPomodoros,
                totalFocusedSeconds: session.totalFocusedSeconds + timer.selectedDurationMin * 60,
              } : null,
            });
          }
        } else {
          set({
            timer: {
              ...timer,
              remainingSeconds: newRemaining,
              shouldAutoReveal: newShouldAutoReveal,
              lastTickAtMs: now,
            },
          });
        }
      },

      skipToBreak: () => {
        const { preferences, session, timer } = get();
        set({
          timer: {
            ...timer,
            mode: 'pomodoro',
            state: 'break',
            remainingSeconds: preferences.breakDurationMin * 60,
            isBreak: true,
            shouldAutoReveal: true,
            lastTickAtMs: Date.now(),
          },
          session: session ? {
            ...session,
            completedPomodoros: session.completedPomodoros + 1,
          } : null,
        });
      },

      skipBreak: () => {
        const { timer } = get();
        set({
          timer: {
            ...timer,
            mode: 'pomodoro',
            state: 'idle',
            remainingSeconds: timer.selectedDurationMin * 60,
            isBreak: false,
            shouldAutoReveal: false,
            lastTickAtMs: null,
          },
        });
      },

      setSelectedDuration: (minutes) => {
        set((s) => ({
          timer: {
            ...s.timer,
            selectedDurationMin: Math.max(5, Math.min(60, minutes)),
            remainingSeconds: s.timer.state === 'idle' ? minutes * 60 : s.timer.remainingSeconds,
          },
        }));
      },

      setRevealThreshold: (minutes) => {
        set((s) => ({
          timer: {
            ...s.timer,
            revealThresholdMin: minutes,
          },
        }));
      },

      // ========================================
      // Session Actions
      // ========================================

      updateWordCount: (count) =>
        set((s) => ({
          session: s.session ? { ...s.session, currentWordCount: count } : null,
        })),

      // ========================================
      // Reset
      // ========================================

      reset: () => set(initialState),
    }),
    {
      name: 'mythos-flow',
      storage: createJSONStorage(() => createStorageAdapter()),
      partialize: (state) => ({
        preferences: state.preferences,
        recentSessions: state.recentSessions,
      }),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const useFlowEnabled = () => useFlowStore((s) => s.enabled);
export const useFlowPreferences = () => useFlowStore((s) => s.preferences);
export const useFlowSession = () => useFlowStore((s) => s.session);
export const useFlowTimer = () => useFlowStore((s) => s.timer);
export const useFocusLevel = () => useFlowStore((s) => s.preferences.focusLevel);
export const useDimOpacity = () => useFlowStore((s) => s.preferences.dimOpacity);
export const useTypewriterScrolling = () => useFlowStore((s) => s.preferences.typewriterScrolling);
export const useRecentFlowSessions = () => useFlowStore((s) => s.recentSessions);

/** Get words written in current session */
export const useSessionWordsWritten = () =>
  useFlowStore((s) =>
    s.session
      ? s.session.currentWordCount - s.session.startingWordCount
      : 0
  );

/** Get session duration in seconds */
export const useSessionDuration = () =>
  useFlowStore((s) => {
    if (!s.session) return 0;
    return Math.floor((Date.now() - s.session.startedAtMs) / 1000);
  });

/** Check if timer is active (running, paused, or on break) */
export const useIsTimerActive = () =>
  useFlowStore((s) => s.timer.state === 'running' || s.timer.state === 'paused' || s.timer.state === 'break');

/** Check if currently in break */
export const useIsBreak = () => useFlowStore((s) => s.timer.isBreak);

/** Check if timer has reached auto-reveal threshold */
export const useShouldAutoReveal = () => useFlowStore((s) => s.timer.shouldAutoReveal);

/** Get selected duration in minutes */
export const useSelectedDuration = () => useFlowStore((s) => s.timer.selectedDurationMin);

/** Get reveal threshold in minutes */
export const useRevealThreshold = () => useFlowStore((s) => s.timer.revealThresholdMin);

/** Format remaining time as MM:SS */
export function formatFlowTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Format duration for display */
export function formatFlowDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}
