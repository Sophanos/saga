import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { User, MapPin, Sword, Wand2, Building2, Calendar, Sparkles } from "lucide-react";
import { cn } from "@mythos/ui";
import type { EntityType } from "@mythos/core";
import { ENTITY_TYPE_CONFIG } from "@mythos/core";

export interface EntityNodeData extends Record<string, unknown> {
  entityId: string;
  name: string;
  type: EntityType;
  selected?: boolean;
}

// Full node type for React Flow
export type EntityNodeType = Node<EntityNodeData, "entityNode">;

// Map icon names to components
const ICON_MAP: Record<string, typeof User> = {
  User,
  MapPin,
  Sword,
  Wand2,
  Building2,
  Calendar,
  Sparkles,
};

// Entity type colors (hex values for inline styles)
const ENTITY_COLORS: Record<EntityType, string> = {
  character: "#22d3ee", // cyan
  location: "#22c55e",  // green
  item: "#f59e0b",      // amber
  magic_system: "#8b5cf6", // violet
  faction: "#a855f7",   // purple
  event: "#f97316",     // orange
  concept: "#64748b",   // slate
};

function EntityNodeComponent({ data, selected }: NodeProps<EntityNodeType>) {
  const nodeData = data as EntityNodeData;
  const config = ENTITY_TYPE_CONFIG[nodeData.type];
  const IconComponent = ICON_MAP[config?.icon ?? "Sparkles"] ?? Sparkles;
  const borderColor = ENTITY_COLORS[nodeData.type] ?? "#64748b";

  return (
    <>
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-mythos-text-muted/50 !border-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-mythos-text-muted/50 !border-none"
      />

      {/* Node content */}
      <div
        className={cn(
          "px-4 py-3 rounded-lg border-2 transition-all",
          "bg-mythos-bg-secondary shadow-lg",
          "min-w-[120px] max-w-[180px]",
          selected || nodeData.selected
            ? "ring-2 ring-mythos-accent-cyan ring-offset-2 ring-offset-mythos-bg-primary"
            : "hover:shadow-xl"
        )}
        style={{ borderColor }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${borderColor}20` }}
          >
            <IconComponent
              className="w-4 h-4"
              style={{ color: borderColor }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-mythos-text-primary truncate">
              {nodeData.name}
            </div>
            <div className="text-[10px] text-mythos-text-muted capitalize">
              {nodeData.type.replace("_", " ")}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const EntityNode = memo(EntityNodeComponent);
