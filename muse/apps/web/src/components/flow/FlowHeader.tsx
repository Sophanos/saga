/**
 * FlowHeader - Minimal top bar for flow mode
 *
 * Contains timer, word counter, focus controls, and exit button.
 * Designed to be unobtrusive while providing essential information.
 */

import { useEffect, useRef, useCallback } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Type,
  AlignLeft,
  Minus,
  Coffee,
  Target,
} from "lucide-react";
import { Button } from "@mythos/ui";
import {
  useFlowStore,
  useFlowTimer,
  useFlowPreferences,
  useFocusLevel,
  useSessionWordsWritten,
  formatFlowTime,
  type FocusLevel,
} from "@mythos/state";

interface FlowHeaderProps {
  onExit: () => void;
}

export function FlowHeader({ onExit }: FlowHeaderProps) {
  const timer = useFlowTimer();
  const preferences = useFlowPreferences();
  const focusLevel = useFocusLevel();
  const wordsWritten = useSessionWordsWritten();

  const startTimer = useFlowStore((s) => s.startTimer);
  const pauseTimer = useFlowStore((s) => s.pauseTimer);
  const resumeTimer = useFlowStore((s) => s.resumeTimer);
  const resetTimer = useFlowStore((s) => s.resetTimer);
  const skipBreak = useFlowStore((s) => s.skipBreak);
  const tickTimer = useFlowStore((s) => s.tickTimer);
  const setFocusLevel = useFlowStore((s) => s.setFocusLevel);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer tick effect
  useEffect(() => {
    if (timer.state === "running" || timer.state === "break") {
      intervalRef.current = setInterval(() => {
        tickTimer();
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timer.state, tickTimer]);

  // Timer controls
  const handleTimerToggle = useCallback(() => {
    if (timer.state === "idle") {
      startTimer();
    } else if (timer.state === "running") {
      pauseTimer();
    } else if (timer.state === "paused") {
      resumeTimer();
    } else if (timer.state === "break") {
      skipBreak();
    }
  }, [timer.state, startTimer, pauseTimer, resumeTimer, skipBreak]);

  // Focus level cycling
  const cycleFocusLevel = useCallback(() => {
    const levels: FocusLevel[] = ["none", "sentence", "paragraph"];
    const currentIdx = levels.indexOf(focusLevel);
    const nextIdx = (currentIdx + 1) % levels.length;
    setFocusLevel(levels[nextIdx]);
  }, [focusLevel, setFocusLevel]);

  // Timer color based on state and remaining time
  const getTimerColor = () => {
    if (timer.isBreak) return "text-mythos-accent-cyan";
    if (timer.state === "running") {
      // Warning at 5 minutes, urgent at 1 minute
      if (timer.remainingSeconds <= 60) return "text-mythos-accent-red";
      if (timer.remainingSeconds <= 300) return "text-mythos-accent-amber";
      return "text-mythos-accent-green";
    }
    return "text-mythos-text-muted";
  };

  // Focus level icon
  const FocusIcon = focusLevel === "sentence" ? Type : focusLevel === "paragraph" ? AlignLeft : Minus;

  // Word goal progress
  const goalProgress = preferences.sessionWordGoal
    ? Math.min(100, (wordsWritten / preferences.sessionWordGoal) * 100)
    : null;

  return (
    <header
      className="flow-header relative z-20 flex items-center justify-between px-6 py-3"
      data-testid="flow-header"
    >
      {/* Left: Timer */}
      <div className="flex items-center gap-3">
        {/* Timer display */}
        <div
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg
            bg-mythos-bg-secondary/50 backdrop-blur-sm
            border border-mythos-border-subtle
            ${timer.state === "running" ? "flow-timer-running" : ""}
            ${timer.isBreak ? "flow-timer-break" : ""}
          `}
        >
          {timer.isBreak ? (
            <Coffee className="w-4 h-4 text-mythos-accent-cyan" />
          ) : (
            <Target className="w-4 h-4 text-mythos-text-muted" />
          )}
          <span className={`flow-stat text-base font-medium ${getTimerColor()}`}>
            {formatFlowTime(timer.remainingSeconds)}
          </span>
        </div>

        {/* Timer controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-mythos-text-secondary hover:text-mythos-text-primary"
            onClick={handleTimerToggle}
            data-testid="flow-timer-toggle"
          >
            {timer.state === "running" || timer.state === "break" ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-mythos-text-secondary hover:text-mythos-text-primary"
            onClick={resetTimer}
            data-testid="flow-timer-reset"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Center: Word count & goal */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <span className="flow-stat text-mythos-text-secondary">
            <span className="text-mythos-text-primary font-semibold">
              {wordsWritten.toLocaleString()}
            </span>
            {" words"}
          </span>
          {preferences.sessionWordGoal && (
            <span className="text-mythos-text-muted text-xs">
              / {preferences.sessionWordGoal.toLocaleString()} goal
            </span>
          )}
        </div>
        {goalProgress !== null && (
          <div className="flow-goal-bar w-32">
            <div
              className="flow-goal-progress"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
        )}
      </div>

      {/* Right: Focus controls & exit */}
      <div className="flex items-center gap-3">
        {/* Focus level toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-mythos-text-secondary hover:text-mythos-text-primary"
          onClick={cycleFocusLevel}
          data-testid="flow-focus-toggle"
        >
          <FocusIcon className="w-4 h-4" />
          <span className="text-xs capitalize hidden sm:inline">
            {focusLevel === "none" ? "No focus" : `${focusLevel} focus`}
          </span>
        </Button>

        {/* Divider */}
        <div className="w-px h-6 bg-mythos-border-subtle" />

        {/* Exit button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-mythos-text-secondary hover:text-mythos-text-primary hover:bg-mythos-bg-hover"
          onClick={onExit}
          data-testid="flow-exit-button"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
