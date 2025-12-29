import { useCallback, useState } from "react";
import { RefreshCw, Lightbulb, Zap, BookOpen } from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import { TensionGraph } from "./TensionGraph";
import { SensoryHeatmap } from "./SensoryHeatmap";
import { ShowDontTellMeter } from "./ShowDontTellMeter";
import { StyleIssuesList } from "./StyleIssuesList";
import { StyleFixPreviewModal } from "./StyleFixPreviewModal";
import { useAnalysisData } from "../../hooks/useWritingAnalysis";
import { useEditorNavigation } from "../../hooks/useEditorNavigation";
import {
  useIsAnalyzing,
  usePacing,
  useMood,
  useInsights,
  useAnalysisStore,
  useStyleIssues,
} from "../../stores/analysis";
import type { StyleIssue } from "@mythos/core";

/**
 * Props for CoachView component
 */
interface CoachViewProps {
  /** Callback to trigger manual analysis */
  onRunAnalysis?: () => void;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Pacing indicator component
 */
function PacingIndicator() {
  const pacing = usePacing();

  const getPacingIcon = () => {
    switch (pacing) {
      case "accelerating":
        return <Zap className="w-4 h-4 text-mythos-accent-red" />;
      case "decelerating":
        return <BookOpen className="w-4 h-4 text-green-400" />;
      default:
        return <span className="w-4 h-4 text-mythos-accent-amber">~</span>;
    }
  };

  const getPacingLabel = () => {
    switch (pacing) {
      case "accelerating":
        return "Accelerating";
      case "decelerating":
        return "Decelerating";
      default:
        return "Steady";
    }
  };

  return (
    <div className="flex items-center gap-2">
      {getPacingIcon()}
      <span className="text-sm text-mythos-text-secondary">{getPacingLabel()}</span>
    </div>
  );
}

/**
 * Mood display component
 */
function MoodDisplay() {
  const mood = useMood();

  return (
    <div className="px-3 py-1.5 rounded-full bg-mythos-accent-purple/20 text-mythos-accent-purple text-sm capitalize">
      {mood}
    </div>
  );
}

/**
 * Insights panel component
 */
function InsightsPanel() {
  const insights = useInsights();

  if (insights.length === 0) {
    return null;
  }

  return (
    <div className="p-3 rounded-md bg-mythos-accent-cyan/10 border border-mythos-accent-cyan/30">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="w-4 h-4 text-mythos-accent-cyan" />
        <span className="text-sm font-medium text-mythos-accent-cyan">
          World Graph Insight
        </span>
      </div>
      <ul className="space-y-2">
        {insights.map((insight, index) => (
          <li
            key={index}
            className="text-xs text-mythos-text-secondary pl-6 relative before:content-[''] before:absolute before:left-2 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-mythos-accent-cyan/50"
          >
            {insight}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Section header component
 */
function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-mythos-text-muted" />
      <h3 className="text-sm font-medium text-mythos-text-primary">{title}</h3>
    </div>
  );
}

/**
 * Loading indicator badge (non-blocking)
 */
function AnalyzingBadge() {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-mythos-accent-cyan/10 text-mythos-accent-cyan text-xs">
      <RefreshCw className="w-3 h-3 animate-spin" />
      <span>Analyzing...</span>
    </div>
  );
}

/**
 * CoachView Component
 *
 * Main container for the Writing Coach analysis panel.
 * Combines TensionGraph, SensoryHeatmap, ShowDontTellMeter, and insights.
 */
export function CoachView({ onRunAnalysis, className }: CoachViewProps) {
  const isAnalyzing = useIsAnalyzing();
  const { metrics, error } = useAnalysisData();
  const { jumpToLine, applyTextReplacement, isReady } = useEditorNavigation();
  const dismissStyleIssue = useAnalysisStore((state) => state.dismissStyleIssue);
  const setSelectedStyleIssueId = useAnalysisStore(
    (state) => state.setSelectedStyleIssueId
  );

  // Style fix preview modal state
  const [previewIssue, setPreviewIssue] = useState<StyleIssue | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Get all style issues
  const styleIssues = useStyleIssues();

  // Jump to the location of a style issue
  const handleJumpToIssue = useCallback(
    (issue: StyleIssue) => {
      if (!isReady || issue.line === undefined) {
        console.warn("[CoachView] Cannot jump: editor not ready or no line number");
        return;
      }

      jumpToLine(issue.line, issue.text);
    },
    [isReady, jumpToLine]
  );

  // Open the fix preview modal for an issue
  const openStyleFixPreview = useCallback(
    (issue: StyleIssue) => {
      setPreviewIssue(issue);
      setIsPreviewOpen(true);
      setSelectedStyleIssueId(issue.id);
    },
    [setSelectedStyleIssueId]
  );

  // Close the fix preview modal
  const closeStyleFixPreview = useCallback(() => {
    setIsPreviewOpen(false);
    // Keep previewIssue for animation purposes, it will be replaced on next open
  }, []);

  // Handle selecting an issue (without opening preview)
  const handleSelectIssue = useCallback(
    (issue: StyleIssue) => {
      setSelectedStyleIssueId(issue.id);
      // Also jump to the issue in the editor
      if (isReady && issue.line !== undefined) {
        jumpToLine(issue.line, issue.text);
      }
    },
    [setSelectedStyleIssueId, isReady, jumpToLine]
  );

  // Apply a fix from the preview modal
  const applyStyleFixFromPreview = useCallback(
    (issueId: string) => {
      if (!isReady) {
        console.warn("[CoachView] Cannot apply fix: editor not ready");
        return;
      }

      const issue = styleIssues.find((i) => i.id === issueId);
      if (!issue?.fix) {
        console.warn("[CoachView] Cannot apply fix: no fix data");
        return;
      }

      // Apply the replacement using the navigation hook
      const success = applyTextReplacement(
        issue.fix.oldText,
        issue.fix.newText,
        issue.position
      );

      if (success) {
        // Dismiss the issue after successful fix
        dismissStyleIssue(issue.id);
        // Close the modal
        closeStyleFixPreview();
      }
    },
    [isReady, styleIssues, applyTextReplacement, dismissStyleIssue, closeStyleFixPreview]
  );

  // Count similar issues (same type as preview issue)
  const similarIssuesCount = previewIssue
    ? styleIssues.filter(
        (i) => i.type === previewIssue.type && Boolean(i.fix)
      ).length
    : 0;

  // Fix all fixable style issues
  const handleFixAll = useCallback(() => {
    if (!isReady) {
      console.warn("[CoachView] Cannot fix all: editor not ready");
      return;
    }

    const fixableIssues = styleIssues.filter((issue) => issue.fix);

    // Apply fixes in reverse order (bottom to top) to preserve line positions
    const sortedIssues = [...fixableIssues].sort(
      (a, b) => (b.line ?? 0) - (a.line ?? 0)
    );

    for (const issue of sortedIssues) {
      if (!issue.fix) continue;

      const success = applyTextReplacement(
        issue.fix.oldText,
        issue.fix.newText,
        issue.position
      );

      if (success) {
        dismissStyleIssue(issue.id);
      }
    }
  }, [isReady, styleIssues, applyTextReplacement, dismissStyleIssue]);

  // Apply all similar style fixes (same type as the preview issue)
  const applyAllSimilarStyleFixes = useCallback(
    (issueType: StyleIssue["type"]) => {
      if (!isReady) {
        console.warn("[CoachView] Cannot apply fixes: editor not ready");
        return;
      }

      const similarIssues = styleIssues.filter(
        (issue) => issue.type === issueType && issue.fix
      );

      // Apply fixes in reverse order (bottom to top) to preserve line positions
      const sortedIssues = [...similarIssues].sort(
        (a, b) => (b.line ?? 0) - (a.line ?? 0)
      );

      for (const issue of sortedIssues) {
        if (!issue.fix) continue;

        const success = applyTextReplacement(
          issue.fix.oldText,
          issue.fix.newText,
          issue.position
        );

        if (success) {
          dismissStyleIssue(issue.id);
        }
      }

      // Close the modal
      closeStyleFixPreview();
    },
    [isReady, styleIssues, applyTextReplacement, dismissStyleIssue, closeStyleFixPreview]
  );

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-mythos-text-muted/20">
        <div className="flex items-center gap-3">
          <PacingIndicator />
          <MoodDisplay />
          {isAnalyzing && <AnalyzingBadge />}
        </div>
        {onRunAnalysis && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRunAnalysis}
            disabled={isAnalyzing}
          >
            <RefreshCw
              className={cn("w-4 h-4", isAnalyzing && "animate-spin")}
            />
            Analyze
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 m-3 rounded bg-mythos-accent-red/10 border border-mythos-accent-red/30">
          <p className="text-xs text-mythos-accent-red">{error}</p>
        </div>
      )}

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-6">
          {/* Tension Section */}
          <section>
            <SectionHeader title="Tension Curve" icon={Zap} />
            <TensionGraph />
          </section>

          {/* Sensory Section */}
          <section>
            <SectionHeader title="Sensory Details" icon={Lightbulb} />
            <SensoryHeatmap />
          </section>

          {/* Show Don't Tell Section */}
          <section>
            <SectionHeader title="Prose Quality" icon={BookOpen} />
            <ShowDontTellMeter />
          </section>

          {/* Insights Section */}
          <section>
            <InsightsPanel />
          </section>

          {/* Style Issues Section */}
          <section>
            <StyleIssuesList
              onJumpToIssue={handleJumpToIssue}
              onApplyFix={openStyleFixPreview}
              onFixAll={handleFixAll}
              onSelectIssue={handleSelectIssue}
            />
          </section>

          {/* Empty state */}
          {!metrics && !isAnalyzing && !error && (
            <div className="text-center py-8">
              <p className="text-sm text-mythos-text-muted mb-2">
                No analysis data yet
              </p>
              <p className="text-xs text-mythos-text-muted">
                Start writing to see real-time feedback, or click Analyze.
              </p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Style Fix Preview Modal */}
      <StyleFixPreviewModal
        isOpen={isPreviewOpen}
        issue={previewIssue}
        onClose={closeStyleFixPreview}
        onApplyFix={applyStyleFixFromPreview}
        onApplyAllSimilar={applyAllSimilarStyleFixes}
        similarIssuesCount={similarIssuesCount}
      />
    </div>
  );
}
