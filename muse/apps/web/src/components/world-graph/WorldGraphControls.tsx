import { RotateCcw } from "lucide-react";
import { Button, cn } from "@mythos/ui";
import type { EntityType } from "@mythos/core";
import { getEntityTypeButtons } from "../../utils/entityConfig";

interface WorldGraphControlsProps {
  visibleTypes: Set<EntityType>;
  onToggleType: (type: EntityType) => void;
  onResetLayout: () => void;
  entityCount: number;
  relationshipCount: number;
}

const ENTITY_TYPE_BUTTONS = getEntityTypeButtons();

export function WorldGraphControls({
  visibleTypes,
  onToggleType,
  onResetLayout,
  entityCount,
  relationshipCount,
}: WorldGraphControlsProps) {
  return (
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10 pointer-events-none">
      {/* Entity type filters */}
      <div className="flex items-center gap-1 bg-mythos-bg-secondary/90 backdrop-blur-sm rounded-lg p-1 border border-mythos-text-muted/20 pointer-events-auto">
        {ENTITY_TYPE_BUTTONS.map(({ type, icon: Icon, label, color }) => {
          const isVisible = visibleTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              title={label}
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
        <div className="text-xs text-mythos-text-muted bg-mythos-bg-secondary/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-mythos-text-muted/20">
          <span className="text-mythos-text-secondary font-medium">{entityCount}</span> entities
          <span className="mx-2">·</span>
          <span className="text-mythos-text-secondary font-medium">{relationshipCount}</span> relationships
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onResetLayout}
          className="gap-1.5 bg-mythos-bg-secondary/90 backdrop-blur-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Layout
        </Button>
      </div>
    </div>
  );
}
