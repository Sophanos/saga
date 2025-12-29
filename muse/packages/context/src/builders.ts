/**
 * @mythos/context - Context Builders
 *
 * Functions to build context hints from application state.
 */

import type { ProfilePreferences, EditorContext } from "@mythos/agent-protocol";
import type { Entity, Relationship } from "@mythos/core";
import type {
  ProfileContext,
  WorldContextSummary,
  UnifiedContextHints,
  EntitySummary,
  RelationshipSummary,
} from "./types";

/**
 * Build profile context from user preferences.
 */
export function buildProfileContext(
  preferences?: ProfilePreferences
): ProfileContext | undefined {
  if (!preferences?.writing) {
    return undefined;
  }

  const { writing } = preferences;

  // Only return if there's at least one preference
  if (
    !writing.preferredGenre &&
    !writing.namingCulture &&
    !writing.namingStyle &&
    !writing.logicStrictness
  ) {
    return undefined;
  }

  return {
    preferredGenre: writing.preferredGenre,
    namingCulture: writing.namingCulture,
    namingStyle: writing.namingStyle,
    logicStrictness: writing.logicStrictness,
  };
}

/**
 * Build entity summary from an entity.
 */
function buildEntitySummary(entity: Entity): EntitySummary {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    summary: entity.notes?.slice(0, 200),
  };
}

/**
 * Build relationship summary from a relationship.
 */
function buildRelationshipSummary(
  relationship: Relationship
): RelationshipSummary {
  return {
    sourceId: relationship.sourceId,
    targetId: relationship.targetId,
    type: relationship.type,
  };
}

/**
 * Build world context summary from entities and relationships.
 */
export function buildWorldContext(
  entities?: Entity[],
  relationships?: Relationship[]
): WorldContextSummary | undefined {
  if ((!entities || entities.length === 0) && (!relationships || relationships.length === 0)) {
    return undefined;
  }

  return {
    entities: (entities ?? []).slice(0, 50).map(buildEntitySummary),
    relationships: (relationships ?? []).slice(0, 100).map(buildRelationshipSummary),
  };
}

/**
 * Build unified context hints from application state.
 */
export function buildContextHints(input: {
  profilePreferences?: ProfilePreferences;
  entities?: Entity[];
  relationships?: Relationship[];
  editorContext?: EditorContext;
  conversationId?: string;
}): UnifiedContextHints {
  const result: UnifiedContextHints = {};

  // Build profile context
  const profile = buildProfileContext(input.profilePreferences);
  if (profile) {
    result.profile = profile;
  }

  // Build world context
  const world = buildWorldContext(input.entities, input.relationships);
  if (world) {
    result.world = world;
  }

  // Add editor context
  if (input.editorContext) {
    result.editor = input.editorContext;
  }

  // Add conversation ID
  if (input.conversationId) {
    result.conversationId = input.conversationId;
  }

  return result;
}
