import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Sparkles, Zap, Shield, Ghost, Loader2 } from "lucide-react";
import { ScrollArea, cn } from "@mythos/ui";
import type { Interaction, InteractionType } from "@mythos/core";
import { useInteractions, useDynamicsStore } from "../../stores/dynamics";

/**
 * Loading skeleton for interaction timeline
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-3 h-3 rounded-full bg-mythos-text-muted/30" />
          <div className="flex-1 p-3 rounded-md bg-mythos-bg-secondary/30">
            <div className="h-3 w-16 bg-mythos-text-muted/20 rounded mb-2" />
            <div className="h-4 w-3/4 bg-mythos-text-muted/20 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty state when no interactions detected
 */
function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="w-12 h-12 rounded-full bg-mythos-accent-purple/10 flex items-center justify-center mx-auto mb-3">
        <Ghost className="w-6 h-6 text-mythos-accent-purple/50" />
      </div>
      <h4 className="text-sm font-medium text-mythos-text-primary mb-1">
        No Interactions Yet
      </h4>
      <p className="text-xs text-mythos-text-muted max-w-[220px] mx-auto">
        Write more prose with character actions and dialogue to see dynamics extracted automatically.
      </p>
    </div>
  );
}

interface InteractionNodeProps {
  interaction: Interaction;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function getTypeColor(type: InteractionType): string {
  switch (type) {
    case "hostile":
      return "bg-mythos-accent-red";
    case "hidden":
      return "bg-mythos-accent-purple";
    case "passive":
      return "bg-mythos-accent-cyan";
    case "neutral":
    default:
      return "bg-mythos-text-muted";
  }
}

function getTypeBorderColor(type: InteractionType): string {
  switch (type) {
    case "hostile":
      return "border-mythos-accent-red/30";
    case "hidden":
      return "border-mythos-accent-purple/30";
    case "passive":
      return "border-mythos-accent-cyan/30";
    case "neutral":
    default:
      return "border-mythos-text-muted/30";
  }
}

function getTypeIcon(type: InteractionType) {
  switch (type) {
    case "hostile":
      return <Zap className="w-3 h-3 text-mythos-accent-red" />;
    case "hidden":
      return <Ghost className="w-3 h-3 text-mythos-accent-purple" />;
    case "passive":
      return <Shield className="w-3 h-3 text-mythos-accent-cyan" />;
    case "neutral":
    default:
      return null;
  }
}

function InteractionNode({
  interaction,
  isSelected,
  onSelect,
}: InteractionNodeProps) {
  const typeColor = getTypeColor(interaction.type);
  const typeBorderColor = getTypeBorderColor(interaction.type);
  const typeIcon = getTypeIcon(interaction.type);

  return (
    <div className="flex items-start gap-3 group">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-3 h-3 rounded-full shrink-0 transition-transform",
            typeColor,
            isSelected && "ring-2 ring-white ring-offset-2 ring-offset-mythos-bg-secondary scale-125"
          )}
        />
        <div className="w-px h-full bg-mythos-text-muted/20 min-h-[40px]" />
      </div>

      {/* Content */}
      <button
        onClick={() => onSelect(interaction.id)}
        className={cn(
          "flex-1 text-left p-3 rounded-md border transition-all -mt-1 mb-2",
          typeBorderColor,
          isSelected
            ? "bg-mythos-bg-tertiary border-opacity-60"
            : "bg-mythos-bg-secondary/50 hover:bg-mythos-bg-tertiary/50"
        )}
      >
        {/* Time marker */}
        <div className="flex items-center gap-2 text-xs text-mythos-text-muted mb-1">
          <span className="font-mono">{interaction.time}</span>
          {typeIcon}
        </div>

