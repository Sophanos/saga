/**
 * Activity log types
 *
 * These types define the activity/audit log entries used for tracking
 * changes and events in projects. Placed in @mythos/core to avoid
 * circular dependencies between @mythos/db and @mythos/state.
 */

/**
 * Activity log entry types
 */
export type ActivityType =
  | "project_created"
  | "document_created"
  | "document_updated"
  | "entity_created"
  | "entity_updated"
  | "entity_deleted"
  | "relationship_created"
  | "relationship_deleted"
  | "member_joined"
  | "member_left"
  | "member_role_changed"
  | "comment_added"
  | "analysis_run";

/**
 * Activity log entry for project history
 * Note: id is string to accommodate both DB numeric IDs (via .toString())
 * and locally-generated IDs for realtime activity (e.g., "1234567890-entity-insert")
 */
export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  projectId: string;
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}
