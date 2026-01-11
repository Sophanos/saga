import { useCallback, useState } from "react";
import {
  RefreshCw,
  Lightbulb,
  Zap,
  BookOpen,
  GraduationCap,
  Pen,
  Sparkles,
  Shield,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import type { CommitDecisionArgs, CommitDecisionResult } from "@mythos/agent-protocol";
import { TensionGraph } from "./TensionGraph";
import { SensoryHeatmap } from "./SensoryHeatmap";
import { ShowDontTellMeter } from "./ShowDontTellMeter";
import { StyleIssuesList } from "./StyleIssuesList";
import { StyleFixPreviewModal } from "./StyleFixPreviewModal";
import { PinPolicyModal } from "../modals/PinPolicyModal";
import { useAnalysisData } from "../../hooks/useContentAnalysis";
import { useEditorNavigation } from "../../hooks/useEditorNavigation";
import { useToolRuntime } from "../../hooks/useToolRuntime";
import { getTool, type ToolDefinition } from "../../tools";
import {
  useIsAnalyzing,
  usePacing,
  useMood,
  useInsights,
  useAnalysisStore,
  useStyleIssues,
  useReadabilityMetrics,
  useCoachMode,
  usePolicyCompliance,
  usePolicySummary,
  type CoachMode,
} from "../../stores/analysis";
import { useMythosStore } from "../../stores";
import type { StyleIssue } from "@mythos/core";

function buildPolicyDecisionFromIssue(issue: StyleIssue): { decision: string; rationale: string } {
  const templates: Partial<Record<StyleIssue["type"], string>> = {
    telling: "Prefer showing (action/sensory detail) over telling.",
    passive: "Prefer active voice unless intentionally passive.",
    adverb: "Limit adverbs; choose stronger verbs/adjectives.",
    repetition: "Avoid repetition; vary phrasing and sentence structure.",
    ambiguous_pronoun: "Avoid ambiguous pronouns; make antecedents explicit.",
    unclear_antecedent: "Clarify references; ensure antecedents are unambiguous.",
    cliche: "Avoid clichés; use specific, original imagery.",
    filler_word: "Cut filler words and hedging language.",
    dangling_modifier: "Avoid dangling modifiers; ensure modifiers attach to the correct subject.",
  };

  const decision = templates[issue.type] ?? `Improve clarity: address ${issue.type} issues.`;
  const rationaleParts: string[] = [];

  rationaleParts.push("Pinned from coach issue.");
  if (issue.line !== undefined) {
    rationaleParts.push(`Line ${issue.line}.`);
  }
  rationaleParts.push(`Excerpt: "${issue.text}"`);
  rationaleParts.push(`Suggestion: ${issue.suggestion}`);

  return { decision, rationale: rationaleParts.join(" ") };
}

/**
 * Props for CoachView component
 */
interface CoachViewProps {
  /** Callback to trigger manual analysis */
  onRunAnalysis?: (mode?: CoachMode) => void;
  /** Optional class name for styling */
  className?: string;
}

/**
 * Coach mode configuration
 */
const COACH_MODES: Record<CoachMode, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  writing: {
    label: "Writing",
    icon: Pen,
    description: "Craft analysis: tension, sensory details, show-don't-tell",
  },
  clarity: {
    label: "Clarity",
    icon: Sparkles,
    description: "Language clarity: pronouns, clichés, filler words",
  },
  policy: {
    label: "Policy",
    icon: Shield,
    description: "Check against pinned style rules and policies",
  },
};

/**
 * Mode selector component
 */
