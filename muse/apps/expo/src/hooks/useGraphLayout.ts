import { useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';

export type LayoutAlgorithm = 'layered' | 'force' | 'stress' | 'mrtree';
export type LayoutDirection = 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';

interface UseGraphLayoutOptions {
  algorithm?: LayoutAlgorithm;
  direction?: LayoutDirection;
  nodeSize?: { width: number; height: number };
  nodeSpacing?: number;
  layerSpacing?: number;
}

interface UseGraphLayoutResult {
  layout: (nodes: Node[], edges: Edge[]) => Promise<Node[]>;
  isLayouting: boolean;
}

const ELK_ALGORITHM_MAP: Record<LayoutAlgorithm, string> = {
  layered: 'layered',
  force: 'force',
  stress: 'stress',
  mrtree: 'mrtree',
};

export function useGraphLayout(options?: UseGraphLayoutOptions): UseGraphLayoutResult {
  const {
    algorithm = 'layered',
    direction = 'DOWN',
    nodeSize = { width: 160, height: 60 },
    nodeSpacing = 50,
    layerSpacing = 80,
  } = options ?? {};

  const elkRef = useRef<InstanceType<typeof ELK> | null>(null);
  const isLayoutingRef = useRef(false);

  const getElk = useCallback((): InstanceType<typeof ELK> => {
    if (!elkRef.current) {
      elkRef.current = new ELK();
    }
    return elkRef.current;
  }, []);

  const layout = useCallback(
    async (nodes: Node[], edges: Edge[]): Promise<Node[]> => {
      if (nodes.length === 0) return nodes;

      isLayoutingRef.current = true;
      const elk = getElk();

      try {
        const elkGraph: ElkNode = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': ELK_ALGORITHM_MAP[algorithm],
            'elk.direction': direction,
            'elk.spacing.nodeNode': String(nodeSpacing),
            'elk.layered.spacing.nodeNodeBetweenLayers': String(layerSpacing),
            'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
            'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
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

        const layoutedGraph = await elk.layout(elkGraph);

        return nodes.map((node) => {
          const layoutedNode = layoutedGraph.children?.find((child: ElkNode) => child.id === node.id);
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
      } finally {
        isLayoutingRef.current = false;
      }
    },
    [algorithm, direction, getElk, layerSpacing, nodeSize, nodeSpacing]
  );

  return {
    layout,
    isLayouting: isLayoutingRef.current,
  };
}
