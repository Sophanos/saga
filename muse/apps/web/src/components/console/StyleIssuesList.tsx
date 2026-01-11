import { useRef, useEffect, useMemo } from "react";
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
  Shield,
  FileQuestion,
  Target,
  Lightbulb,
  FileText,
} from "lucide-react";
import { cn, Button } from "@mythos/ui";
import { useStyleIssues, useSelectedStyleIssueId, useCoachMode, type CoachMode } from "../../stores/analysis";
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
  // Policy issues
  policy_conflict: {
    label: "Conflict",
    bgClass: "bg-mythos-accent-red/20",
    textClass: "text-mythos-accent-red",
    icon: Shield,
  },
  unverifiable: {
    label: "Unverifiable",
    bgClass: "bg-amber-500/20",
    textClass: "text-amber-400",
    icon: FileQuestion,
  },
  not_testable: {
    label: "Not Testable",
    bgClass: "bg-violet-500/20",
    textClass: "text-violet-400",
    icon: Target,
  },
  policy_gap: {
    label: "Gap",
    bgClass: "bg-cyan-500/20",
    textClass: "text-cyan-400",
    icon: Lightbulb,
  },
};

/**
 * Issue type categories by coach mode
 */
const ISSUE_TYPES_BY_MODE: Record<CoachMode, StyleIssue["type"][]> = {
  writing: ["telling", "passive", "adverb", "repetition"],
  clarity: ["ambiguous_pronoun", "unclear_antecedent", "cliche", "filler_word", "dangling_modifier"],
  policy: ["policy_conflict", "unverifiable", "not_testable", "policy_gap"],
};

/**
 * Get the test ID prefix based on issue type
 */
function getTestIdPrefix(issueType: StyleIssue["type"]): string {
  if (ISSUE_TYPES_BY_MODE.writing.includes(issueType)) return "coach";
  if (ISSUE_TYPES_BY_MODE.clarity.includes(issueType)) return "clarity";
  if (ISSUE_TYPES_BY_MODE.policy.includes(issueType)) return "policy";
  return "coach";
}

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
  onJumpToCanon?: (memoryId: string) => void;
  onPinPolicy?: (issue: StyleIssue) => void;
}

function IssueItem({ issue, isSelected, onJump, onApplyFix, onSelect, onJumpToCanon, onPinPolicy }: IssueItemProps) {
  const config = issueTypeConfig[issue.type];
  const canJump = issue.line !== undefined && onJump;
  const canFix = issue.fix && onApplyFix;
  const isPolicyIssue = ISSUE_TYPES_BY_MODE.policy.includes(issue.type);
  const hasCanonCitations = issue.canonCitations && issue.canonCitations.length > 0;
  const itemRef = useRef<HTMLDivElement>(null);
  const testIdPrefix = getTestIdPrefix(issue.type);

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
      data-testid={`${testIdPrefix}-issue-${issue.id}`}
      className={cn(
        "p-3 rounded-md border transition-colors cursor-pointer",
        "bg-mythos-bg-secondary/50 border-mythos-text-muted/10",
        "hover:bg-mythos-bg-secondary hover:border-mythos-border-default",
        isSelected && "ring-2 ring-mythos-accent-primary ring-offset-1 ring-offset-mythos-bg-primary bg-mythos-bg-secondary border-mythos-accent-primary/30"
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
                  ? "text-mythos-accent-primary hover:text-mythos-accent-primary/80 cursor-pointer"
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

      {/* Canon citations - clickable links to jump to memory */}
      {hasCanonCitations && (
        <div className="mt-2 pt-2 border-t border-mythos-text-muted/10">
          <p className="text-xs text-mythos-text-muted mb-1">Canon cited:</p>
          <div className="flex flex-wrap gap-1">
            {issue.canonCitations!.map((citation) => (
              <button
                key={citation.memoryId}
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpToCanon?.(citation.memoryId);
                }}
                data-testid={`coach-jump-canon-${citation.memoryId}`}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                  "bg-mythos-accent-cyan/10 text-mythos-accent-cyan",
                  "hover:bg-mythos-accent-cyan/20 transition-colors"
                )}
                title={citation.reason ?? citation.excerpt}
              >
                <FileText className="w-3 h-3" />
                <span className="truncate max-w-[120px]">
                  {citation.excerpt || citation.memoryId.slice(0, 8)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-2 mt-2">
        {/* Pin Policy button for policy issues */}
        {isPolicyIssue && onPinPolicy && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onPinPolicy(issue);
            }}
            data-testid={`coach-pin-policy-${issue.id}`}
            className="text-xs h-7 px-2 text-mythos-accent-purple hover:text-mythos-accent-purple/80 hover:bg-mythos-accent-purple/10"
          >
            <Shield className="w-3 h-3 mr-1" />
            Pin Policy
          </Button>
        )}
        {/* Apply Fix button */}
        {canFix && (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onApplyFix(issue);
            }}
            data-testid={`coach-apply-fix-${issue.id}`}
            className="text-xs h-7 px-2 text-mythos-accent-green hover:text-mythos-accent-green/80 hover:bg-mythos-accent-green/10"
          >
            <Wand2 className="w-3 h-3 mr-1" />
            Apply Fix
          </Button>
        )}
      </div>
    </div>
  );
}

