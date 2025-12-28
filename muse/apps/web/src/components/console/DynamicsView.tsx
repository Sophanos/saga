import { useState } from "react";
import { Eye, EyeOff, ArrowRight, Sparkles, Zap, Shield, Ghost } from "lucide-react";
import { ScrollArea, cn } from "@mythos/ui";
import type { Interaction, InteractionType } from "@mythos/core";
import { useInteractions } from "../../stores/dynamics";

// Mock data for initial development
const MOCK_INTERACTIONS: Interaction[] = [
  {
    id: "1",
    source: "Kael",
    action: "ENTERS",
    target: "Valdris",
    type: "neutral",
    time: "Sc 1",
    createdAt: new Date("2024-01-01T10:00:00"),
  },
  {
    id: "2",
    source: "Kael",
    action: "EQUIPS",
    target: "Shadow Blade",
    type: "passive",
    time: "Sc 1",
    effect: "+2 STR",
    createdAt: new Date("2024-01-01T10:05:00"),
  },
  {
    id: "3",
    source: "Shadow Blade",
    action: "CORRUPTS",
    target: "Kael",
    type: "hidden",
    time: "Sc 1",
    effect: "-2 WIS",
    note: "Player unaware",
    createdAt: new Date("2024-01-01T10:06:00"),
  },
  {
    id: "4",
    source: "Kael",
    action: "ATTACKS",
    target: "Guard Captain",
    type: "hostile",
    time: "Sc 2",
    effect: "-15 HP",
    createdAt: new Date("2024-01-01T11:00:00"),
  },
  {
    id: "5",
    source: "Mysterious Figure",
    action: "OBSERVES",
    target: "Kael",
    type: "hidden",
    time: "Sc 2",
    note: "Foreshadowing villain",
    createdAt: new Date("2024-01-01T11:05:00"),
  },
];

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

  // Use store interactions or fall back to mock data
  const storeInteractions = useInteractions();
  const interactions =
    storeInteractions.length > 0 ? storeInteractions : MOCK_INTERACTIONS;

  const hiddenCount = interactions.filter((i) => i.type === "hidden").length;
  const hostileCount = interactions.filter((i) => i.type === "hostile").length;

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats */}
      <div className="p-3 border-b border-mythos-text-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs">
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
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-0">
          {interactions.length === 0 ? (
            <div className="text-center py-8 text-mythos-text-muted text-sm">
              No interactions recorded yet.
              <br />
              <span className="text-xs">
                Add events as they occur in your story.
              </span>
            </div>
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
