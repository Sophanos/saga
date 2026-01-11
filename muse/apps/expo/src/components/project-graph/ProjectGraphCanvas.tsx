import { useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphLayout } from '@/hooks/useGraphLayout';
import { EntityNode, type EntityNodeData, type EntityNodeType } from './nodes/EntityNode';
import { RelationshipEdge, type RelationshipEdgeType } from './edges/RelationshipEdge';

interface ProjectGraphCanvasProps {
  nodes: EntityNodeType[];
  edges: RelationshipEdgeType[];
  onLayoutComplete?: () => void;
}

const ONLY_RENDER_VISIBLE_THRESHOLD = 200;
const MINIMAP_THRESHOLD = 300;
const EDGE_ANIMATION_THRESHOLD = 300;

export function ProjectGraphCanvas({ nodes: graphNodes, edges: graphEdges, onLayoutComplete }: ProjectGraphCanvasProps): JSX.Element {
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationshipEdgeType>([]);
  const { layout } = useGraphLayout();
  const layoutRunId = useRef(0);

  useEffect(() => {
    const runId = ++layoutRunId.current;

    const applyLayout = async () => {
      if (graphNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const layoutedNodes = await layout(graphNodes, graphEdges);
      if (runId !== layoutRunId.current) return;

      const allowEdgeAnimation = graphNodes.length <= EDGE_ANIMATION_THRESHOLD;
      const nextEdges = graphEdges.map((edge) => ({
        ...edge,
        animated: allowEdgeAnimation ? edge.animated : false,
      }));

      setNodes(layoutedNodes as EntityNodeType[]);
      setEdges(nextEdges);
      onLayoutComplete?.();
    };

    void applyLayout();
  }, [graphEdges, graphNodes, layout, onLayoutComplete, setEdges, setNodes]);

  // Cast to any to avoid React types version conflicts between @xyflow/react and @types/react
  const nodeTypes = useMemo(() => ({
    entityNode: EntityNode,
  }) as any, []);

  const edgeTypes = useMemo(() => ({
    relationshipEdge: RelationshipEdge,
  }) as any, []);

  const handleNodeClick: NodeMouseHandler<EntityNodeType> = () => {};

  const handleNodeDoubleClick: NodeMouseHandler<EntityNodeType> = () => {};

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      fitView
      minZoom={0.2}
      maxZoom={2}
      onlyRenderVisibleElements={graphNodes.length > ONLY_RENDER_VISIBLE_THRESHOLD}
      data-testid="project-graph-canvas"
      style={{ width: '100%', height: '100%' }}
    >
      <Background color="#e2e8f0" gap={16} />
      <Controls showInteractive={false} />
      {graphNodes.length <= MINIMAP_THRESHOLD && (
        <MiniMap
          nodeColor={(node) => (node.data as EntityNodeData)?.color ?? '#94a3b8'}
          nodeStrokeWidth={2}
          zoomable
          pannable
        />
      )}
    </ReactFlow>
  );
}
