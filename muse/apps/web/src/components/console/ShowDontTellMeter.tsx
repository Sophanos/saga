import { AlertTriangle } from "lucide-react";
import {
  useShowDontTellScore,
  useShowDontTellGrade,
  useStyleIssues,
} from "../../stores/analysis";
import { cn } from "@mythos/ui";

/**
 * Props for ShowDontTellMeter component
 */
interface ShowDontTellMeterProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * Get grade color based on letter grade
 */
function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "bg-green-500 text-white";
    case "B":
      return "bg-green-400 text-white";
    case "C":
      return "bg-mythos-accent-amber text-black";
    case "D":
      return "bg-orange-500 text-white";
    case "F":
      return "bg-mythos-accent-red text-white";
    default:
      return "bg-mythos-text-muted text-white";
  }
}

/**
 * Get progress bar gradient style
 * Red (0%) -> Amber (50%) -> Green (100%)
 */
function getProgressGradient(): string {
  return "linear-gradient(to right, #ef4444, #f59e0b, #22c55e)";
}

/**
 * Get feedback message based on grade
 */
function getGradeFeedback(grade: string): string {
  switch (grade) {
    case "A":
      return "Excellent! Your prose is vivid and immersive.";
    case "B":
      return "Good showing with minor areas to improve.";
    case "C":
      return "Balanced, but could use more showing.";
    case "D":
      return "Too much telling. Try showing emotions through actions.";
    case "F":
      return "Heavy telling detected. Revise to show, not tell.";
    default:
      return "Analyzing...";
  }
}

/**
 * ShowDontTellMeter Component
 *
 * Displays show-don't-tell quality assessment.
 * - Letter grade badge (A-F)
 * - Progress bar with gradient (red -> amber -> green)
 * - Warning text for detected issues
 */
export function ShowDontTellMeter({ className }: ShowDontTellMeterProps) {
  const score = useShowDontTellScore();
  const grade = useShowDontTellGrade();
  const issues = useStyleIssues();

  // Filter for "telling" issues specifically
  const tellingIssues = issues.filter((issue) => issue.type === "telling");

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with grade badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-mythos-text-primary">
          Show vs Tell
        </span>
        <span
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-md text-lg font-bold",
            getGradeColor(grade)
          )}
        >
          {grade}
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-3 rounded-full overflow-hidden bg-mythos-bg-secondary/50">
          {/* Gradient background */}
          <div
            className="h-full rounded-full relative"
            style={{ background: getProgressGradient() }}
          >
            {/* Overlay to show current position */}
            <div
              className="absolute top-0 right-0 h-full bg-mythos-bg-primary/80 transition-all duration-500"
              style={{ width: `${100 - score}%` }}
            />
          </div>
        </div>
        <div className="flex justify-between text-xs text-mythos-text-muted">
          <span>Telling</span>
          <span>{score}%</span>
          <span>Showing</span>
        </div>
      </div>

      {/* Feedback message */}
      <p className="text-xs text-mythos-text-secondary">
        {getGradeFeedback(grade)}
      </p>

      {/* Telling issues warning */}
      {tellingIssues.length > 0 && (
        <div className="p-2 rounded bg-mythos-accent-amber/10 border border-mythos-accent-amber/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-mythos-accent-amber flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-mythos-accent-amber">
                {tellingIssues.length} telling issue{tellingIssues.length !== 1 ? "s" : ""} detected
              </p>
              {/* Show first issue as example */}
              {tellingIssues[0] && (
                <div className="text-xs text-mythos-text-muted">
                  <p className="italic">"{tellingIssues[0].text}"</p>
                  <p className="text-mythos-text-secondary mt-0.5">
                    Try: {tellingIssues[0].suggestion}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Perfect score celebration */}
      {score >= 90 && (
        <p className="text-xs text-green-400 font-medium text-center">
          Outstanding prose craft!
        </p>
      )}
    </div>
  );
}
