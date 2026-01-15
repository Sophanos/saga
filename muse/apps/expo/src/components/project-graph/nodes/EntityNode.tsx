import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { useTheme } from '@/design-system';

export interface EntityNodeData {
  entityId: string;
  name: string;
  type: string;
  iconName?: string;
  displayName?: string;
  color: string;
  [key: string]: unknown;
}

export type EntityNodeType = Node<EntityNodeData>;

function EntityNodeComponent({ data, selected }: NodeProps<EntityNodeType>): JSX.Element {
  const { colors, isDark } = useTheme();
  const nodeData = data as EntityNodeData;
  const borderColor = nodeData.color || colors.textMuted;
  const backgroundColor = selected
    ? 'rgba(59, 130, 246, 0.12)'
    : isDark ? colors.bgElevated : colors.bgApp;
  const typeLabel = nodeData.displayName ?? nodeData.type.replace('_', ' ');

  return (
    <div
      data-testid={`pg-node-${nodeData.entityId}`}
      style={{
        minWidth: 160,
        padding: '10px 12px',
        borderRadius: 10,
        border: `2px solid ${borderColor}`,
        backgroundColor,
        boxShadow: selected
          ? `0 8px 24px ${isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(15, 23, 42, 0.12)'}`
          : `0 6px 18px ${isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(15, 23, 42, 0.08)'}`,
        color: colors.text,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor }} />
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{nodeData.name}</div>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.textMuted }}>
        {typeLabel}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: borderColor }} />
    </div>
  );
}

export const EntityNode = memo(EntityNodeComponent);
