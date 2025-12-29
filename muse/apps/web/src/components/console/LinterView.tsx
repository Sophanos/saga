import { useState, useMemo, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Wand2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  User,
  Globe,
  GitBranch,
  Clock,
  MapPin,
  Eye,
  Undo2,
  Redo2,
  type LucideIcon,
} from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import {
  useLinterIssues,
  useIsLinting,
  useLinterError,
  type LinterIssue,
} from "../../stores";
import { useCanUndo, useCanRedo, useUndoCount } from "../../stores/undo";
import { FixPreviewModal } from "./FixPreviewModal";
import {
  SEVERITY_CONFIG,
  ISSUE_TYPE_CONFIG,
  type Severity,
  type LinterIssueType,
  type SeverityIconName,
  type IssueTypeIconName,
} from "@mythos/core";

/**
 * Props for LinterView component
 */
interface LinterViewProps {
  /** Callback to jump to an issue location in the editor by issueId */
  onJumpToPosition?: (issueId: string) => void;
  /** Callback to jump to a related location by line number and text */
  onJumpToRelatedLocation?: (line: number, text: string) => void;
  /** Callback to apply a fix for an issue */
  onApplyFix?: (issueId: string, fix: string) => void;
  /** Callback to undo the last fix */
  onUndo?: () => boolean;
  /** Callback to redo the last undone fix */
  onRedo?: () => boolean;
  /** Optional class name for styling */
  className?: string;
}

type IssueType = LinterIssue["type"];

/**
 * Map severity icon names to React components
 */
const SEVERITY_ICONS: Record<SeverityIconName, LucideIcon> = {
  AlertCircle,
  AlertTriangle,
  Info,
};

/**
 * Map issue type icon names to React components
 */
const ISSUE_TYPE_ICONS: Record<IssueTypeIconName, LucideIcon> = {
  User,
  Globe,
  GitBranch,
  Clock,
};

/**
 * Get icon component for severity
 */
function getSeverityIconComponent(severity: Severity): LucideIcon {
  const iconName = SEVERITY_CONFIG[severity]?.icon ?? "Info";
  return SEVERITY_ICONS[iconName] ?? Info;
}

/**
 * Get icon component for issue type
 */
function getIssueTypeIconComponent(type: LinterIssueType): LucideIcon {
  const iconName = ISSUE_TYPE_CONFIG[type]?.icon ?? "User";
  return ISSUE_TYPE_ICONS[iconName] ?? User;
}

/**
 * Generate a unique ID for an issue (fallback if issue doesn't have one)
 */
function generateIssueId(issue: LinterIssue, index: number): string {
  return issue.id || `${issue.type}-${issue.severity}-${issue.location.line}-${index}`;
}

/**
 * Severity badge in header
 */
function SeverityBadge({
  severity,
  count,
}: {
  severity: Severity;
  count: number;
}) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = getSeverityIconComponent(severity);

  if (count === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all",
        config.badgeBg,
        config.textClass
      )}
    >
      <Icon className="w-3 h-3" />
      {count}
    </span>
  );
}

/**
 * Issue type badge
 */
