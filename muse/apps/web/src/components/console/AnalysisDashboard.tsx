import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  PenTool,
  CheckCircle2,
  BarChart3,
  Sparkles,
  Clock,
  Eye,
  Ear,
  Hand,
  Wind,
  Cookie,
} from "lucide-react";
import { ScrollArea, cn } from "@mythos/ui";
import {
  useHistoryStore,
  useAnalysisHistory,
  useSessionStats,
  type ImprovementInsight,
} from "../../stores/history";

/**
 * Props for AnalysisDashboard component
 */
interface AnalysisDashboardProps {
  /** Optional class name for styling */
  className?: string;
}

/**
 * Mini area chart component using SVG
 */
function MiniAreaChart({
  data,
  color = "cyan",
  height = 48,
  showPoints = false,
}: {
  data: number[];
  color?: "cyan" | "purple" | "amber" | "red" | "green";
  height?: number;
  showPoints?: boolean;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-mythos-text-muted"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const colorMap = {
    cyan: {
      stroke: "stroke-mythos-accent-cyan",
      fill: "fill-mythos-accent-cyan/20",
      point: "fill-mythos-accent-cyan",
    },
    purple: {
      stroke: "stroke-mythos-accent-purple",
      fill: "fill-mythos-accent-purple/20",
      point: "fill-mythos-accent-purple",
    },
    amber: {
      stroke: "stroke-mythos-accent-amber",
      fill: "fill-mythos-accent-amber/20",
      point: "fill-mythos-accent-amber",
    },
    red: {
      stroke: "stroke-mythos-accent-red",
      fill: "fill-mythos-accent-red/20",
      point: "fill-mythos-accent-red",
    },
    green: {
      stroke: "stroke-green-500",
      fill: "fill-green-500/20",
      point: "fill-green-500",
    },
  };

  const colors = colorMap[color];
  const width = 200;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxValue = Math.max(...data, 1);
  const minValue = Math.min(...data, 0);
  const range = maxValue - minValue || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
    return { x, y, value };
  });

  // Create the line path
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Create the area path (closed polygon for fill)
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

  return (
    <svg width={width} height={height} className="w-full">
      {/* Area fill */}
      <path d={areaPath} className={colors.fill} />
      {/* Line stroke */}
      <path d={linePath} fill="none" strokeWidth={2} className={colors.stroke} />
      {/* Points */}
      {showPoints &&
        points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={3}
              className={colors.point}
            />
            <title>{p.value.toFixed(1)}</title>
          </g>
        ))}
    </svg>
  );
}

/**
 * Bar chart component using divs like TensionGraph
 */
