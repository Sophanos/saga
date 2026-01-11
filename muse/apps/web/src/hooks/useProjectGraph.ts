import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMythosStore } from "../stores";
import type { GraphEntityType, ProjectGraphRegistryDisplay } from "@mythos/core";
import {
  getGraphEntityLabel,
  getRelationLabel,
  getRelationCategory,
  getRegistryEntityHexColor,
} from "@mythos/core";
import type { EntityNodeType } from "../components/project-graph/nodes/EntityNode";
import type { RelationshipEdgeType } from "../components/project-graph/edges/RelationshipEdge";

interface UseProjectGraphOptions {
  /** Filter to only show certain entity types - use a stable Set reference or useMemo to prevent re-renders */
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

/**
 * Hook to transform store entities and relationships into React Flow nodes and edges
 */
export function useProjectGraph(options?: UseProjectGraphOptions): UseProjectGraphResult {
  const { visibleTypes, registry = null } = options ?? {};

  // Get entities and relationships from store
  const entities = useMythosStore(
    useShallow((s) => Array.from(s.world.entities.values()))
  );
  const relationships = useMythosStore(
    useShallow((s) => s.world.relationships)
  );

  // Memoize total counts (from raw store data)
  const entityCount = useMemo(() => entities.length, [entities]);
  const relationshipCount = useMemo(() => relationships.length, [relationships]);

  // Serialize visibleTypes for stable dependency comparison
  // This prevents re-renders when a new Set with the same contents is passed
  const visibleTypesKey = useMemo(
    () => (visibleTypes ? Array.from(visibleTypes).sort().join(",") : ""),
    [visibleTypes]
  );

  // Transform to React Flow format
  const { nodes, edges } = useMemo(() => {
    // Filter entities by visible types
    const filteredEntities = visibleTypes
      ? entities.filter((e) => visibleTypes.has(e.type))
      : entities;

    // Create a set of visible entity IDs for edge filtering
    const visibleEntityIds = new Set(filteredEntities.map((e) => e.id));

    // Create nodes
    const nodes: EntityNodeType[] = filteredEntities.map((entity, index) => {
      const def = registry?.entityTypes[entity.type];
      const color = getRegistryEntityHexColor(registry, entity.type);
      return {
        id: entity.id,
        type: "entityNode",
        // Initial position - will be updated by layout
        position: {
          x: (index % 5) * 200,
          y: Math.floor(index / 5) * 150,
        },
        data: {
          entityId: entity.id,
          name: entity.name,
          type: entity.type,
          iconName: def?.icon,
          displayName: getGraphEntityLabel(registry, entity.type),
          color,
        },
      };
    });

    // Create edges (only for visible entities)
    const edges: RelationshipEdgeType[] = relationships
      .filter(
        (rel) =>
          visibleEntityIds.has(rel.sourceId) && visibleEntityIds.has(rel.targetId)
      )
      .map((rel) => {
        const def = registry?.relationshipTypes[rel.type];
        return {
          id: rel.id,
          source: rel.sourceId,
          target: rel.targetId,
          type: "relationshipEdge",
          data: {
            relationshipId: rel.id,
            relationType: rel.type,
            label: def?.displayName ?? getRelationLabel(rel.type),
            category: getRelationCategory(rel.type),
            bidirectional: rel.bidirectional,
          },
          animated: rel.type === "loves" || rel.type === "hates",
        };
      });

    return { nodes, edges };
  }, [entities, relationships, visibleTypes, visibleTypesKey, registry]);

  // Memoize visible counts derived from nodes/edges
  const visibleEntityCount = useMemo(() => nodes.length, [nodes]);
  const visibleRelationshipCount = useMemo(() => edges.length, [edges]);

  // Memoize the return object to prevent downstream re-renders
  // when the hook re-runs but values haven't changed
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