function IssueTypeBadge({ type }: { type: IssueType }) {
  const config = ISSUE_TYPE_CONFIG[type as LinterIssueType];
  const Icon = getIssueTypeIconComponent(type as LinterIssueType);

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

/**
 * Individual issue item
 */
function IssueItem({
  issue,
  issueId,
  onJumpToPosition,
  onJumpToRelatedLocation,
  onApplyFix,
  onPreview,
}: {
  issue: LinterIssue;
  issueId: string;
  onJumpToPosition?: (issueId: string) => void;
  onJumpToRelatedLocation?: (line: number, text: string) => void;
  onApplyFix?: (issueId: string, fix: string) => void;
  onPreview?: (issue: LinterIssue) => void;
}) {
  const severityConf = SEVERITY_CONFIG[issue.severity];
  const SeverityIcon = getSeverityIconComponent(issue.severity);
  const hasFix = Boolean(issue.suggestion);

  return (
    <div
      className={cn(
        "group p-3 rounded-md border transition-all duration-200",
        "bg-mythos-bg-secondary/50 border-mythos-text-muted/10",
        "hover:bg-mythos-bg-secondary hover:border-mythos-text-muted/20",
        "hover:shadow-lg hover:shadow-black/20"
      )}
    >
      {/* Header row: severity icon, type badge, line number */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <SeverityIcon className={cn("w-4 h-4", severityConf.textClass)} />
          <IssueTypeBadge type={issue.type} />
        </div>
        <div className="flex items-center gap-2">
          {issue.location.line !== undefined && (
            <button
              onClick={() => onJumpToPosition?.(issueId)}
              className={cn(
                "flex items-center gap-1 text-xs text-mythos-text-muted",
                "hover:text-mythos-accent-cyan transition-colors",
                "opacity-70 group-hover:opacity-100"
              )}
              title="Jump to location"
            >
              <MapPin className="w-3 h-3" />
              <span className="font-mono">Line {issue.location.line}</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      <p className="text-sm text-mythos-text-primary mb-2 leading-relaxed">
        {issue.message}
      </p>

      {/* Quoted text */}
      {issue.location.text && (
        <p
          className={cn(
            "text-sm mb-3 pl-3 py-1.5 border-l-2 italic",
            severityConf.textClass,
            "border-current opacity-70"
          )}
        >
          "{issue.location.text}"
        </p>
      )}

      {/* Suggestion */}
      {issue.suggestion && (
        <div className="flex items-start gap-2 p-2 rounded bg-mythos-bg-tertiary/50 mb-2">
          <Sparkles className="w-3 h-3 text-mythos-accent-cyan mt-0.5 shrink-0" />
          <p className="text-xs text-mythos-text-secondary flex-1">
            <span className="text-mythos-text-muted font-medium">
              Suggestion:{" "}
            </span>
            {issue.suggestion}
          </p>
        </div>
      )}

      {/* Related locations */}
      {issue.relatedLocations && issue.relatedLocations.length > 0 && (
        <div className="mt-2 pt-2 border-t border-mythos-text-muted/10">
          <p className="text-xs text-mythos-text-muted mb-1">
            Related locations:
          </p>
          <div className="space-y-1">
            {issue.relatedLocations.map((loc, idx) => (
              <button
                key={idx}
                onClick={() => onJumpToRelatedLocation?.(loc.line, loc.text)}
                className="flex items-center gap-2 text-xs text-mythos-text-secondary hover:text-mythos-accent-cyan transition-colors w-full text-left"
              >
                <MapPin className="w-3 h-3 text-mythos-text-muted" />
                <span className="font-mono">Line {loc.line}</span>
                <span className="truncate opacity-60">"{loc.text}"</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {hasFix && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-mythos-text-muted/10">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs opacity-70 hover:opacity-100"
            onClick={() => onPreview?.(issue)}
          >
            <Eye className="w-3 h-3" />
            Preview
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs opacity-70 hover:opacity-100"
            onClick={() => onApplyFix?.(issueId, issue.suggestion)}
          >
            <Wand2 className="w-3 h-3" />
            Auto-Fix
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible severity section
 */
function SeveritySection({
  severity,
  issues,
  onJumpToPosition,
  onJumpToRelatedLocation,
  onApplyFix,
  onPreview,
}: {
  severity: Severity;
  issues: Array<{ issue: LinterIssue; id: string }>;
  onJumpToPosition?: (issueId: string) => void;
  onJumpToRelatedLocation?: (line: number, text: string) => void;
  onApplyFix?: (issueId: string, fix: string) => void;
  onPreview?: (issue: LinterIssue) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const config = SEVERITY_CONFIG[severity];
  const Icon = getSeverityIconComponent(severity);

  if (issues.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Section header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between p-2 rounded-md transition-all",
          "hover:bg-mythos-bg-tertiary/50",
          config.bgClass
        )}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className={cn("w-4 h-4", config.textClass)} />
          ) : (
            <ChevronRight className={cn("w-4 h-4", config.textClass)} />
          )}
          <Icon className={cn("w-4 h-4", config.textClass)} />
          <span className={cn("text-sm font-medium", config.textClass)}>
            {config.label}
          </span>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-xs font-medium",
            config.badgeBg,
            config.textClass
          )}
        >
          {issues.length}
        </span>
      </button>

      {/* Issues list */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-2 pt-2 pl-6">
          {issues.map(({ issue, id }) => (
            <IssueItem
              key={id}
              issue={issue}
              issueId={id}
              onJumpToPosition={onJumpToPosition}
              onJumpToRelatedLocation={onJumpToRelatedLocation}
              onApplyFix={onApplyFix}
              onPreview={onPreview}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-4 ring-2 ring-green-500/20">
        <CheckCircle2 className="w-7 h-7 text-green-400" />
      </div>
      <h4 className="text-sm font-medium text-mythos-text-primary mb-1">
        No Consistency Issues
      </h4>
      <p className="text-xs text-mythos-text-muted max-w-[220px] leading-relaxed">
        Your narrative is internally consistent. Characters, world details, and
        timeline all align perfectly.
      </p>
    </div>
  );
}

/**
 * Loading overlay component
 */
function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-mythos-bg-primary/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <RefreshCw className="w-6 h-6 text-mythos-accent-cyan animate-spin" />
          <div className="absolute inset-0 w-6 h-6 rounded-full bg-mythos-accent-cyan/20 animate-ping" />
        </div>
        <span className="text-sm text-mythos-text-secondary">
          Analyzing consistency...
        </span>
      </div>
    </div>
  );
}

/**
 * Header component with stats and actions
 */
function LinterHeader({
  issues,
  isRunning,
  onFixAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  undoCount,
}: {
  issues: LinterIssue[];
  isRunning: boolean;
  onFixAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
}) {
  const counts = useMemo(() => {
    return {
      error: issues.filter((i) => i.severity === "error").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      info: issues.filter((i) => i.severity === "info").length,
    };
  }, [issues]);

  const fixableCount = issues.filter((i) => Boolean(i.suggestion)).length;
  const totalCount = issues.length;

  return (
    <div className="flex items-center justify-between p-3 border-b border-mythos-text-muted/20">
      <div className="flex items-center gap-3">
        {/* Total count */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-mythos-text-primary">
            {totalCount} {totalCount === 1 ? "Issue" : "Issues"}
          </span>
        </div>

        {/* Severity badges */}
        <div className="flex items-center gap-1.5">
          <SeverityBadge severity="error" count={counts.error} />
          <SeverityBadge severity="warning" count={counts.warning} />
          <SeverityBadge severity="info" count={counts.info} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onUndo}
            disabled={!canUndo || isRunning}
            className="h-7 w-7 p-0 relative"
            title={canUndo ? `Undo (${undoCount} available)` : "Nothing to undo"}
          >
            <Undo2 className="w-3.5 h-3.5" />
            {undoCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-mythos-accent-cyan text-[10px] font-medium text-mythos-bg-primary flex items-center justify-center">
                {undoCount > 9 ? "9+" : undoCount}
              </span>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRedo}
            disabled={!canRedo || isRunning}
            className="h-7 w-7 p-0"
            title={canRedo ? "Redo" : "Nothing to redo"}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Fix All button */}
        {fixableCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={onFixAll}
            disabled={isRunning}
            className="h-7 text-xs"
          >
            <Wand2 className="w-3 h-3" />
            Fix All ({fixableCount})
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * LinterView Component
 *
 * Displays consistency issues from the ConsistencyLinter agent,
 * grouped by severity with collapsible sections. Provides actions
 * for jumping to issue locations and applying suggested fixes.
 */
export function LinterView({
  onJumpToPosition,
  onJumpToRelatedLocation,
  onApplyFix,
  onUndo,
  onRedo,
  className,
}: LinterViewProps) {
  const issues = useLinterIssues();
  const isRunning = useIsLinting();
  const error = useLinterError();

  // Undo/redo state from store
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const undoCount = useUndoCount();

  // Preview modal state
  const [previewIssue, setPreviewIssue] = useState<LinterIssue | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Group issues by severity with IDs
  const groupedIssues = useMemo(() => {
    const withIds = issues.map((issue, index) => ({
      issue,
      id: generateIssueId(issue, index),
    }));

    const grouped: Record<Severity, Array<{ issue: LinterIssue; id: string }>> = {
      error: [],
      warning: [],
      info: [],
    };

    withIds.forEach((item) => {
      grouped[item.issue.severity].push(item);
    });

    return grouped;
  }, [issues]);

  // Count similar issues for bulk fix
  const getSimilarIssuesCount = useCallback(
    (issueType: IssueType) => {
      return issues.filter((i) => i.type === issueType && Boolean(i.suggestion)).length;
    },
    [issues]
  );

  // Handle opening preview modal
  const handleOpenPreview = useCallback((issue: LinterIssue) => {
    setPreviewIssue(issue);
    setIsPreviewOpen(true);
  }, []);

  // Handle closing preview modal
  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreviewIssue(null);
  }, []);

  // Handle applying fix from preview modal
  const handleApplyFromPreview = useCallback(
    (issueId: string) => {
      if (previewIssue) {
        onApplyFix?.(issueId, previewIssue.suggestion);
        handleClosePreview();
      }
    },
    [previewIssue, onApplyFix, handleClosePreview]
  );

  // Handle applying all similar fixes
  const handleApplyAllSimilar = useCallback(
    (issueType: IssueType) => {
      const similarIssues = issues
        .map((issue, index) => ({
          issue,
          id: generateIssueId(issue, index),
        }))
        .filter(({ issue }) => issue.type === issueType && Boolean(issue.suggestion));

      similarIssues.forEach(({ id, issue }) => {
        onApplyFix?.(id, issue.suggestion);
      });

      handleClosePreview();
    },
    [issues, onApplyFix, handleClosePreview]
  );

  // Handle Fix All action
  const handleFixAll = useCallback(() => {
    const fixableIssues = issues
      .map((issue, index) => ({
        issue,
        id: generateIssueId(issue, index),
      }))
      .filter(({ issue }) => Boolean(issue.suggestion));

    fixableIssues.forEach(({ id, issue }) => {
      onApplyFix?.(id, issue.suggestion);
    });
  }, [issues, onApplyFix]);

  // Handle undo
  const handleUndo = useCallback(() => {
    onUndo?.();
  }, [onUndo]);

  // Handle redo
  const handleRedo = useCallback(() => {
    onRedo?.();
  }, [onRedo]);

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {/* Loading overlay */}
      {isRunning && <LoadingOverlay />}

      {/* Header */}
      <LinterHeader
        issues={issues}
        isRunning={isRunning}
        onFixAll={handleFixAll}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        undoCount={undoCount}
      />

      {/* Error state */}
      {error && (
        <div className="p-3 m-3 rounded bg-mythos-accent-red/10 border border-mythos-accent-red/30">
          <p className="text-xs text-mythos-accent-red">{error}</p>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {issues.length === 0 && !error ? (
            <EmptyState />
          ) : (
            <>
              {/* Render sections in severity order */}
              {(["error", "warning", "info"] as Severity[]).map((severity) => (
                <SeveritySection
                  key={severity}
                  severity={severity}
                  issues={groupedIssues[severity]}
                  onJumpToPosition={onJumpToPosition}
                  onJumpToRelatedLocation={onJumpToRelatedLocation}
                  onApplyFix={onApplyFix}
                  onPreview={handleOpenPreview}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Fix Preview Modal */}
      <FixPreviewModal
        isOpen={isPreviewOpen}
        issue={previewIssue}
        onClose={handleClosePreview}
        onApplyFix={handleApplyFromPreview}
        onApplyAllSimilar={handleApplyAllSimilar}
        similarIssuesCount={previewIssue ? getSimilarIssuesCount(previewIssue.type) : 0}
      />
    </div>
  );
}
