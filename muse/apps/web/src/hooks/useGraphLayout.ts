import { useCallback, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import ELK, { type ElkNode, type ElkExtendedEdge } from "elkjs/lib/elk.bundled.js";

const ELK_WORKER_URL = new URL("elkjs/lib/elk.worker.min.js", import.meta.url);

export type LayoutAlgorithm = "layered" | "force" | "stress" | "mrtree";
export type LayoutDirection = "RIGHT" | "DOWN" | "LEFT" | "UP";

interface UseGraphLayoutOptions {
  /** Layout algorithm to use */
  algorithm?: LayoutAlgorithm;
  /** Direction of the layout */
  direction?: LayoutDirection;
  /** Node dimensions */
  nodeSize?: { width: number; height: number };
  /** Spacing between nodes */
  nodeSpacing?: number;
  /** Spacing between layers (for layered algorithm) */
  layerSpacing?: number;
}

interface UseGraphLayoutResult {
  /**
   * Apply ELK layout to nodes and return positioned nodes
   */
  layout: (nodes: Node[], edges: Edge[]) => Promise<Node[]>;
  /**
   * Whether layout is currently being computed
   */
  isLayouting: boolean;
}

const ELK_ALGORITHM_MAP: Record<LayoutAlgorithm, string> = {
  layered: "layered",
  force: "force",
  stress: "stress",
  mrtree: "mrtree",
};

/**
 * Hook for applying ELK layout to React Flow graphs
 */
export function useGraphLayout(options?: UseGraphLayoutOptions): UseGraphLayoutResult {
  const {
    algorithm = "layered",
    direction = "DOWN",
    nodeSize = { width: 160, height: 60 },
    nodeSpacing = 50,
    layerSpacing = 80,
  } = options ?? {};

  const elkRef = useRef<InstanceType<typeof ELK> | null>(null);
  const isLayoutingRef = useRef(false);

  // Lazy initialize ELK
  const getElk = useCallback(() => {
    if (!elkRef.current) {
      elkRef.current = new ELK({ workerUrl: ELK_WORKER_URL.toString() });
    }
    return elkRef.current;
  }, []);

  const layout = useCallback(
    async (nodes: Node[], edges: Edge[]): Promise<Node[]> => {
      if (nodes.length === 0) return nodes;

      isLayoutingRef.current = true;
      const elk = getElk();

      try {
        // Build ELK graph
        const elkGraph: ElkNode = {
          id: "root",
          layoutOptions: {
            "elk.algorithm": ELK_ALGORITHM_MAP[algorithm],
            "elk.direction": direction,
            "elk.spacing.nodeNode": String(nodeSpacing),
            "elk.layered.spacing.nodeNodeBetweenLayers": String(layerSpacing),
            // Additional options for better layouts
            "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
            "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
            "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
          },
          children: nodes.map((node) => ({
            id: node.id,
            width: nodeSize.width,
            height: nodeSize.height,
          })),
          edges: edges.map((edge) => ({
            id: edge.id,
            sources: [edge.source],
            targets: [edge.target],
          })) as ElkExtendedEdge[],
        };

        // Run layout
        const layoutedGraph = await elk.layout(elkGraph);

        // Apply positions to nodes
        const layoutedNodes = nodes.map((node) => {
          const layoutedNode = layoutedGraph.children?.find(
            (child: ElkNode) => child.id === node.id
          );

          if (layoutedNode?.x !== undefined && layoutedNode?.y !== undefined) {
            return {
              ...node,
              position: {
                x: layoutedNode.x,
                y: layoutedNode.y,
              },
            };
          }

          return node;
        });

        return layoutedNodes;
      } finally {
        isLayoutingRef.current = false;
      }
    },
    [getElk, algorithm, direction, nodeSize, nodeSpacing, layerSpacing]
  );

  return {
    layout,
    isLayouting: isLayoutingRef.current,
  };
}
