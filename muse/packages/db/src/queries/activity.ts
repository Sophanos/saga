import { getSupabaseClient } from "../client";
import {
  executeQuery,
  executeSingleQuery,
  executeBulkMutation,
  executeRpc,
  DbQueryError,
} from "../queryHelper";

// Activity log types
export interface ActivityLog {
  id: number;
  project_id: string;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ActivityLogInsert {
  project_id: string;
  actor_user_id?: string | null;
  action: string;
  entity_table: string;
  entity_id?: string | null;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

// Activity with actor profile info
export interface ActivityWithActor extends ActivityLog {
  actor_name?: string;
  actor_avatar_url?: string;
}

// Common action types
export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "invite"
  | "join"
  | "leave"
  | "share"
  | "comment"
  | "export"
  | "import";

/**
 * Get activity log for a project
 */
export async function getProjectActivity(
  projectId: string,
  options: {
    limit?: number;
    offset?: number;
    entityTable?: string;
    entityId?: string;
    actorId?: string;
    action?: ActivityAction;
    since?: string;
  } = {}
): Promise<ActivityLog[]> {
  const { limit = 50, offset = 0, entityTable, entityId, actorId, action, since } = options;

  return executeQuery<ActivityLog>(
    (client) => {
      let query = client
        .from("activity_log")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (entityTable) {
        query = query.eq("entity_table", entityTable);
      }

      if (entityId) {
        query = query.eq("entity_id", entityId);
      }

      if (actorId) {
        query = query.eq("actor_user_id", actorId);
      }

      if (action) {
        query = query.eq("action", action);
      }

      if (since) {
        query = query.gt("created_at", since);
      }

      return query;
    },
    { context: "fetch activity log" }
  );
}

/**
 * Get activity log with actor information
 */
export async function getProjectActivityWithActors(
  projectId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<ActivityWithActor[]> {
  const { limit = 50, offset = 0 } = options;

  type ActivityWithProfile = ActivityLog & { profiles?: { name: string; avatar_url: string } };

  const data = await executeQuery<ActivityWithProfile>(
    (client) =>
      client
        .from("activity_log")
        .select(`
          *,
          profiles:actor_user_id (
            name,
            avatar_url
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
    { context: "fetch activity log with actors" }
  );

  // Map the joined data to our interface
  return data.map((activity) => ({
    ...activity,
    actor_name: activity.profiles?.name,
    actor_avatar_url: activity.profiles?.avatar_url,
  }));
}

/**
 * Get activity for a specific entity
 */
export async function getEntityActivity(
  entityTable: string,
  entityId: string,
  limit: number = 20
): Promise<ActivityLog[]> {
  return executeQuery<ActivityLog>(
    (client) =>
      client
        .from("activity_log")
        .select("*")
        .eq("entity_table", entityTable)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(limit),
    { context: "fetch entity activity" }
  );
}

/**
 * Get activity by a specific user across all their projects
 */
export async function getUserActivity(
  userId: string,
  limit: number = 50
): Promise<ActivityLog[]> {
  return executeQuery<ActivityLog>(
    (client) =>
      client
        .from("activity_log")
        .select("*")
        .eq("actor_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit),
    { context: "fetch user activity" }
  );
}

/**
 * Log an activity using the RPC function
 */
export async function logActivity(
  activity: ActivityLogInsert
): Promise<ActivityLog> {
  return executeRpc<ActivityLog>(
    (client) =>
      client.rpc("log_activity", {
        p_project_id: activity.project_id,
        p_action: activity.action,
        p_entity_table: activity.entity_table,
        p_entity_id: activity.entity_id ?? null,
        p_before_data: activity.before_data ?? null,
        p_after_data: activity.after_data ?? null,
        p_metadata: activity.metadata ?? {},
      } as never),
    { context: "log activity" }
  );
}

/**
 * Get activity count for a project (for pagination)
 */
export async function getActivityCount(
  projectId: string,
  options: {
    entityTable?: string;
    entityId?: string;
    since?: string;
  } = {}
): Promise<number> {
  // Note: Count queries with head: true have a different result shape,
  // so we use the manual pattern here
  const supabase = getSupabaseClient();
  const { entityTable, entityId, since } = options;

  let query = supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (entityTable) {
    query = query.eq("entity_table", entityTable);
  }

  if (entityId) {
    query = query.eq("entity_id", entityId);
  }

  if (since) {
    query = query.gt("created_at", since);
  }

  const { count, error } = await query;

  if (error) {
    throw new DbQueryError("count activity", error);
  }

  return count || 0;
}

/**
 * Get recent activity summary (grouped by action type)
 */
export async function getActivitySummary(
  projectId: string,
  since: string
): Promise<{ action: string; count: number }[]> {
  const data = await executeQuery<{ action: string }>(
    (client) =>
      client
        .from("activity_log")
        .select("action")
        .eq("project_id", projectId)
        .gt("created_at", since),
    { context: "fetch activity summary" }
  );

  // Group and count by action
  const counts = new Map<string, number>();
  for (const row of data) {
    const current = counts.get(row.action) || 0;
    counts.set(row.action, current + 1);
  }

  return Array.from(counts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get the last activity for a project
 */
export async function getLastActivity(
  projectId: string
): Promise<ActivityLog | null> {
  return executeSingleQuery<ActivityLog>(
    (client) =>
      client
        .from("activity_log")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    { context: "fetch last activity" }
  );
}

/**
 * Delete old activity logs (for cleanup)
 */
export async function deleteOldActivity(
  projectId: string,
  olderThan: string
): Promise<number> {
  const deleted = await executeBulkMutation<ActivityLog>(
    (client) =>
      client
        .from("activity_log")
        .delete()
        .eq("project_id", projectId)
        .lt("created_at", olderThan)
        .select(),
    { context: "delete old activity" }
  );

  return deleted.length;
}
