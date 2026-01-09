import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { cn } from "@mythos/ui";
import type { EntityType } from "@mythos/core";
import {
  getEntityIconComponent,
  getEntityHexColor,
} from "../../../utils/entityConfig";

export interface EntityNodeData extends Record<string, unknown> {
  entityId: string;
  name: string;
  type: EntityType;
  selected?: boolean;
}

// Full node type for React Flow
export type EntityNodeType = Node<EntityNodeData, "entityNode">;

function EntityNodeComponent({ data, selected }: NodeProps<EntityNodeType>) {
  const nodeData = data as EntityNodeData;
  const IconComponent = getEntityIconComponent(nodeData.type);
  const borderColor = getEntityHexColor(nodeData.type);

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
            ? "ring-2 ring-mythos-accent-primary ring-offset-2 ring-offset-mythos-bg-primary"
            : "hover:shadow-xl"
        )}
        style={{ borderColor }}
        data-testid={`wg-node-${nodeData.entityId}`}
        data-entity-type={nodeData.type}
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
