import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import { RELATIONSHIP_CATEGORY_COLORS, type RelationshipCategory } from '@mythos/core';
import type { GraphRelationType } from '@mythos/core';

export interface RelationshipEdgeData {
  relationshipId: string;
  relationType: GraphRelationType;
  label: string;
  category: RelationshipCategory;
  bidirectional?: boolean;
  [key: string]: unknown;
}

export type RelationshipEdgeType = Edge<RelationshipEdgeData>;

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
}: EdgeProps<RelationshipEdgeType>): JSX.Element {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as RelationshipEdgeData | undefined;
  const category = edgeData?.category ?? 'social';
  const color = RELATIONSHIP_CATEGORY_COLORS[category] ?? '#94a3b8';
  const label = edgeData?.label ?? '';

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: selected ? 2.6 : 2 }} />
      <EdgeLabelRenderer>
        <div
          data-testid={`pg-edge-${id}`}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            padding: '2px 8px',
            borderRadius: 999,
            backgroundColor: '#0f172a',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            pointerEvents: 'all',
            border: selected ? `1px solid ${color}` : '1px solid transparent',
          }}
        >
          {label}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
