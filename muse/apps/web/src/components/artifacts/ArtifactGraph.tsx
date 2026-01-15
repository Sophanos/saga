import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@mythos/ui";
import { parseArtifactEnvelope } from "@mythos/core";
import type { Artifact } from "@mythos/state";

type ArtifactReference = {
  artifactId: string;
  elementId?: string;
  label?: string;
};

export interface ArtifactGraphProps {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  className?: string;
  onOpenArtifact: (artifactId: string, elementId?: string | null) => void;
}

type ArtifactNodeData = {
  title: string;
  type: string;
  isActive: boolean;
};

function getArtifactReferences(artifact: Artifact): ArtifactReference[] {
  if (artifact.format !== "json") return [];
  try {
    const envelope = parseArtifactEnvelope(JSON.parse(artifact.content));
    return (envelope.references ?? []) as ArtifactReference[];
  } catch {
    return [];
  }
}

function ArtifactNode({ data }: { data: ArtifactNodeData }): JSX.Element {
  return (
    <div
      className={cn(
        "min-w-[180px] rounded-lg border bg-mythos-bg-secondary px-3 py-2 shadow-sm",
        data.isActive ? "border-mythos-accent" : "border-mythos-border-default"
      )}
    >
      <div className="text-sm font-medium text-mythos-text-primary truncate">
        {data.title}
      </div>
      <div className="text-[11px] text-mythos-text-muted">{data.type}</div>
    </div>
  );
}

function buildNodes(params: {
  artifacts: Artifact[];
  activeArtifactId: string | null;
}): Node<ArtifactNodeData>[] {
  const { artifacts, activeArtifactId } = params;
  const cols = Math.max(1, Math.ceil(Math.sqrt(artifacts.length)));
  const xSpacing = 240;
  const ySpacing = 150;

  return artifacts.map((artifact, index) => {
    const x = (index % cols) * xSpacing;
    const y = Math.floor(index / cols) * ySpacing;
    return {
      id: artifact.id,
      type: "artifactNode",
      position: { x, y },
      data: {
        title: artifact.title,
        type: artifact.type,
        isActive: artifact.id === activeArtifactId,
      },
      draggable: false,
    };
  });
}

function buildEdges(artifacts: Artifact[]): Edge[] {
  const edges: Edge[] = [];
  let counter = 0;

  for (const artifact of artifacts) {
    const refs = getArtifactReferences(artifact);
    for (const ref of refs) {
      counter++;
      edges.push({
        id: `edge-${artifact.id}-${ref.artifactId}-${counter}`,
        source: artifact.id,
        target: ref.artifactId,
        animated: false,
        data: { elementId: ref.elementId, label: ref.label },
      });
    }
  }

  return edges;
}

export function ArtifactGraph({
  artifacts,
  activeArtifactId,
  className,
  onOpenArtifact,
}: ArtifactGraphProps): JSX.Element {
  const nodes = useMemo(
    () => buildNodes({ artifacts, activeArtifactId }),
    [activeArtifactId, artifacts]
  );

  const edges = useMemo(() => buildEdges(artifacts), [artifacts]);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      onOpenArtifact(String(node.id), null);
    },
    [onOpenArtifact]
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      const elementId = (edge.data as { elementId?: string } | undefined)?.elementId;
      onOpenArtifact(String(edge.target), elementId ?? null);
    },
    [onOpenArtifact]
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-mythos-border-default bg-mythos-bg-primary/50 overflow-hidden",
        className
      )}
      data-testid="artifact-graph"
    >
      <div className="h-[520px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={{ artifactNode: ArtifactNode }}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
        >
          <Background gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

