import { useTension } from "../../stores/analysis";
import { cn } from "@mythos/ui";

/**
 * Props for TensionGraph component
 */
interface TensionGraphProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * Get gradient style for a bar based on tension value
 */
function getBarGradient(tension: number): string {
  // Create a gradient from bottom to top based on tension level
  const hue = Math.round(120 - (tension / 100) * 120); // 120 (green) to 0 (red)
  return `linear-gradient(to top, hsl(${hue}, 70%, 35%), hsl(${hue}, 70%, 50%))`;
}

/**
 * TensionGraph Component
 *
 * Displays a bar chart showing tension levels per paragraph.
 * - Height: 96px
 * - Bars fill based on tension value (0-100)
 * - Color gradient from green (low tension) to red (high tension)
 */
export function TensionGraph({ className }: TensionGraphProps) {
  const tension = useTension();

  // Handle empty state
  if (tension.length === 0) {
    return (
      <div
        className={cn(
          "h-24 flex items-center justify-center text-mythos-text-muted text-sm",
          className
        )}
      >
        No tension data available
      </div>
    );
  }

  // Calculate bar width based on number of paragraphs
  const barCount = tension.length;
  const maxBars = 20; // Maximum bars to display
  const displayTension = barCount > maxBars ? tension.slice(-maxBars) : tension;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Graph container */}
      <div className="h-24 flex items-end gap-1 bg-mythos-bg-secondary/50 rounded-md p-2">
        {displayTension.map((value, index) => (
          <div
            key={index}
            className="flex-1 min-w-1 rounded-t transition-all duration-300"
            style={{
              height: `${Math.max(4, value)}%`,
              background: getBarGradient(value),
            }}
            title={`Paragraph ${index + 1}: ${value}% tension`}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-mythos-text-muted px-2">
        <span>Start</span>
        <span className="text-mythos-accent-cyan">
          Peak: {Math.max(...displayTension)}%
        </span>
        <span>Climax</span>
      </div>

      {/* Tension legend */}
      <div className="flex items-center gap-3 text-xs text-mythos-text-muted">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-mythos-accent-amber" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-mythos-accent-red" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
