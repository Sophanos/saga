import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import {
  getGraphEntityLabel,
  getRelationCategory,
  getRelationLabel,
  getRegistryEntityHexColor,
  type GraphEntityType,
  type ProjectGraphRegistryDisplay,
} from '@mythos/core';
import { useProjectStore } from '@mythos/state';
import { api } from '../../../../convex/_generated/api';
import type { EntityNodeType } from '../components/project-graph/nodes/EntityNode';
import type { RelationshipEdgeType } from '../components/project-graph/edges/RelationshipEdge';

interface UseProjectGraphOptions {
  visibleTypes?: Set<GraphEntityType>;
  registry?: ProjectGraphRegistryDisplay | null;
}

interface UseProjectGraphResult {
  nodes: EntityNodeType[];
  edges: RelationshipEdgeType[];
  entityCount: number;
  relationshipCount: number;
  visibleEntityCount: number;
  visibleRelationshipCount: number;
}

interface GraphDataResult {
  entities: Array<{ _id: string; name: string; type: string }>;
  relationships: Array<{
    _id: string;
    sourceId: string;
    targetId: string;
    type: string;
    bidirectional?: boolean;
  }>;
}

export function useProjectGraph(options?: UseProjectGraphOptions): UseProjectGraphResult {
  const { visibleTypes, registry = null } = options ?? {};
  const projectId = useProjectStore((state) => state.currentProjectId);

  // Convex API types are too deep for expo typecheck; treat as untyped.
  // @ts-ignore
  const apiAny: any = api;
  const graphData = useQuery(
    apiAny.entities.listWithRelationships as any,
    projectId ? { projectId } : ('skip' as any)
  ) as GraphDataResult | undefined;

  const entities = graphData?.entities ?? [];
  const relationships = graphData?.relationships ?? [];

  const entityCount = useMemo(() => entities.length, [entities]);
  const relationshipCount = useMemo(() => relationships.length, [relationships]);

  const visibleTypesKey = useMemo(
    () => (visibleTypes ? Array.from(visibleTypes).sort().join(',') : ''),
    [visibleTypes]
  );

  const { nodes, edges } = useMemo(() => {
    const filteredEntities = visibleTypes
      ? entities.filter((entity) => visibleTypes.has(entity.type))
      : entities;

    const visibleEntityIds = new Set(filteredEntities.map((entity) => entity._id));

    const nodes: EntityNodeType[] = filteredEntities.map((entity, index) => {
      const def = registry?.entityTypes[entity.type];
      const color = getRegistryEntityHexColor(registry, entity.type);
      return {
        id: entity._id,
        type: 'entityNode',
        position: {
          x: (index % 5) * 200,
          y: Math.floor(index / 5) * 150,
        },
        data: {
          entityId: entity._id,
          name: entity.name,
          type: entity.type,
          iconName: def?.icon,
          displayName: getGraphEntityLabel(registry, entity.type),
          color,
        },
      };
    });

    const edges: RelationshipEdgeType[] = relationships
      .filter((relationship) =>
        visibleEntityIds.has(relationship.sourceId) && visibleEntityIds.has(relationship.targetId)
      )
      .map((relationship) => {
        const def = registry?.relationshipTypes[relationship.type];
        return {
          id: relationship._id,
          source: relationship.sourceId,
          target: relationship.targetId,
          type: 'relationshipEdge',
          data: {
            relationshipId: relationship._id,
            relationType: relationship.type,
            label: def?.displayName ?? getRelationLabel(relationship.type),
            category: getRelationCategory(relationship.type),
            bidirectional: relationship.bidirectional,
          },
          animated: relationship.type === 'loves' || relationship.type === 'hates',
        };
      });

    return { nodes, edges };
  }, [entities, relationships, visibleTypes, visibleTypesKey, registry]);

  const visibleEntityCount = useMemo(() => nodes.length, [nodes]);
  const visibleRelationshipCount = useMemo(() => edges.length, [edges]);

  return useMemo(
    () => ({
      nodes,
      edges,
      entityCount,
      relationshipCount,
      visibleEntityCount,
      visibleRelationshipCount,
    }),
    [nodes, edges, entityCount, relationshipCount, visibleEntityCount, visibleRelationshipCount]
  );
}
