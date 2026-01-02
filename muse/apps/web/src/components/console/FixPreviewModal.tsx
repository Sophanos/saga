import { useCallback } from "react";
import {
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Layers,
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
import type { LinterIssue } from "../../stores";
import {
  SEVERITY_CONFIG,
  getIssueTypeLabel,
  type Severity,
  type LinterIssueType,
  type SeverityIconName,
} from "@mythos/core";
import { DiffView, InlineDiffView } from "./DiffViews";

/**
 * Props for FixPreviewModal component
 */
interface FixPreviewModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** The issue being previewed */
  issue: LinterIssue | null;
  /** Close the modal */
  onClose: () => void;
  /** Apply the fix */
  onApplyFix: (issueId: string) => void;
  /** Apply all similar fixes (optional) */
  onApplyAllSimilar?: (issueType: LinterIssue["type"]) => void;
  /** Count of similar issues that could be fixed (optional) */
  similarIssuesCount?: number;
  /** Whether a fix is currently being applied */
  isApplying?: boolean;
}

/**
 * Map severity icon names to React components
 */
const SEVERITY_ICONS: Record<SeverityIconName, LucideIcon> = {
  AlertCircle,
  AlertTriangle,
  Info,
};

/**
 * Get icon component for severity
 */
function getSeverityIconComponent(severity: Severity): LucideIcon {
  const iconName = SEVERITY_CONFIG[severity]?.icon ?? "Info";
  return SEVERITY_ICONS[iconName] ?? Info;
}

/**
 * FixPreviewModal Component
 *
 * Displays a preview of a linter fix before applying it.
 * Shows the original text, proposed fix, and actions to apply or cancel.
 */
export function FixPreviewModal({
  isOpen,
  issue,
  onClose,
  onApplyFix,
  onApplyAllSimilar,
  similarIssuesCount = 0,
  isApplying = false,
}: FixPreviewModalProps) {
  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        if (issue) {
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

  const severityConf = SEVERITY_CONFIG[issue.severity as Severity];
  const SeverityIcon = getSeverityIconComponent(issue.severity as Severity);
  const hasSuggestion = Boolean(issue.suggestion);
  const hasOriginalText = Boolean(issue.location.text);
  const canShowDiff = hasSuggestion && hasOriginalText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fix-preview-title"
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
              <div
                className={cn(
                  "p-2 rounded-md",
                  severityConf.bgClass
                )}
              >
                <SeverityIcon className={cn("w-5 h-5", severityConf.textClass)} />
              </div>
              <div>
                <CardTitle id="fix-preview-title" className="text-lg">
                  Preview Fix
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                      severityConf.bgClass,
                      severityConf.textClass
                    )}
                  >
                    {severityConf.label}
                  </span>
                  <span className="text-mythos-text-muted">
                    {getIssueTypeLabel(issue.type as LinterIssueType)} Issue
                  </span>
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
          {/* Issue description */}
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
              Issue
            </span>
            <p className="text-sm text-mythos-text-primary leading-relaxed">
              {issue.message}
            </p>
          </div>

          {/* Location info */}
          {issue.location.line !== undefined && (
            <div className="flex items-center gap-2 text-xs text-mythos-text-muted">
              <span className="font-mono bg-mythos-bg-tertiary px-1.5 py-0.5 rounded">
                Line {issue.location.line}
              </span>
            </div>
          )}

          {/* Diff view */}
          {canShowDiff ? (
            <div className="space-y-3">
              <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
                Proposed Change
              </span>
              <DiffView
                before={issue.location.text}
                after={issue.suggestion}
              />

              {/* Inline diff for quick reference */}
              <div className="pt-2">
                <span className="text-xs text-mythos-text-muted mb-2 block">
                  Quick view:
                </span>
                <InlineDiffView
                  before={issue.location.text}
                  after={issue.suggestion}
                />
              </div>
            </div>
          ) : hasSuggestion ? (
            <div className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wider text-mythos-text-muted">
                Suggestion
              </span>
              <div
                className={cn(
                  "p-3 rounded-md border",
                  "bg-mythos-accent-green/5 border-mythos-accent-green/20"
                )}
              >
                <p className="text-sm text-mythos-text-primary">
                  {issue.suggestion}
                </p>
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

        <CardFooter className="flex flex-col gap-3 pt-4 border-t border-mythos-border-default">
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
              disabled={isApplying || !hasSuggestion}
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
          {onApplyAllSimilar && similarIssuesCount > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleApplyAllSimilar}
              disabled={isApplying}
              className="w-full h-8 text-xs text-mythos-text-muted hover:text-mythos-text-primary"
            >
              <Layers className="w-3 h-3 mr-1.5" />
              Apply All Similar ({similarIssuesCount} issues)
            </Button>
          )}

          {/* Keyboard shortcut hint */}
          <p className="text-[10px] text-mythos-text-muted text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-mythos-bg-tertiary font-mono">Cmd+Enter</kbd> to apply
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

export default FixPreviewModal;
