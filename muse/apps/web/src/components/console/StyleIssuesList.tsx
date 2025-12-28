import { AlertTriangle, Pencil, RefreshCcw, Copy, CheckCircle2 } from "lucide-react";
import { cn } from "@mythos/ui";
import { useStyleIssues } from "../../stores/analysis";
import type { StyleIssue } from "@mythos/core";

const issueTypeConfig: Record<
  StyleIssue["type"],
  { label: string; bgClass: string; textClass: string; icon: typeof AlertTriangle }
> = {
  telling: {
    label: "Telling",
    bgClass: "bg-mythos-accent-amber/20",
    textClass: "text-mythos-accent-amber",
    icon: AlertTriangle,
  },
  passive: {
    label: "Passive",
    bgClass: "bg-blue-500/20",
    textClass: "text-blue-400",
    icon: RefreshCcw,
  },
  adverb: {
    label: "Adverb",
    bgClass: "bg-mythos-accent-purple/20",
    textClass: "text-mythos-accent-purple",
    icon: Pencil,
  },
  repetition: {
    label: "Repetition",
    bgClass: "bg-pink-500/20",
    textClass: "text-pink-400",
    icon: Copy,
  },
};

function IssueTypeBadge({ type }: { type: StyleIssue["type"] }) {
  const config = issueTypeConfig[type];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
        config.bgClass,
        config.textClass
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function IssueItem({ issue }: { issue: StyleIssue }) {
  const config = issueTypeConfig[issue.type];

  return (
    <div
      className={cn(
        "p-3 rounded-md border transition-colors",
        "bg-mythos-bg-secondary/50 border-mythos-text-muted/10",
        "hover:bg-mythos-bg-secondary hover:border-mythos-text-muted/20"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <IssueTypeBadge type={issue.type} />
        {issue.line !== undefined && (
          <span className="text-xs text-mythos-text-muted">
            Line {issue.line}
          </span>
        )}
      </div>

      <p
        className={cn(
          "text-sm mb-2 pl-3 py-1 border-l-2 italic",
          config.textClass,
          "border-current opacity-80"
        )}
      >
        "{issue.text}"
      </p>

      <p className="text-xs text-mythos-text-secondary">
        <span className="text-mythos-text-muted">Suggestion: </span>
        {issue.suggestion}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
        <CheckCircle2 className="w-6 h-6 text-green-400" />
      </div>
      <h4 className="text-sm font-medium text-mythos-text-primary mb-1">
        Looking Great!
      </h4>
      <p className="text-xs text-mythos-text-muted max-w-[200px]">
        No style issues detected. Your prose is clean and engaging.
      </p>
    </div>
  );
}

function ListHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-mythos-text-muted" />
        <h3 className="text-sm font-medium text-mythos-text-primary">
          Style Issues
        </h3>
      </div>
      <span
        className={cn(
          "px-2 py-0.5 rounded-full text-xs font-medium",
          count > 0
            ? "bg-mythos-accent-amber/20 text-mythos-accent-amber"
            : "bg-green-500/20 text-green-400"
        )}
      >
        {count}
      </span>
    </div>
  );
}

interface StyleIssuesListProps {
  className?: string;
}

export function StyleIssuesList({ className }: StyleIssuesListProps) {
  const issues = useStyleIssues();

  return (
    <div className={cn("", className)}>
      <ListHeader count={issues.length} />

      {issues.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {issues.map((issue, index) => (
            <IssueItem key={`${issue.type}-${issue.line ?? index}-${index}`} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}
