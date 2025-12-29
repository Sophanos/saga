import { useCallback } from "react";
import {
  X,
  AlertTriangle,
  Pencil,
  RefreshCcw,
  Copy,
  CheckCircle2,
  Layers,
  HelpCircle,
  Link2,
  Quote,
  Eraser,
  AlignLeft,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cn,
} from "@mythos/ui";
import type { StyleIssue, StyleIssueType } from "@mythos/core";
import { DiffView, InlineDiffView } from "./DiffViews";

/**
 * Props for StyleFixPreviewModal component
 */
interface StyleFixPreviewModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The style issue being previewed */
  issue: StyleIssue | null;
  /** Close the modal */
  onClose: () => void;
  /** Apply the fix */
  onApplyFix: (issueId: string) => void;
  /** Apply all similar fixes (optional) */
  onApplyAllSimilar?: (issueType: StyleIssueType) => void;
  /** Count of similar issues that could be fixed (optional) */
  similarIssuesCount?: number;
  /** Whether a fix is currently being applied */
  isApplying?: boolean;
}

/**
 * Configuration for style issue types
 */
const STYLE_TYPE_CONFIG: Record<
  StyleIssueType,
  {
    label: string;
    bgClass: string;
    textClass: string;
    icon: LucideIcon;
  }
> = {
  // Coach style issues
  telling: {
    label: "Telling",
    bgClass: "bg-mythos-accent-amber/20",
    textClass: "text-mythos-accent-amber",
    icon: AlertTriangle,
  },
  passive: {
    label: "Passive Voice",
    bgClass: "bg-blue-500/20",
    textClass: "text-blue-400",
    icon: RefreshCcw,
  },
  adverb: {
    label: "Adverb Overuse",
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
    label: "Ambiguous Pronoun",
    bgClass: "bg-orange-500/20",
    textClass: "text-orange-400",
    icon: HelpCircle,
  },
  unclear_antecedent: {
    label: "Unclear Reference",
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
    label: "Filler Word",
    bgClass: "bg-slate-500/20",
    textClass: "text-slate-400",
    icon: Eraser,
  },
  dangling_modifier: {
    label: "Dangling Modifier",
    bgClass: "bg-teal-500/20",
    textClass: "text-teal-400",
    icon: AlignLeft,
  },
};

/**
 * StyleFixPreviewModal Component
 *
 * Displays a preview of a style issue fix before applying it.
 * Shows the original text, proposed fix, and actions to apply or cancel.
 */
export function StyleFixPreviewModal({
  isOpen,
  issue,
  onClose,
  onApplyFix,
  onApplyAllSimilar,
  similarIssuesCount = 0,
  isApplying = false,
}: StyleFixPreviewModalProps) {
  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (issue?.fix) {
          onApplyFix(issue.id);
        }
      }
    },
    [onClose, onApplyFix, issue]
  );

  // Handle apply fix
  const handleApplyFix = useCallback(() => {
    if (issue) {
      onApplyFix(issue.id);
    }
  }, [issue, onApplyFix]);

  // Handle apply all similar
  const handleApplyAllSimilar = useCallback(() => {
    if (issue && onApplyAllSimilar) {
      onApplyAllSimilar(issue.type);
    }
  }, [issue, onApplyAllSimilar]);

  if (!isOpen || !issue) return null;

  const typeConfig = STYLE_TYPE_CONFIG[issue.type];
  const TypeIcon = typeConfig.icon;
  const hasFix = Boolean(issue.fix);
  const before = issue.fix?.oldText ?? issue.text;
  const after = issue.fix?.newText ?? "";
  // Fix: allow showing diff even when after is empty (for filler word removals)
  const canShowDiff = hasFix && typeof before === "string" && typeof after === "string";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="style-fix-preview-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 shadow-xl border-mythos-text-muted/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-md", typeConfig.bgClass)}>
                <TypeIcon className={cn("w-5 h-5", typeConfig.textClass)} />
              </div>
              <div>
                <CardTitle id="style-fix-preview-title" className="text-lg">
                  Preview Fix
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                      typeConfig.bgClass,
                      typeConfig.textClass
                    )}
                  >
                    {typeConfig.label}
                  </span>
                  {issue.line !== undefined && (
                    <span className="text-mythos-text-muted">
                      Line {issue.line}
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              disabled={isApplying}
              className="h-8 w-8 text-mythos-text-muted hover:text-mythos-text-primary"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Original text */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
              Issue
            </span>
            <p
              className={cn(
                "text-sm pl-3 py-1 border-l-2 italic",
                typeConfig.textClass,
                "border-current opacity-80"
              )}
            >
              "{issue.text}"
            </p>
          </div>

          {/* Suggestion text */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
              Suggestion
            </span>
            <p className="text-sm text-mythos-text-secondary leading-relaxed">
              {issue.suggestion}
            </p>
          </div>

          {/* Diff view */}
          {canShowDiff ? (
            <div className="space-y-3">
              <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
                Proposed Change
              </span>
              <DiffView before={before} after={after} />

              {/* Inline diff for quick reference */}
              <div className="pt-2">
                <span className="text-xs text-mythos-text-muted mb-2 block">
                  Quick view:
                </span>
                <InlineDiffView before={before} after={after} />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-md bg-mythos-bg-tertiary/50 text-center">
              <p className="text-sm text-mythos-text-muted">
                No automatic fix available for this issue.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-4 border-t border-mythos-text-muted/20">
          {/* Main actions */}
          <div className="flex justify-between gap-2 w-full">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isApplying}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyFix}
              disabled={isApplying || !hasFix}
              className="gap-1.5"
            >
              {isApplying ? (
                <>
                  <span className="animate-spin">...</span>
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Apply Fix
                </>
              )}
            </Button>
          </div>

          {/* Apply all similar action */}
          {onApplyAllSimilar && similarIssuesCount > 1 && hasFix && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleApplyAllSimilar}
              disabled={isApplying}
              className="w-full h-8 text-xs text-mythos-text-muted hover:text-mythos-text-primary"
            >
              <Layers className="w-3 h-3 mr-1.5" />
              Apply All {typeConfig.label} Fixes ({similarIssuesCount} issues)
            </Button>
          )}

          {/* Keyboard shortcut hint */}
          {hasFix && (
            <p className="text-[10px] text-mythos-text-muted text-center">
              Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-mythos-bg-tertiary font-mono">
                Cmd+Enter
              </kbd>{" "}
              to apply
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default StyleFixPreviewModal;