function MiniBarChart({
  data,
  color = "cyan",
  height = 48,
  maxValue = 100,
}: {
  data: number[];
  color?: "cyan" | "purple" | "amber" | "red" | "green";
  height?: number;
  maxValue?: number;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-mythos-text-muted"
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const colorMap = {
    cyan: "bg-mythos-accent-cyan",
    purple: "bg-mythos-accent-purple",
    amber: "bg-mythos-accent-amber",
    red: "bg-mythos-accent-red",
    green: "bg-green-500",
  };

  const bgColor = colorMap[color];
  const displayData = data.slice(-20); // Show last 20 entries max

  return (
    <div
      className="flex items-end gap-0.5 bg-mythos-bg-secondary/30 rounded p-1"
      style={{ height }}
    >
      {displayData.map((value, index) => (
        <div
          key={index}
          className={cn("flex-1 min-w-0.5 rounded-t transition-all duration-300", bgColor)}
          style={{
            height: `${Math.max(4, (value / maxValue) * 100)}%`,
            opacity: 0.4 + (value / maxValue) * 0.6,
          }}
          title={`Value: ${value.toFixed(1)}`}
        />
      ))}
    </div>
  );
}

/**
 * Sensory trends mini visualization
 */
function SensoryTrendsChart({
  trends,
}: {
  trends: {
    sight: number[];
    sound: number[];
    touch: number[];
    smell: number[];
    taste: number[];
  };
}) {
  const senses = [
    { key: "sight", icon: Eye, label: "Sight", color: "bg-mythos-accent-cyan" },
    { key: "sound", icon: Ear, label: "Sound", color: "bg-mythos-accent-purple" },
    { key: "touch", icon: Hand, label: "Touch", color: "bg-mythos-accent-amber" },
    { key: "smell", icon: Wind, label: "Smell", color: "bg-green-500" },
    { key: "taste", icon: Cookie, label: "Taste", color: "bg-pink-500" },
  ] as const;

  const getAverage = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return (
    <div className="space-y-2">
      {senses.map(({ key, icon: Icon, label, color }) => {
        const values = trends[key];
        const avg = getAverage(values);
        const maxSeen = Math.max(...values, 5);

        return (
          <div key={key} className="flex items-center gap-2">
            <Icon className="w-3 h-3 text-mythos-text-muted flex-shrink-0" />
            <span className="text-xs text-mythos-text-muted w-10 flex-shrink-0">
              {label}
            </span>
            <div className="flex-1 h-2 bg-mythos-bg-secondary/50 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", color)}
                style={{ width: `${(avg / maxSeen) * 100}%`, opacity: 0.7 }}
              />
            </div>
            <span className="text-xs text-mythos-text-muted w-8 text-right">
              {avg.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Session stats card
 */
function SessionStatsCard() {
  const sessionStats = useSessionStats();

  const stats = [
    {
      label: "Words Written",
      value: sessionStats.wordsWritten,
      icon: PenTool,
      color: "text-mythos-accent-cyan",
    },
    {
      label: "Issues Fixed",
      value: sessionStats.issuesFixed,
      icon: CheckCircle2,
      color: "text-green-400",
    },
    {
      label: "Analysis Runs",
      value: sessionStats.analysisRuns,
      icon: BarChart3,
      color: "text-mythos-accent-purple",
    },
  ];

  const sessionDuration = useMemo(() => {
    if (!sessionStats.sessionStartedAt) return "Not started";
    const diff = Date.now() - sessionStats.sessionStartedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }, [sessionStats.sessionStartedAt]);

  return (
    <div className="p-3 rounded-md bg-mythos-bg-secondary/50 border border-mythos-text-muted/10">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-mythos-text-primary">Session Stats</h4>
        <div className="flex items-center gap-1 text-xs text-mythos-text-muted">
          <Clock className="w-3 h-3" />
          {sessionDuration}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="text-center">
            <div className={cn("flex items-center justify-center gap-1 mb-1", color)}>
              <Icon className="w-4 h-4" />
              <span className="text-lg font-semibold">{value}</span>
            </div>
            <p className="text-xs text-mythos-text-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Metrics trend card
 */
function MetricsTrendCard({
  title,
  icon: Icon,
  data,
  color,
  showTrend = true,
  chartType = "area",
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: number[];
  color: "cyan" | "purple" | "amber" | "red" | "green";
  showTrend?: boolean;
  chartType?: "area" | "bar";
}) {
  const trend = useMemo(() => {
    if (data.length < 2) return { direction: "neutral" as const, value: 0 };
    const recent = data.slice(-3);
    const older = data.slice(-6, -3);
    if (recent.length === 0 || older.length === 0)
      return { direction: "neutral" as const, value: 0 };

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const diff = ((recentAvg - olderAvg) / (olderAvg || 1)) * 100;

    if (diff > 5) return { direction: "up" as const, value: Math.abs(diff) };
    if (diff < -5) return { direction: "down" as const, value: Math.abs(diff) };
    return { direction: "neutral" as const, value: Math.abs(diff) };
  }, [data]);

  const currentValue = data.length > 0 ? data[data.length - 1] : 0;

  return (
    <div className="p-3 rounded-md bg-mythos-bg-secondary/50 border border-mythos-text-muted/10">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-mythos-text-muted" />
          <h4 className="text-sm font-medium text-mythos-text-primary">{title}</h4>
        </div>
        {showTrend && data.length >= 2 && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs",
              trend.direction === "up" && "text-green-400",
              trend.direction === "down" && "text-mythos-accent-red",
              trend.direction === "neutral" && "text-mythos-text-muted"
            )}
          >
            {trend.direction === "up" && <TrendingUp className="w-3 h-3" />}
            {trend.direction === "down" && <TrendingDown className="w-3 h-3" />}
            {trend.direction === "neutral" && <Activity className="w-3 h-3" />}
            {trend.value.toFixed(0)}%
          </div>
        )}
      </div>
      <div className="mb-2">
        {chartType === "area" ? (
          <MiniAreaChart data={data} color={color} height={48} />
        ) : (
          <MiniBarChart data={data} color={color} height={48} />
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-mythos-text-muted">{data.length} records</span>
        <span className="text-mythos-text-secondary">
          Current: <span className="font-medium">{currentValue.toFixed(1)}</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Improvement insights panel
 */
function InsightsPanel({ insights }: { insights: ImprovementInsight[] }) {
  if (insights.length === 0) return null;

  const sentimentConfig = {
    positive: {
      bgClass: "bg-green-500/10",
      borderClass: "border-green-500/30",
      iconClass: "text-green-400",
    },
    neutral: {
      bgClass: "bg-mythos-accent-cyan/10",
      borderClass: "border-mythos-accent-cyan/30",
      iconClass: "text-mythos-accent-cyan",
    },
    attention: {
      bgClass: "bg-mythos-accent-amber/10",
      borderClass: "border-mythos-accent-amber/30",
      iconClass: "text-mythos-accent-amber",
    },
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-mythos-accent-amber" />
        <h4 className="text-sm font-medium text-mythos-text-primary">
          Improvement Insights
        </h4>
      </div>
      {insights.map((insight, index) => {
        const config = sentimentConfig[insight.sentiment];
        return (
          <div
            key={index}
            className={cn(
              "p-3 rounded-md border",
              config.bgClass,
              config.borderClass
            )}
          >
            <div className="flex items-start gap-2">
              <Sparkles className={cn("w-4 h-4 mt-0.5 flex-shrink-0", config.iconClass)} />
              <p className="text-sm text-mythos-text-secondary">{insight.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-mythos-accent-cyan/10 flex items-center justify-center mb-4 ring-2 ring-mythos-accent-cyan/20">
        <BarChart3 className="w-7 h-7 text-mythos-accent-cyan" />
      </div>
      <h4 className="text-sm font-medium text-mythos-text-primary mb-1">
        No Historical Data Yet
      </h4>
      <p className="text-xs text-mythos-text-muted max-w-[220px] leading-relaxed">
        Start writing and running analysis to build up your metrics history. Trends and
        insights will appear here as you work.
      </p>
    </div>
  );
}

/**
 * AnalysisDashboard Component
 *
 * Shows historical writing metrics over time with charts and insights.
 * Displays session stats, tension trends, show-don't-tell scores,
 * sensory balance trends, and AI-generated improvement insights.
 */
export function AnalysisDashboard({ className }: AnalysisDashboardProps) {
  const analysisHistory = useAnalysisHistory();
  const generateInsights = useHistoryStore((state) => state.generateInsights);
  const getSensoryTrends = useHistoryStore((state) => state.getSensoryTrends);
  const getMetricsTrend = useHistoryStore((state) => state.getMetricsTrend);

  // Get trend data
  const tensionTrend = useMemo(() => getMetricsTrend("tension"), [getMetricsTrend]);
  const showDontTellTrend = useMemo(
    () => getMetricsTrend("showDontTell"),
    [getMetricsTrend]
  );
  const sensoryTotalTrend = useMemo(() => getMetricsTrend("sensory"), [getMetricsTrend]);
  const sensoryTrends = useMemo(() => getSensoryTrends(), [getSensoryTrends]);
  const insights = useMemo(() => generateInsights(), [generateInsights]);

  const hasData = analysisHistory.length > 0;

  return (
    <div className={cn("h-full flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-mythos-border-default">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-mythos-accent-cyan" />
          <h3 className="text-sm font-medium text-mythos-text-primary">
            Historical Metrics
          </h3>
        </div>
        <span className="text-xs text-mythos-text-muted">
          {analysisHistory.length} analysis records
        </span>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Session Stats */}
          <SessionStatsCard />

          {hasData ? (
            <>
              {/* Tension Trend */}
              <MetricsTrendCard
                title="Tension Over Time"
                icon={Activity}
                data={tensionTrend}
                color="red"
                chartType="bar"
              />

              {/* Show Don't Tell Trend */}
              <MetricsTrendCard
                title="Show Don't Tell Score"
                icon={PenTool}
                data={showDontTellTrend}
                color="cyan"
                chartType="area"
              />

              {/* Sensory Balance Section */}
              <div className="p-3 rounded-md bg-mythos-bg-secondary/50 border border-mythos-text-muted/10">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-mythos-text-muted" />
                  <h4 className="text-sm font-medium text-mythos-text-primary">
                    Sensory Balance (Averages)
                  </h4>
                </div>
                <SensoryTrendsChart trends={sensoryTrends} />
              </div>

              {/* Total Sensory Trend */}
              <MetricsTrendCard
                title="Total Sensory Details"
                icon={BarChart3}
                data={sensoryTotalTrend}
                color="purple"
                chartType="area"
              />

              {/* Improvement Insights */}
              <InsightsPanel insights={insights} />
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
