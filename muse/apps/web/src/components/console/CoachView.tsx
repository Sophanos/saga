import { RefreshCw, Lightbulb, Zap, BookOpen } from "lucide-react";
import { Button, ScrollArea, cn } from "@mythos/ui";
import { TensionGraph } from "./TensionGraph";
import { SensoryHeatmap } from "./SensoryHeatmap";
import { ShowDontTellMeter } from "./ShowDontTellMeter";
import { StyleIssuesList } from "./StyleIssuesList";
import { useAnalysisData } from "../../hooks/useWritingAnalysis";
import {
  useIsAnalyzing,
  usePacing,
  useMood,
  useInsights,
} from "../../stores/analysis";

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
 * Loading overlay component
 */
function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-mythos-bg-primary/80 flex items-center justify-center z-10">
      <div className="flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-mythos-accent-cyan animate-spin" />
        <span className="text-sm text-mythos-text-secondary">Analyzing...</span>
      </div>
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

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {/* Loading overlay */}
      {isAnalyzing && <LoadingOverlay />}

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-mythos-text-muted/20">
        <div className="flex items-center gap-3">
          <PacingIndicator />
          <MoodDisplay />
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
            <StyleIssuesList />
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
    </div>
  );
}
