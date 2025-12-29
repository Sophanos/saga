import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMythosStore } from "../stores";
import type { EntityType } from "@mythos/core";
import {
  getRelationLabel,
  getRelationCategory,
} from "@mythos/core";
import type { EntityNodeType } from "../components/world-graph/nodes/EntityNode";
import type { RelationshipEdgeType } from "../components/world-graph/edges/RelationshipEdge";

interface UseWorldGraphOptions {
  /** Filter to only show certain entity types */
  visibleTypes?: Set<EntityType>;
}

interface UseWorldGraphResult {
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
export function useWorldGraph(options?: UseWorldGraphOptions): UseWorldGraphResult {
  const { visibleTypes } = options ?? {};

  // Get entities and relationships from store
  const entities = useMythosStore(
    useShallow((s) => Array.from(s.world.entities.values()))
  );
  const relationships = useMythosStore(
    useShallow((s) => s.world.relationships)
  );
  const selectedEntityId = useMythosStore((s) => s.world.selectedEntityId);

  // Transform to React Flow format
  const { nodes, edges } = useMemo(() => {
    // Filter entities by visible types
    const filteredEntities = visibleTypes
      ? entities.filter((e) => visibleTypes.has(e.type))
      : entities;

    // Create a set of visible entity IDs for edge filtering
    const visibleEntityIds = new Set(filteredEntities.map((e) => e.id));

    // Create nodes
    const nodes: EntityNodeType[] = filteredEntities.map((entity, index) => ({
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
        selected: entity.id === selectedEntityId,
      },
    }));

    // Create edges (only for visible entities)
    const edges: RelationshipEdgeType[] = relationships
      .filter(
        (rel) =>
          visibleEntityIds.has(rel.sourceId) && visibleEntityIds.has(rel.targetId)
      )
      .map((rel) => ({
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        type: "relationshipEdge",
        data: {
          relationshipId: rel.id,
          relationType: rel.type,
          label: getRelationLabel(rel.type),
          category: getRelationCategory(rel.type),
          bidirectional: rel.bidirectional,
        },
        animated: rel.type === "loves" || rel.type === "hates",
      }));

    return { nodes, edges };
  }, [entities, relationships, selectedEntityId, visibleTypes]);

  return {
    nodes,
    edges,
    entityCount: entities.length,
    relationshipCount: relationships.length,
    visibleEntityCount: nodes.length,
    visibleRelationshipCount: edges.length,
  };
}
