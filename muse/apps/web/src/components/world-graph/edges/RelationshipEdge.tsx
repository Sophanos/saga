import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import type { RelationType } from "@mythos/core";
import {
  RELATIONSHIP_CATEGORY_COLORS,
  type RelationshipCategory,
} from "@mythos/core";

export interface RelationshipEdgeData extends Record<string, unknown> {
  relationshipId: string;
  relationType: RelationType;
  label: string;
  category: RelationshipCategory;
  bidirectional?: boolean;
}

// Full edge type for React Flow
export type RelationshipEdgeType = Edge<RelationshipEdgeData, "relationshipEdge">;

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<RelationshipEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as RelationshipEdgeData | undefined;
  const category = edgeData?.category ?? "social";
  const color = RELATIONSHIP_CATEGORY_COLORS[category] ?? "#94a3b8";
  const label = edgeData?.label ?? "";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : 1.5,
          opacity: selected ? 1 : 0.7,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute pointer-events-auto nodrag nopan"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <div
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${color}20`,
              color: color,
              border: `1px solid ${color}40`,
            }}
          >
            {label}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