function CoachModeSelector() {
  const coachMode = useCoachMode();
  const setCoachMode = useAnalysisStore((s) => s.setCoachMode);

  return (
    <div
      className="flex gap-1 p-1 rounded-lg bg-mythos-bg-tertiary/50"
      data-testid="coach-mode-selector"
    >
      {(Object.keys(COACH_MODES) as CoachMode[]).map((mode) => {
        const config = COACH_MODES[mode];
        const Icon = config.icon;
        const isActive = coachMode === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => setCoachMode(mode)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              isActive
                ? "bg-mythos-bg-primary text-mythos-text-primary shadow-sm"
                : "text-mythos-text-muted hover:text-mythos-text-secondary hover:bg-mythos-bg-tertiary/30"
            )}
            title={config.description}
            data-testid={`coach-mode-${mode}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Policy compliance panel component
 */
function PolicyCompliancePanel() {
  const compliance = usePolicyCompliance();
  const summary = usePolicySummary();

  if (!compliance && !summary) {
    return null;
  }

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-mythos-accent-amber";
    return "text-mythos-accent-red";
  };

  return (
    <div
      className="p-3 rounded-md bg-mythos-accent-purple/10 border border-mythos-accent-purple/30"
      data-testid="policy-compliance-panel"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-mythos-accent-purple" />
          <span className="text-sm font-medium text-mythos-text-primary">
            Policy Compliance
          </span>
        </div>
        {compliance && (
          <div className="flex items-center gap-2">
            <span className={cn("text-lg font-bold", getScoreColor(compliance.score))}>
              {compliance.score}%
            </span>
          </div>
        )}
      </div>

      {compliance && (
        <div className="flex items-center gap-4 text-xs text-mythos-text-muted mb-2">
          <span>{compliance.policiesChecked} policies checked</span>
          {compliance.conflictsFound > 0 && (
            <span className="text-mythos-accent-red flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {compliance.conflictsFound} conflicts
            </span>
          )}
          {compliance.conflictsFound === 0 && (
            <span className="text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              No conflicts
            </span>
          )}
        </div>
      )}

      {summary && (
        <p className="text-xs text-mythos-text-secondary">{summary}</p>
      )}
    </div>
  );
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
          Coaching Notes
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
 * Readability metrics panel
 */
function ReadabilityPanel() {
  const metrics = useReadabilityMetrics();

  if (!metrics) {
    return null;
  }

  // Convert grade level to label
  const getGradeLabel = (grade: number): string => {
    if (grade < 6) return "Elementary";
    if (grade < 9) return "Middle School";
    if (grade < 12) return "High School";
    if (grade < 16) return "College";
    return "Graduate";
  };

  // Color code reading ease
  const getEaseColor = (ease: number): string => {
    if (ease >= 60) return "text-green-400";
    if (ease >= 40) return "text-mythos-accent-amber";
    return "text-mythos-accent-red";
  };

  return (
    <div className="p-3 rounded-md bg-mythos-bg-tertiary/30 border border-mythos-text-muted/10">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="w-4 h-4 text-mythos-accent-purple" />
        <span className="text-sm font-medium text-mythos-text-primary">
          Readability
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Grade Level */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-mythos-text-muted mb-1">
            Grade Level
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-mythos-text-primary">
              {metrics.fleschKincaidGrade.toFixed(1)}
            </span>
            <span className="text-xs text-mythos-text-muted">
              ({getGradeLabel(metrics.fleschKincaidGrade)})
            </span>
          </div>
        </div>

        {/* Reading Ease */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-mythos-text-muted mb-1">
            Reading Ease
          </span>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-semibold ${getEaseColor(metrics.fleschReadingEase)}`}>
              {metrics.fleschReadingEase.toFixed(0)}
            </span>
            <span className="text-xs text-mythos-text-muted">/100</span>
          </div>
        </div>

        {/* Words per Sentence */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-mythos-text-muted mb-1">
            Avg Words/Sentence
          </span>
          <span className="text-sm text-mythos-text-secondary">
            {metrics.avgWordsPerSentence.toFixed(1)}
          </span>
        </div>

        {/* Word Count */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-mythos-text-muted mb-1">
            Word Count
          </span>
          <span className="text-sm text-mythos-text-secondary">
            {metrics.wordCount.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Long Sentence Warning */}
      {metrics.longSentencePct !== undefined && metrics.longSentencePct > 20 && (
        <div className="mt-3 p-2 rounded bg-mythos-accent-amber/10 border border-mythos-accent-amber/20">
          <p className="text-xs text-mythos-accent-amber">
            {metrics.longSentencePct.toFixed(0)}% of sentences are long (&gt;25 words).
            Consider breaking them up for better readability.
          </p>
        </div>
      )}
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
  const { buildContext } = useToolRuntime();
  const setSelectedMemoryId = useMythosStore((state) => state.setSelectedMemoryId);
  const manifestCollapsed = useMythosStore((state) => state.ui.manifestCollapsed);
  const toggleManifest = useMythosStore((state) => state.toggleManifest);
  const documentId = useMythosStore((state) => state.document.currentDocument?.id ?? null);
  const dismissStyleIssue = useAnalysisStore((state) => state.dismissStyleIssue);
  const setSelectedStyleIssueId = useAnalysisStore(
    (state) => state.setSelectedStyleIssueId
  );
  const coachMode = useCoachMode();

  // Style fix preview modal state
  const [previewIssue, setPreviewIssue] = useState<StyleIssue | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPinningPolicy, setIsPinningPolicy] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  // Pin policy modal state
  const [isPinPolicyModalOpen, setIsPinPolicyModalOpen] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<{ decision: string; rationale: string; issue: StyleIssue } | null>(null);

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

  // Open the pin policy modal (two-step approval)
  const openPinPolicyModal = useCallback(
    (issue: StyleIssue) => {
      const { decision, rationale } = buildPolicyDecisionFromIssue(issue);
      setPolicyDraft({ decision, rationale, issue });
      setIsPinPolicyModalOpen(true);
    },
    []
  );

  // Close the pin policy modal
  const closePinPolicyModal = useCallback(() => {
    setIsPinPolicyModalOpen(false);
    setPolicyDraft(null);
  }, []);

  // Confirm pin policy (called from modal)
  const confirmPinPolicy = useCallback(
    async (decision: string, rationale: string) => {
      const tool = getTool("commit_decision") as
        | ToolDefinition<CommitDecisionArgs, CommitDecisionResult>
        | undefined;
      if (!tool) {
        setPolicyError("commit_decision tool not registered");
        return;
      }

      const ctx = buildContext();
      if (!ctx) {
        setPolicyError("No project selected");
        return;
      }

      setIsPinningPolicy(true);
      setPolicyError(null);

      try {
        const result = await tool.execute(
          {
            decision,
            category: "policy",
            rationale,
            documentId: documentId ?? undefined,
            pinned: true,
          },
          ctx
        );

        if (!result.success || !result.result?.memoryId) {
          setPolicyError(result.error ?? "Failed to pin policy");
          return;
        }

        const memoryId = result.result.memoryId;
        setSelectedMemoryId(memoryId);
        if (manifestCollapsed) {
          toggleManifest();
        }

        closePinPolicyModal();
        closeStyleFixPreview();
      } catch (e) {
        setPolicyError(e instanceof Error ? e.message : "Failed to pin policy");
      } finally {
        setIsPinningPolicy(false);
      }
    },
    [buildContext, closePinPolicyModal, closeStyleFixPreview, documentId, manifestCollapsed, setSelectedMemoryId, toggleManifest]
  );

  // Legacy: direct pin from style fix preview (now opens modal)
  const pinPolicyFromIssue = useCallback(
    (issue: StyleIssue) => {
      openPinPolicyModal(issue);
    },
    [openPinPolicyModal]
  );

  // Jump to a canon citation in the manifest panel
  const handleJumpToCanon = useCallback(
    (memoryId: string) => {
      setSelectedMemoryId(memoryId);
      if (manifestCollapsed) {
        toggleManifest();
      }
    },
    [setSelectedMemoryId, manifestCollapsed, toggleManifest]
  );

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex flex-col gap-2 p-3 border-b border-mythos-border-default">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {coachMode === "writing" && (
              <>
                <PacingIndicator />
                <MoodDisplay />
              </>
            )}
            {isAnalyzing && <AnalyzingBadge />}
          </div>
          {onRunAnalysis && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRunAnalysis(coachMode)}
              disabled={isAnalyzing}
              data-testid="coach-analyze-button"
            >
              <RefreshCw
                className={cn("w-4 h-4", isAnalyzing && "animate-spin")}
              />
              Analyze
            </Button>
          )}
        </div>
        <CoachModeSelector />
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 m-3 rounded bg-mythos-accent-red/10 border border-mythos-accent-red/30">
          <p className="text-xs text-mythos-accent-red">{error}</p>
        </div>
      )}
      {policyError && (
        <div className="p-3 m-3 rounded bg-mythos-accent-amber/10 border border-mythos-accent-amber/30">
          <p className="text-xs text-mythos-accent-amber">{policyError}</p>
        </div>
      )}

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-6">
          {/* Writing Mode Content */}
          {coachMode === "writing" && (
            <>
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
            </>
          )}

          {/* Clarity Mode Content */}
          {coachMode === "clarity" && (
            <>
              {/* Readability Section */}
              <section>
                <ReadabilityPanel />
              </section>
            </>
          )}

          {/* Policy Mode Content */}
          {coachMode === "policy" && (
            <>
              {/* Policy Compliance Section */}
              <section>
                <PolicyCompliancePanel />
              </section>
            </>
          )}

          {/* Style Issues Section - shown in all modes */}
          <section>
            <StyleIssuesList
              mode={coachMode}
              onJumpToIssue={handleJumpToIssue}
              onApplyFix={openStyleFixPreview}
              onFixAll={handleFixAll}
              onSelectIssue={handleSelectIssue}
              onJumpToCanon={handleJumpToCanon}
              onPinPolicy={pinPolicyFromIssue}
            />
          </section>

          {/* Empty state */}
          {!metrics && !isAnalyzing && !error && (
            <div className="text-center py-8" data-testid="coach-empty-state">
              <p className="text-sm text-mythos-text-muted mb-2">
                No analysis data yet
              </p>
              <p className="text-xs text-mythos-text-muted">
                {coachMode === "writing" && "Start writing to see real-time feedback, or click Analyze."}
                {coachMode === "clarity" && "Click Analyze to check for clarity issues."}
                {coachMode === "policy" && "Click Analyze to check against pinned policies."}
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
        onPinPolicy={pinPolicyFromIssue}
        isPinningPolicy={isPinningPolicy}
      />

      {/* Pin Policy Modal */}
      <PinPolicyModal
        isOpen={isPinPolicyModalOpen}
        decision={policyDraft?.decision ?? ""}
        rationale={policyDraft?.rationale ?? ""}
        onClose={closePinPolicyModal}
        onConfirm={confirmPinPolicy}
        isPinning={isPinningPolicy}
      />
    </div>
  );
}
