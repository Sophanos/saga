/**
 * UsageDashboard Component
 * Displays token usage and words written statistics
 */

import { PenLine, Zap, Calendar } from "lucide-react";
import { Card, CardContent, cn } from "@mythos/ui";
import { UsageMeter } from "./UsageMeter";
import type { Usage } from "../../stores/billing";

interface UsageDashboardProps {
  usage: Usage;
  periodStart?: string;
  periodEnd?: string;
  className?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  className?: string;
}

function StatCard({ label, value, subtext, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-mythos-bg-tertiary/50",
        className
      )}
    >
      {icon && (
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-mythos-bg-secondary text-mythos-accent-cyan">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-lg font-semibold text-mythos-text-primary truncate">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-mythos-text-muted">{label}</p>
        {subtext && (
          <p className="text-xs text-mythos-text-muted/70">{subtext}</p>
        )}
      </div>
    </div>
  );
}

export function UsageDashboard({
  usage,
  periodStart,
  periodEnd,
  className,
}: UsageDashboardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Calculate current period if not provided
  const now = new Date();
  const defaultPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const displayPeriodStart = periodStart || defaultPeriodStart.toISOString();
  const displayPeriodEnd = periodEnd || defaultPeriodEnd.toISOString();

  return (
    <div className={cn("space-y-6", className)}>
      {/* Period Info */}
      <div className="flex items-center gap-2 text-sm text-mythos-text-muted">
        <Calendar className="w-4 h-4" />
        <span>
          {formatDate(displayPeriodStart)} - {formatDate(displayPeriodEnd)}
        </span>
      </div>

      {/* Token Usage Meter */}
      <Card className="border-mythos-text-muted/20">
        <CardContent className="pt-4">
          <UsageMeter
            used={usage.tokensUsed}
            included={usage.tokensIncluded}
            label="AI Tokens"
          />
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Words Written"
          value={usage.wordsWritten}
          subtext="This period"
          icon={<PenLine className="w-4 h-4" />}
        />
        <StatCard
          label="Tokens Remaining"
          value={usage.tokensRemaining}
          subtext="Until reset"
          icon={<Zap className="w-4 h-4" />}
        />
      </div>
    </div>
  );
}

export default UsageDashboard;
