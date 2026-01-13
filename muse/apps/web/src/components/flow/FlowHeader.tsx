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
} from "lucide-react";
import { Button } from "@mythos/ui";
import {
  useFlowStore,
  useFlowTimer,
  useFocusLevel,
  formatFlowTime,
  type FocusLevel,
} from "@mythos/state";

interface FlowHeaderProps {
  onExit: () => void;
}

export function FlowHeader({ onExit }: FlowHeaderProps) {
  const timer = useFlowTimer();
  const focusLevel = useFocusLevel();

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

  return (
    <header
      className="flow-header relative z-20 flex items-center justify-between px-4 py-2"
      data-testid="flow-header"
    >
      {/* Left: Timer - minimal display with hover controls */}
      <div className="group flex items-center gap-2">
        {/* Timer display - clean, no box */}
        <button
          onClick={handleTimerToggle}
          className={`
            flex items-center gap-1.5 text-mythos-text-muted hover:text-mythos-text-secondary
            transition-colors cursor-pointer
            ${timer.state === "running" ? "flow-timer-running" : ""}
            ${timer.isBreak ? "flow-timer-break" : ""}
          `}
          data-testid="flow-timer-toggle"
        >
          {timer.isBreak ? (
            <Coffee className="w-3.5 h-3.5 text-mythos-accent-cyan" />
          ) : timer.state === "running" ? (
            <Pause className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          ) : (
            <Play className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
          <span className={`flow-stat text-sm ${getTimerColor()}`}>
            {formatFlowTime(timer.remainingSeconds)}
          </span>
        </button>

        {/* Reset - only visible on hover */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-mythos-text-muted hover:text-mythos-text-secondary opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={resetTimer}
          data-testid="flow-timer-reset"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>

      {/* Right: Focus controls & exit - minimal */}
      <div className="flex items-center gap-2">
        {/* Focus level toggle - subtle */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-mythos-text-muted hover:text-mythos-text-secondary"
          onClick={cycleFocusLevel}
          data-testid="flow-focus-toggle"
        >
          <FocusIcon className="w-3.5 h-3.5" />
          <span className="text-xs capitalize">
            {focusLevel === "none" ? "Off" : focusLevel === "sentence" ? "Sentence" : "Paragraph"}
          </span>
        </Button>

        {/* Exit button - subtle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-mythos-text-muted hover:text-mythos-text-secondary"
          onClick={onExit}
          data-testid="flow-exit-button"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
