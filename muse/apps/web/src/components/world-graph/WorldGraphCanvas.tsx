import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMythosStore } from "../../stores";
import { useWorldGraph } from "../../hooks/useWorldGraph";
import { useGraphLayout } from "../../hooks/useGraphLayout";
import { EntityNode, type EntityNodeData, type EntityNodeType } from "./nodes/EntityNode";
import { RelationshipEdge, type RelationshipEdgeType } from "./edges/RelationshipEdge";
import type { EntityType } from "@mythos/core";

// Custom node and edge types
const nodeTypes = {
  entityNode: EntityNode,
};

const edgeTypes = {
  relationshipEdge: RelationshipEdge,
};

interface WorldGraphCanvasProps {
  visibleTypes: Set<EntityType>;
  onLayoutComplete?: () => void;
}

export function WorldGraphCanvas({
  visibleTypes,
  onLayoutComplete,
}: WorldGraphCanvasProps) {
  const { nodes: graphNodes, edges: graphEdges } = useWorldGraph({ visibleTypes });
  const { layout } = useGraphLayout({ algorithm: "layered", direction: "DOWN" });

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationshipEdgeType>([]);

  const setSelectedEntity = useMythosStore((s) => s.setSelectedEntity);
  const showHud = useMythosStore((s) => s.showHud);
  const openModal = useMythosStore((s) => s.openModal);
  const entities = useMythosStore((s) => s.world.entities);

  // Apply layout when nodes change
  useEffect(() => {
    const applyLayout = async () => {
      if (graphNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const layoutedNodes = await layout(graphNodes, graphEdges);
      setNodes(layoutedNodes as EntityNodeType[]);
      setEdges(graphEdges as RelationshipEdgeType[]);
      onLayoutComplete?.();
    };

    applyLayout();
  }, [graphNodes, graphEdges, layout, setNodes, setEdges, onLayoutComplete]);

  // Handle node click - select entity and show HUD
  const handleNodeClick: NodeMouseHandler<EntityNodeType> = useCallback(
    (event, node) => {
      event.stopPropagation();
      const data = node.data as EntityNodeData;
      const entity = entities.get(data.entityId);
      if (entity) {
        setSelectedEntity(entity.id);
        showHud(entity, { x: event.clientX, y: event.clientY });
      }
    },
    [entities, setSelectedEntity, showHud]
  );

  // Handle node double click - open edit modal
  const handleNodeDoubleClick: NodeMouseHandler<EntityNodeType> = useCallback(
    (event, node) => {
      event.stopPropagation();
      const data = node.data as EntityNodeData;
      openModal({
        type: "entityForm",
        mode: "edit",
        entityId: data.entityId,
      });
    },
    [openModal]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      defaultEdgeOptions={{
        type: "relationshipEdge",
      }}
      proOptions={{ hideAttribution: true }}
      className="bg-mythos-bg-primary"
    >
      <Background
        color="#334155"
        gap={20}
        size={1}
      />
      <Controls
        className="!bg-mythos-bg-secondary !border-mythos-text-muted/20 !rounded-lg !shadow-lg [&>button]:!bg-mythos-bg-secondary [&>button]:!border-mythos-text-muted/20 [&>button]:!text-mythos-text-secondary [&>button:hover]:!bg-mythos-bg-tertiary"
      />
      <MiniMap
        className="!bg-mythos-bg-secondary !border-mythos-text-muted/20 !rounded-lg"
        nodeColor={(node) => {
          const data = node.data as EntityNodeData;
          const colors: Record<EntityType, string> = {
            character: "#22d3ee",
            location: "#22c55e",
            item: "#f59e0b",
            magic_system: "#8b5cf6",
            faction: "#a855f7",
            event: "#f97316",
            concept: "#64748b",
          };
          return colors[data.type] ?? "#64748b";
        }}
        maskColor="rgba(7, 7, 10, 0.7)"
      />
    </ReactFlow>
  );
}
