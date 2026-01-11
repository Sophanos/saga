import { useCallback, useEffect, useRef } from "react";
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
import { useProjectGraph } from "../../hooks/useProjectGraph";
import { useGraphLayout } from "../../hooks/useGraphLayout";
import { EntityNode, type EntityNodeData, type EntityNodeType } from "./nodes/EntityNode";
import { RelationshipEdge, type RelationshipEdgeType } from "./edges/RelationshipEdge";
import type { GraphEntityType, ProjectGraphRegistryDisplay } from "@mythos/core";

// Custom node and edge types
const nodeTypes = {
  entityNode: EntityNode,
};

const edgeTypes = {
  relationshipEdge: RelationshipEdge,
};

const ONLY_RENDER_VISIBLE_THRESHOLD = 200;
const MINIMAP_THRESHOLD = 300;
const EDGE_ANIMATION_THRESHOLD = 300;

interface ProjectGraphCanvasProps {
  visibleTypes: Set<GraphEntityType>;
  registry?: ProjectGraphRegistryDisplay | null;
  onLayoutComplete?: () => void;
}

export function ProjectGraphCanvas({
  visibleTypes,
  registry,
  onLayoutComplete,
}: ProjectGraphCanvasProps) {
  const { nodes: graphNodes, edges: graphEdges } = useProjectGraph({ visibleTypes, registry });
  const { layout } = useGraphLayout({ algorithm: "layered", direction: "DOWN" });

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationshipEdgeType>([]);
  const layoutRunId = useRef(0);

  const setSelectedEntity = useMythosStore((s) => s.setSelectedEntity);
  const showHud = useMythosStore((s) => s.showHud);
  const openModal = useMythosStore((s) => s.openModal);
  const entities = useMythosStore((s) => s.world.entities);
  const selectedEntityId = useMythosStore((s) => s.world.selectedEntityId);

  // Apply layout when nodes change
  useEffect(() => {
    layoutRunId.current += 1;
    const runId = layoutRunId.current;

    const applyLayout = async () => {
      if (graphNodes.length === 0) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const layoutedNodes = await layout(graphNodes, graphEdges);
      if (runId !== layoutRunId.current) {
        return;
      }

      const allowEdgeAnimation = graphNodes.length <= EDGE_ANIMATION_THRESHOLD;
      const nextEdges = graphEdges.map((edge) => ({
        ...edge,
        animated: allowEdgeAnimation ? edge.animated : false,
      }));

      setNodes(layoutedNodes as EntityNodeType[]);
      setEdges(nextEdges as RelationshipEdgeType[]);
      onLayoutComplete?.();
    };

    applyLayout();
  }, [graphNodes, graphEdges, layout, setNodes, setEdges, onLayoutComplete]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        selected: node.id === selectedEntityId,
      }))
    );
  }, [selectedEntityId, setNodes]);

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
      onlyRenderVisibleElements={graphNodes.length > ONLY_RENDER_VISIBLE_THRESHOLD}
      defaultEdgeOptions={{
        type: "relationshipEdge",
      }}
      proOptions={{ hideAttribution: true }}
      className="bg-mythos-bg-primary"
      data-testid="project-graph-canvas"
    >
      <Background
        color="#334155"
        gap={20}
        size={1}
      />
      <Controls
        className="!bg-mythos-bg-secondary !border-mythos-border-default !rounded-lg !shadow-lg [&>button]:!bg-mythos-bg-secondary [&>button]:!border-mythos-border-default [&>button]:!text-mythos-text-secondary [&>button:hover]:!bg-mythos-bg-tertiary"
      />
      {graphNodes.length <= MINIMAP_THRESHOLD && (
        <MiniMap
          className="!bg-mythos-bg-secondary !border-mythos-border-default !rounded-lg"
          nodeColor={(node) => {
            const data = node.data as EntityNodeData;
            return data.color;
          }}
          maskColor="rgba(7, 7, 10, 0.7)"
        />
      )}
    </ReactFlow>
  );
}
