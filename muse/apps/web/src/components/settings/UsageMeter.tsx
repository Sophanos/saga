/**
 * UsageMeter Component
 * Progress bar with color coding for usage tracking
 */

import { cn } from "@mythos/ui";

interface UsageMeterProps {
  used: number;
  included: number;
  label: string;
  className?: string;
}

export function UsageMeter({
  used,
  included,
  label,
  className,
}: UsageMeterProps) {
  const percentage = included > 0 ? Math.min((used / included) * 100, 100) : 0;
  const remaining = Math.max(included - used, 0);
  const isOverage = used > included;
  const overageAmount = isOverage ? used - included : 0;

  // Color coding based on usage percentage
  const getProgressColor = () => {
    if (isOverage) return "bg-mythos-accent-red";
    if (percentage >= 100) return "bg-mythos-accent-red";
    if (percentage >= 75) return "bg-mythos-accent-yellow";
    return "bg-mythos-accent-green";
  };

  const getTextColor = () => {
    if (isOverage) return "text-mythos-accent-red";
    if (percentage >= 100) return "text-mythos-accent-red";
    if (percentage >= 75) return "text-mythos-accent-yellow";
    return "text-mythos-accent-green";
  };

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
      return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with label and percentage */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-mythos-text-primary">{label}</span>
        <span className={cn("font-mono", getTextColor())}>
          {percentage.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-mythos-bg-tertiary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            getProgressColor()
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Usage details */}
      <div className="flex items-center justify-between text-xs text-mythos-text-muted">
        <span>
          {formatNumber(used)} / {formatNumber(included)} used
        </span>
        {isOverage ? (
          <span className="text-mythos-accent-red">
            +{formatNumber(overageAmount)} overage
          </span>
        ) : (
          <span className={getTextColor()}>
            {formatNumber(remaining)} remaining
          </span>
        )}
      </div>
    </div>
  );
}

export default UsageMeter;