        {/* Flow: Source -> Action -> Target */}
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="text-mythos-accent-cyan font-medium">
            {interaction.source}
          </span>
          <ArrowRight className="w-3 h-3 text-mythos-text-muted" />
          <span className="text-mythos-text-secondary font-medium uppercase text-xs tracking-wide">
            {interaction.action}
          </span>
          <ArrowRight className="w-3 h-3 text-mythos-text-muted" />
          <span className="text-mythos-accent-amber font-medium">
            {interaction.target}
          </span>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {interaction.effect && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-mythos-accent-cyan/20 text-mythos-accent-cyan">
              {interaction.effect}
            </span>
          )}
          {interaction.type === "hidden" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-mythos-accent-purple/20 text-mythos-accent-purple flex items-center gap-1">
              <EyeOff className="w-3 h-3" />
              Hidden
            </span>
          )}
          {interaction.type === "hostile" && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-mythos-accent-red/20 text-mythos-accent-red flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Hostile
            </span>
          )}
        </div>

        {/* Hidden note (DM only) */}
        {interaction.note && (
          <p className="text-xs text-mythos-accent-purple/70 mt-2 italic flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {interaction.note}
          </p>
        )}
      </button>
    </div>
  );
}

interface DynamicsInsightProps {
  hiddenCount: number;
  hostileCount: number;
}

function DynamicsInsight({ hiddenCount, hostileCount }: DynamicsInsightProps) {
  const insights: string[] = [];

  if (hiddenCount > 0) {
    insights.push(
      `${hiddenCount} hidden interaction${hiddenCount > 1 ? "s" : ""} may create dramatic tension later`
    );
  }

  if (hostileCount > 0) {
    insights.push(
      `${hostileCount} hostile action${hostileCount > 1 ? "s" : ""} detected - ensure consequences follow`
    );
  }

  if (insights.length === 0) {
    insights.push("Scene dynamics are balanced. Consider adding tension points.");
  }

  return (
    <div className="p-3 border-t border-mythos-text-muted/20 bg-mythos-bg-tertiary/50">
      <div className="flex items-center gap-2 text-xs text-mythos-text-muted mb-2">
        <Sparkles className="w-3 h-3 text-mythos-accent-amber" />
        <span className="font-medium uppercase tracking-wide">
          Dynamics Insight
        </span>
      </div>
      <ul className="text-xs text-mythos-text-secondary space-y-1">
        {insights.map((insight, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-mythos-accent-cyan">*</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DynamicsView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Read from dynamics store - no mock fallback
  const interactions = useInteractions();
  const isLoading = useDynamicsStore((state) => state.isLoading);
  const error = useDynamicsStore((state) => state.error);

  const hiddenCount = interactions.filter((i) => i.type === "hidden").length;
  const hostileCount = interactions.filter((i) => i.type === "hostile").length;

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats */}
      <div className="p-3 border-b border-mythos-text-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
          {isLoading ? (
            <span className="flex items-center gap-1 text-mythos-accent-cyan">
              <Loader2 className="w-3 h-3 animate-spin" />
              Extracting...
            </span>
          ) : (
            <>
              <span className="text-mythos-text-muted">
                {interactions.length} events
              </span>
              {hiddenCount > 0 && (
                <span className="flex items-center gap-1 text-mythos-accent-purple">
                  <Ghost className="w-3 h-3" />
                  {hiddenCount} hidden
                </span>
              )}
              {hostileCount > 0 && (
                <span className="flex items-center gap-1 text-mythos-accent-red">
                  <Zap className="w-3 h-3" />
                  {hostileCount} hostile
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 m-3 rounded bg-mythos-accent-red/10 border border-mythos-accent-red/30">
          <p className="text-xs text-mythos-accent-red">{error}</p>
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-0">
          {isLoading && interactions.length === 0 ? (
            <LoadingSkeleton />
          ) : interactions.length === 0 ? (
            <EmptyState />
          ) : (
            interactions.map((interaction) => (
              <InteractionNode
                key={interaction.id}
                interaction={interaction}
                isSelected={selectedId === interaction.id}
                onSelect={setSelectedId}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* AI Insights panel */}
      <DynamicsInsight hiddenCount={hiddenCount} hostileCount={hostileCount} />
    </div>
  );
}
