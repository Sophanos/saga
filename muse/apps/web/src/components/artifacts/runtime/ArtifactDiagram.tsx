import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng, toSvg } from "html-to-image";
import type { ArtifactEnvelopeByType, DiagramEdge, DiagramNode } from "@mythos/core";
import type { ArtifactOp } from "@mythos/state";
import { useMythosStore } from "../../../stores";
import type { ArtifactRendererHandle, ArtifactExportResult } from "./ArtifactRuntime";

interface ArtifactDiagramProps {
  envelope: Extract<ArtifactEnvelopeByType, { type: "diagram" }>;
  focusId: string | null;
  onApplyOp: (op: ArtifactOp) => void;
}

interface DiagramNodeData {
  title: string;
  subtitle?: string;
  color?: string;
  status?: string;
  entityId?: string;
}

function ArtifactEntityNode({ data, selected }: { data: DiagramNodeData; selected: boolean }): JSX.Element {
  return (
    <div
      className={
        "min-w-[140px] rounded-lg border border-mythos-border-default bg-mythos-bg-secondary px-3 py-2 shadow-lg"
      }
    >
      <div className="text-sm font-medium text-mythos-text-primary">{data.title}</div>
      {data.subtitle && (
        <div className="text-[10px] text-mythos-text-muted">{data.subtitle}</div>
      )}
      {data.status && (
        <div className="text-[10px] text-mythos-text-secondary">{data.status}</div>
      )}
      {selected && <div className="mt-1 text-[9px] text-mythos-accent">Selected</div>}
    </div>
  );
}

function ArtifactDiagramComponent(
  { envelope, focusId, onApplyOp }: ArtifactDiagramProps,
  ref: React.Ref<ArtifactRendererHandle>
): JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const openModal = useMythosStore((s) => s.openModal);
  const entities = useMythosStore((s) => s.world.entities);

  const nodes = useMemo<Node[]>(() => {
    return envelope.data.nodeOrder
      .map((nodeId) => envelope.data.nodesById[nodeId])
      .filter(Boolean)
      .map((node: DiagramNode) => ({
        id: node.nodeId,
        type: "artifactEntity",
        position: node.position,
        data: {
          title: node.data.title,
          subtitle: node.data.subtitle,
          status: node.data.status,
          entityId: node.data.entityId,
        } satisfies DiagramNodeData,
      }));
  }, [envelope.data.nodeOrder, envelope.data.nodesById]);

  const edges = useMemo<Edge[]>(() => {
    return envelope.data.edgeOrder
      .map((edgeId) => envelope.data.edgesById[edgeId])
      .filter(Boolean)
      .map((edge: DiagramEdge) => ({
        id: edge.edgeId,
        source: edge.source,
        target: edge.target,
        label: edge.data?.label,
        type: "smoothstep",
      }));
  }, [envelope.data.edgeOrder, envelope.data.edgesById]);

  const [renderNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [renderEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [edges, nodes, setEdges, setNodes]);

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const edgeId = `edge-${Date.now()}`;
    onApplyOp({
      type: "diagram.edge.add",
      edge: {
        edgeId,
        source: connection.source,
        target: connection.target,
        type: "relationshipEdge",
        data: { label: "" },
      },
    });
  };

  const handleNodeClick: NodeMouseHandler = (event, node) => {
    event.stopPropagation();
    const data = node.data as unknown as DiagramNodeData;
    if (data.entityId) {
      const entity = entities.get(data.entityId);
      if (entity) {
        openModal({
          type: "entityForm",
          mode: "edit",
          entityId: entity.id,
        });
      }
    }
  };

  const handleNodeDragStop = (_event: React.MouseEvent, node: Node) => {
    onApplyOp({
      type: "diagram.node.move",
      nodeId: node.id,
      position: node.position,
    });
  };

  useEffect(() => {
    if (!focusId) return;
    const focusNode = renderNodes.find((node) => node.id === focusId);
    if (focusNode) {
      flowInstanceRef.current?.fitView({ nodes: [focusNode], padding: 0.4, duration: 400 });
      return;
    }
  }, [focusId, renderNodes]);

  const handleExport = async (format: "png" | "svg" | "json"): Promise<ArtifactExportResult | null> => {
    if (format === "json") {
      return { format: "json", json: JSON.stringify(envelope, null, 2) };
    }
    if (!wrapperRef.current) return null;
    if (format === "svg") {
      try {
        const dataUrl = await toSvg(wrapperRef.current);
        return { format: "svg", dataUrl };
      } catch (error) {
        console.warn("[ArtifactDiagram] SVG export failed, falling back to PNG", error);
      }
    }
    const dataUrl = await toPng(wrapperRef.current);
    return { format: "png", dataUrl };
  };

  const handleFocus = useCallback((elementId: string) => {
    const focusNode = renderNodes.find((node) => node.id === elementId);
    if (focusNode) {
      flowInstanceRef.current?.fitView({ nodes: [focusNode], padding: 0.4, duration: 400 });
    }
  }, [renderNodes]);

  const handleExportCb = useCallback(handleExport, [envelope]);

  useImperativeHandle(ref, () => ({
    exportArtifact: handleExportCb,
    focusElement: handleFocus,
  }), [handleExportCb, handleFocus]);

  return (
    <div ref={wrapperRef} className="h-[360px] rounded-lg border border-mythos-border-default">
      <ReactFlow
        nodes={renderNodes}
        edges={renderEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        fitView
        nodeTypes={{ artifactEntity: ArtifactEntityNode }}
        defaultEdgeOptions={{ type: "smoothstep" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="!bg-mythos-bg-secondary !border-mythos-border-default !rounded-lg" />
      </ReactFlow>
    </div>
  );
}

export const ArtifactDiagram = forwardRef(ArtifactDiagramComponent);