const EMPTY_STATE_MESSAGES: Record<CoachMode, { title: string; description: string }> = {
  writing: {
    title: "Looking Great!",
    description: "No style issues detected. Your prose is clean and engaging.",
  },
  clarity: {
    title: "Crystal Clear!",
    description: "No clarity issues found. Your prose is easy to read and understand.",
  },
  policy: {
    title: "Policy Compliant!",
    description: "No policy violations found. Your text aligns with all pinned rules.",
  },
};

function EmptyState({ mode = "writing" }: { mode?: CoachMode }) {
  const messages = EMPTY_STATE_MESSAGES[mode];
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
        <CheckCircle2 className="w-6 h-6 text-green-400" />
      </div>
      <h4 className="text-sm font-medium text-mythos-text-primary mb-1">
        {messages.title}
      </h4>
      <p className="text-xs text-mythos-text-muted max-w-[200px]">
        {messages.description}
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
  /** Coach mode to filter issues by (if not provided, uses store mode) */
  mode?: CoachMode;
  /** Callback when user clicks to jump to an issue location */
  onJumpToIssue?: (issue: StyleIssue) => void;
  /** Callback when user clicks to apply a fix (triggers preview modal) */
  onApplyFix?: (issue: StyleIssue) => void;
  /** Callback when user clicks Fix All */
  onFixAll?: () => void;
  /** Callback when user selects an issue */
  onSelectIssue?: (issue: StyleIssue) => void;
  /** Callback when user clicks to jump to a canon citation */
  onJumpToCanon?: (memoryId: string) => void;
  /** Callback when user clicks to pin a policy issue */
  onPinPolicy?: (issue: StyleIssue) => void;
}

export function StyleIssuesList({
  className,
  mode: modeProp,
  onJumpToIssue,
  onApplyFix,
  onFixAll,
  onSelectIssue,
  onJumpToCanon,
  onPinPolicy,
}: StyleIssuesListProps) {
  const allIssues = useStyleIssues();
  const storeMode = useCoachMode();
  const selectedStyleIssueId = useSelectedStyleIssueId();

  // Use prop mode if provided, otherwise use store mode
  const mode = modeProp ?? storeMode;

  // Filter issues based on the current mode
  const filteredIssues = useMemo(() => {
    const validTypes = ISSUE_TYPES_BY_MODE[mode];
    return allIssues.filter((issue) => validTypes.includes(issue.type));
  }, [allIssues, mode]);

  const fixableCount = filteredIssues.filter((i) => Boolean(i.fix)).length;

  return (
    <div className={cn("", className)}>
      <ListHeader count={filteredIssues.length} fixableCount={fixableCount} onFixAll={onFixAll} />

      {filteredIssues.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <div className="space-y-2">
          {filteredIssues.map((issue, index) => (
            <IssueItem
              key={issue.id || `${issue.type}-${issue.line ?? index}-${index}`}
              issue={issue}
              isSelected={issue.id === selectedStyleIssueId}
              onJump={onJumpToIssue}
              onApplyFix={onApplyFix}
              onSelect={onSelectIssue}
              onJumpToCanon={onJumpToCanon}
              onPinPolicy={onPinPolicy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
