import { Eye, Ear, Hand, Wind, Utensils } from "lucide-react";
import { useSensoryBalance } from "../../stores/analysis";
import { cn } from "@mythos/ui";
import type { SensoryBalance } from "@mythos/core";

/**
 * Props for SensoryHeatmap component
 */
interface SensoryHeatmapProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * Configuration for each sense display
 */
const SENSE_CONFIG: Array<{
  key: keyof SensoryBalance;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { key: "sight", label: "Sight", icon: Eye, color: "text-mythos-accent-cyan" },
  { key: "sound", label: "Sound", icon: Ear, color: "text-mythos-accent-purple" },
  { key: "touch", label: "Touch", icon: Hand, color: "text-mythos-accent-amber" },
  { key: "smell", label: "Smell", icon: Wind, color: "text-green-400" },
  { key: "taste", label: "Taste", icon: Utensils, color: "text-pink-400" },
];

/**
 * Individual sense cell component
 */
function SenseCell({
  label,
  count,
  icon: Icon,
  color,
}: {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const hasCount = count > 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between p-2 rounded border transition-colors",
        hasCount
          ? "border-mythos-text-muted/30 bg-mythos-bg-secondary/50"
          : "border-mythos-text-muted/10 bg-mythos-bg-secondary/20"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("w-4 h-4", hasCount ? color : "text-mythos-text-muted")} />
        <span
          className={cn(
            "text-sm",
            hasCount ? "text-mythos-text-primary" : "text-mythos-text-muted"
          )}
        >
          {label}
        </span>
      </div>
      <span
        className={cn(
          "px-2 py-0.5 rounded text-xs font-medium",
          hasCount
            ? "bg-white/10 text-white"
            : "bg-mythos-text-muted/20 text-mythos-text-muted"
        )}
      >
        {count}
      </span>
    </div>
  );
}

/**
 * SensoryHeatmap Component
 *
 * Displays a grid showing the distribution of sensory details.
 * - 2-column grid of senses
 * - Each shows sense name + count
 * - Count badge is white if > 0, gray if 0
 */
export function SensoryHeatmap({ className }: SensoryHeatmapProps) {
  const sensory = useSensoryBalance();

  // Calculate total for summary
  const total = SENSE_CONFIG.reduce((sum, sense) => sum + sensory[sense.key], 0);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Grid of senses */}
      <div className="grid grid-cols-2 gap-2">
        {SENSE_CONFIG.map((sense) => (
          <SenseCell
            key={sense.key}
            label={sense.label}
            count={sensory[sense.key]}
            icon={sense.icon}
            color={sense.color}
          />
        ))}
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between pt-2 border-t border-mythos-border-default">
        <span className="text-xs text-mythos-text-muted">Total sensory details</span>
        <span
          className={cn(
            "px-2 py-0.5 rounded text-xs font-bold",
            total > 0
              ? "bg-mythos-accent-cyan/20 text-mythos-accent-cyan"
              : "bg-mythos-text-muted/20 text-mythos-text-muted"
          )}
        >
          {total}
        </span>
      </div>

      {/* Helpful tip when senses are underrepresented */}
      {total === 0 && (
        <p className="text-xs text-mythos-text-muted italic">
          Add sensory details to make your prose more immersive.
        </p>
      )}

      {/* Balance indicator */}
      {total > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-mythos-text-muted">Balance</p>
          <div className="flex h-2 rounded overflow-hidden">
            {SENSE_CONFIG.map((sense) => {
              const percentage = (sensory[sense.key] / total) * 100;
              if (percentage === 0) return null;
              return (
                <div
                  key={sense.key}
                  className={cn("transition-all", sense.color.replace("text-", "bg-"))}
                  style={{ width: `${percentage}%` }}
                  title={`${sense.label}: ${sensory[sense.key]} (${Math.round(percentage)}%)`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
