/**
 * FlowSummaryModal - Session summary shown on exit
 *
 * Celebrates the writer's accomplishment with session statistics.
 */

import { X, Clock, FileText, Target, Sparkles } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@mythos/ui";
import { type SessionStats, formatFlowDuration } from "@mythos/state";

interface FlowSummaryModalProps {
  stats: SessionStats;
  onClose: () => void;
}

export function FlowSummaryModal({ stats, onClose }: FlowSummaryModalProps) {
  // Determine encouragement message based on performance
  const getMessage = () => {
    if (stats.wordsWritten >= 1000) {
      return { emoji: "🔥", text: "Incredible session!" };
    }
    if (stats.wordsWritten >= 500) {
      return { emoji: "✨", text: "Great progress!" };
    }
    if (stats.wordsWritten >= 100) {
      return { emoji: "👏", text: "Nice work!" };
    }
    return { emoji: "🌱", text: "Every word counts." };
  };

  const message = getMessage();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="flow-summary-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/90 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-sm shadow-2xl border-mythos-border-default bg-mythos-bg-secondary">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-mythos-text-muted hover:text-mythos-text-primary transition-colors"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </button>

        <CardHeader className="text-center pb-2">
          <div className="text-4xl mb-2">{message.emoji}</div>
          <CardTitle className="text-xl font-semibold text-mythos-text-primary">
            {message.text}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Words written */}
            <div className="flex flex-col items-center p-3 rounded-lg bg-mythos-bg-tertiary">
              <FileText className="w-5 h-5 text-mythos-accent-cyan mb-1" />
              <span className="text-2xl font-bold text-mythos-text-primary font-mono">
                {stats.wordsWritten.toLocaleString()}
              </span>
              <span className="text-xs text-mythos-text-muted">words written</span>
            </div>

            {/* Duration */}
            <div className="flex flex-col items-center p-3 rounded-lg bg-mythos-bg-tertiary">
              <Clock className="w-5 h-5 text-mythos-accent-green mb-1" />
              <span className="text-2xl font-bold text-mythos-text-primary font-mono">
                {formatFlowDuration(stats.durationSeconds)}
              </span>
              <span className="text-xs text-mythos-text-muted">focused time</span>
            </div>
          </div>

          {/* Pomodoros (if any) */}
          {stats.completedPomodoros > 0 && (
            <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-mythos-bg-tertiary">
              <Target className="w-4 h-4 text-mythos-accent-amber" />
              <span className="text-sm text-mythos-text-secondary">
                <span className="font-semibold text-mythos-text-primary">
                  {stats.completedPomodoros}
                </span>
                {" "}
                {stats.completedPomodoros === 1 ? "pomodoro" : "pomodoros"} completed
              </span>
            </div>
          )}

          {/* Words per minute (if session was long enough) */}
          {stats.durationSeconds >= 60 && (
            <div className="flex items-center justify-center gap-2 text-sm text-mythos-text-muted">
              <Sparkles className="w-4 h-4" />
              <span>
                ~{Math.round(stats.wordsWritten / (stats.durationSeconds / 60))} words/minute
              </span>
            </div>
          )}

          {/* Continue button */}
          <Button
            className="w-full mt-4"
            variant="default"
            onClick={onClose}
          >
            Continue Writing
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
