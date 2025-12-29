/**
 * Activity mappers: DB <-> Core type conversions
 */

import type { ActivityLogEntry, ActivityType } from "@mythos/state";
import type { ActivityWithActor } from "../queries/activity";

/**
 * Map DB action + entity table to ActivityType
 *
 * This handles both simple actions (join, leave) and compound
 * action:table combinations (create:documents, update:entities).
 */
export function mapDbActionToActivityType(
  action: string,
  entityTable: string
): ActivityType {
  const actionMap: Record<string, ActivityType> = {
    // Compound action:table mappings
    "create:documents": "document_created",
    "update:documents": "document_updated",
    "create:entities": "entity_created",
    "update:entities": "entity_updated",
    "delete:entities": "entity_deleted",
    "create:relationships": "relationship_created",
    "delete:relationships": "relationship_deleted",
    "create:project_members": "member_joined",
    "delete:project_members": "member_left",
    "update:project_members": "member_role_changed",
    "create:projects": "project_created",
    // Simple action mappings (legacy)
    create: "entity_created",
    update: "entity_updated",
    delete: "entity_deleted",
    join: "member_joined",
    leave: "member_left",
    comment: "comment_added",
  };

  const key = `${action}:${entityTable}`;
  return actionMap[key] || actionMap[action] || "document_updated";
}

/**
 * Map ActivityType to DB action string
 *
 * This is the inverse of mapDbActionToActivityType for
 * cases where we need to convert state types back to DB actions.
 */
export function mapActivityTypeToAction(type: ActivityType): string {
  const typeMap: Record<ActivityType, string> = {
    project_created: "create",
    document_created: "create",
    document_updated: "update",
    entity_created: "create",
    entity_updated: "update",
    entity_deleted: "delete",
    relationship_created: "create",
    relationship_deleted: "delete",
    member_joined: "join",
    member_left: "leave",
    member_role_changed: "update",
    comment_added: "comment",
    analysis_run: "analyze",
  };

  return typeMap[type] || "update";
}

/**
 * Extract entity name from activity before/after data
 */
function getEntityNameFromActivity(
  activity: ActivityWithActor
): string | undefined {
  const afterData = activity.after_data as Record<string, unknown> | undefined;
  const beforeData = activity.before_data as Record<string, unknown> | undefined;

  return (
    (afterData?.["name"] as string) ||
    (afterData?.["title"] as string) ||
    (beforeData?.["name"] as string) ||
    (beforeData?.["title"] as string) ||
    (activity.metadata?.["name"] as string) ||
    undefined
  );
}

/**
 * Map DB activity row (with actor info) to ActivityLogEntry
 *
 * Converts the database activity_log row shape to the
 * ActivityLogEntry interface used in the collaboration state.
 */
export function mapDbActivityToActivityLogEntry(
  activity: ActivityWithActor
): ActivityLogEntry {
  const type = mapDbActionToActivityType(activity.action, activity.entity_table);

  return {
    id: activity.id.toString(),
    type,
    projectId: activity.project_id,
    userId: activity.actor_user_id || "",
    userName: activity.actor_name,
    userAvatarUrl: activity.actor_avatar_url,
    targetId: activity.entity_id || undefined,
    targetType: activity.entity_table,
    targetName: getEntityNameFromActivity(activity),
    details: activity.metadata,
    createdAt: activity.created_at,
  };
}

// Re-export DB types for convenience
export type { ActivityWithActor } from "../queries/activity";
