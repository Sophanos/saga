import { RotateCcw } from "lucide-react";
import { Button, cn } from "@mythos/ui";
import type { GraphEntityType } from "@mythos/core";
import { resolveLucideIcon } from "../../utils/iconResolver";

export interface ProjectGraphTypeOption {
  type: GraphEntityType;
  label: string;
  iconName?: string;
  color?: string;
}

interface ProjectGraphControlsProps {
  visibleTypes: Set<GraphEntityType>;
  onToggleType: (type: GraphEntityType) => void;
  onResetLayout: () => void;
  entityCount: number;
  relationshipCount: number;
  typeOptions: ProjectGraphTypeOption[];
}

export function ProjectGraphControls({
  visibleTypes,
  onToggleType,
  onResetLayout,
  entityCount,
  relationshipCount,
  typeOptions,
}: ProjectGraphControlsProps) {
  return (
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
      {/* Entity type filters */}
      <div className="flex items-center gap-1 bg-mythos-bg-secondary/90 backdrop-blur-sm rounded-lg p-1 border border-mythos-border-default pointer-events-auto">
        {typeOptions.map(({ type, label, iconName, color }) => {
          const isVisible = visibleTypes.has(type);
          const Icon = resolveLucideIcon(iconName);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              title={label}
              data-testid={`project-graph-toggle-${type}`}
              className={cn(
                "p-2 rounded-md transition-all",
                isVisible
                  ? "bg-mythos-bg-tertiary"
                  : "opacity-40 hover:opacity-70"
              )}
              style={{
                color: isVisible ? color : undefined,
              }}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* Stats and actions */}
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="text-xs text-mythos-text-muted bg-mythos-bg-secondary/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-mythos-border-default">
          <span
            className="text-mythos-text-secondary font-medium"
            data-testid="pg-entity-count"
          >
            {entityCount}
          </span>{" "}
          entities
          <span className="mx-2">·</span>
          <span
            className="text-mythos-text-secondary font-medium"
            data-testid="pg-relationship-count"
          >
            {relationshipCount}
          </span>{" "}
          relationships
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onResetLayout}
          className="gap-1.5 bg-mythos-bg-secondary/90 backdrop-blur-sm"
          data-testid="project-graph-reset-layout"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Layout
        </Button>
      </div>
    </div>
  );
}
