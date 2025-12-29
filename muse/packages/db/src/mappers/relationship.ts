/**
 * Relationship mappers: DB <-> Core type conversions
 */

import type { Database } from "../types/database";
import type { Relationship, RelationType, PropertyValue } from "@mythos/core";

// DB types
export type DbRelationship = Database["public"]["Tables"]["relationships"]["Row"];
export type DbRelationshipInsert = Database["public"]["Tables"]["relationships"]["Insert"];
export type DbRelationshipUpdate = Database["public"]["Tables"]["relationships"]["Update"];

export function mapDbRelationshipToRelationship(dbRelationship: DbRelationship): Relationship {
  return {
    id: dbRelationship.id,
    sourceId: dbRelationship.source_id,
    targetId: dbRelationship.target_id,
    type: dbRelationship.type as RelationType,
    bidirectional: dbRelationship.bidirectional,
    strength: dbRelationship.strength ?? undefined,
    metadata: dbRelationship.metadata as Record<string, PropertyValue> | undefined,
    createdAt: new Date(dbRelationship.created_at),
  };
}

/**
 * Maps a core Relationship to DB insert format.
 */
export function mapCoreRelationshipToDbInsert(
  relationship: Relationship,
  projectId: string
): DbRelationshipInsert {
  return {
    id: relationship.id,
    project_id: projectId,
    source_id: relationship.sourceId,
    target_id: relationship.targetId,
    type: relationship.type,
    bidirectional: relationship.bidirectional,
    strength: relationship.strength ?? null,
    metadata: relationship.metadata ?? null,
  };
}

/**
 * Maps a complete relationship to DB update format.
 * Use this when you have the full merged relationship state.
 */
export function mapCoreRelationshipToDbFullUpdate(
  relationship: Relationship
): DbRelationshipUpdate {
  return {
    source_id: relationship.sourceId,
    target_id: relationship.targetId,
    type: relationship.type,
    bidirectional: relationship.bidirectional,
    strength: relationship.strength ?? null,
    metadata: relationship.metadata ?? null,
  };
}
