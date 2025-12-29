import { useRef, useEffect } from "react";
import {
  AlertTriangle,
  Pencil,
  RefreshCcw,
  Copy,
  CheckCircle2,
  ArrowRight,
  Wand2,
  HelpCircle,
  Link2,
  Quote,
  Eraser,
  AlignLeft,
} from "lucide-react";
import { cn, Button } from "@mythos/ui";
import { useStyleIssues, useSelectedStyleIssueId } from "../../stores/analysis";
import type { StyleIssue } from "@mythos/core";

const issueTypeConfig: Record<
  StyleIssue["type"],
  { label: string; bgClass: string; textClass: string; icon: typeof AlertTriangle }
> = {
  // Coach style issues
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
  // Clarity issues
  ambiguous_pronoun: {
    label: "Ambiguous",
    bgClass: "bg-orange-500/20",
    textClass: "text-orange-400",
    icon: HelpCircle,
  },
  unclear_antecedent: {
    label: "Unclear Ref",
    bgClass: "bg-rose-500/20",
    textClass: "text-rose-400",
    icon: Link2,
  },
  cliche: {
    label: "Cliché",
    bgClass: "bg-yellow-500/20",
    textClass: "text-yellow-400",
    icon: Quote,
  },
  filler_word: {
    label: "Filler",
    bgClass: "bg-slate-500/20",
    textClass: "text-slate-400",
    icon: Eraser,
  },
  dangling_modifier: {
    label: "Dangling",
    bgClass: "bg-teal-500/20",
    textClass: "text-teal-400",
    icon: AlignLeft,
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

interface IssueItemProps {
  issue: StyleIssue;
  isSelected?: boolean;
  onJump?: (issue: StyleIssue) => void;
  onApplyFix?: (issue: StyleIssue) => void;
  onSelect?: (issue: StyleIssue) => void;
}

function IssueItem({ issue, isSelected, onJump, onApplyFix, onSelect }: IssueItemProps) {
  const config = issueTypeConfig[issue.type];
  const canJump = issue.line !== undefined && onJump;
  const canFix = issue.fix && onApplyFix;
  const itemRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isSelected]);

  const handleClick = () => {
    onSelect?.(issue);
  };

  return (
    <div
      ref={itemRef}
      onClick={handleClick}
      className={cn(
        "p-3 rounded-md border transition-colors cursor-pointer",
        "bg-mythos-bg-secondary/50 border-mythos-text-muted/10",
        "hover:bg-mythos-bg-secondary hover:border-mythos-text-muted/20",
        isSelected && "ring-2 ring-mythos-accent-cyan ring-offset-1 ring-offset-mythos-bg-primary bg-mythos-bg-secondary border-mythos-accent-cyan/30"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <IssueTypeBadge type={issue.type} />
        <div className="flex items-center gap-2">
          {issue.line !== undefined && (
            <button
              onClick={() => canJump && onJump(issue)}
              disabled={!canJump}
              className={cn(
                "text-xs flex items-center gap-1 transition-colors",
                canJump
                  ? "text-mythos-accent-cyan hover:text-mythos-accent-cyan/80 cursor-pointer"
                  : "text-mythos-text-muted cursor-default"
              )}
              title={canJump ? "Jump to location" : undefined}
            >
              Line {issue.line}
              {canJump && <ArrowRight className="w-3 h-3" />}
            </button>
          )}
        </div>
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

      <p className="text-xs text-mythos-text-secondary mb-2">
        <span className="text-mythos-text-muted">Suggestion: </span>
        {issue.suggestion}
      </p>

      {/* Apply Fix button */}
      {canFix && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onApplyFix(issue)}
            className="text-xs h-7 px-2 text-mythos-accent-green hover:text-mythos-accent-green/80 hover:bg-mythos-accent-green/10"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            Apply Fix
          </Button>
        </div>
      )}
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

interface ListHeaderProps {
  count: number;
  fixableCount: number;
  onFixAll?: () => void;
}

function ListHeader({ count, fixableCount, onFixAll }: ListHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-mythos-text-muted" />
        <h3 className="text-sm font-medium text-mythos-text-primary">
          Style Issues
        </h3>
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
      {fixableCount > 0 && onFixAll && (
        <Button
          size="sm"
          variant="outline"
          onClick={onFixAll}
          className="h-7 text-xs"
        >
          <Wand2 className="w-3 h-3 mr-1" />
          Fix All ({fixableCount})
        </Button>
      )}
    </div>
  );
}

export interface StyleIssuesListProps {
  className?: string;
  /** Callback when user clicks to jump to an issue location */
  onJumpToIssue?: (issue: StyleIssue) => void;
  /** Callback when user clicks to apply a fix (triggers preview modal) */
  onApplyFix?: (issue: StyleIssue) => void;
  /** Callback when user clicks Fix All */
  onFixAll?: () => void;
  /** Callback when user selects an issue */
  onSelectIssue?: (issue: StyleIssue) => void;
}

export function StyleIssuesList({
  className,
  onJumpToIssue,
  onApplyFix,
  onFixAll,
  onSelectIssue,
}: StyleIssuesListProps) {
  const issues = useStyleIssues();
  const selectedStyleIssueId = useSelectedStyleIssueId();
  const fixableCount = issues.filter((i) => Boolean(i.fix)).length;

  return (
    <div className={cn("", className)}>
      <ListHeader count={issues.length} fixableCount={fixableCount} onFixAll={onFixAll} />

      {issues.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {issues.map((issue, index) => (
            <IssueItem
              key={issue.id || `${issue.type}-${issue.line ?? index}-${index}`}
              issue={issue}
              isSelected={issue.id === selectedStyleIssueId}
              onJump={onJumpToIssue}
              onApplyFix={onApplyFix}
              onSelect={onSelectIssue}
            />
          ))}
        </div>
      )}
    </div>
  );
}
