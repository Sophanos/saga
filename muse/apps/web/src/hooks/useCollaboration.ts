/**
 * useCollaboration hook
 * Manages real-time collaboration for a project
 *
 * - Connects to Supabase Realtime channels for presence and changes
 * - Fetches and updates project members and activity
 * - Tracks presence and cleans up on unmount/project change
 */

import { useEffect, useRef, useCallback } from "react";
import {
  getSupabaseClient,
  getProjectMembersWithProfiles,
  getProjectActivityWithActors,
} from "@mythos/db";
import {
  useCollaborationStore,
  generateCollaboratorColor,
  type ProjectMember,
  type CollaboratorPresence,
  type ActivityLogEntry,
  type ActivityType,
} from "@mythos/state";
import { useAuthStore } from "../stores/auth";

// Channel type from Supabase (avoid direct import from @supabase/supabase-js)
type RealtimeChannel = ReturnType<ReturnType<typeof getSupabaseClient>["channel"]>;

// Postgres changes payload type (simplified local definition)
interface PostgresChangesPayload<T = Record<string, unknown>> {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: T | null;
  old: T | null;
}

// DB member type for type safety
interface DBMemberWithProfile {
  id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  invited_at: string;
  accepted_at: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * Connection status for the collaboration hook
 */
export type CollaborationConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

/**
 * Return type for the useCollaboration hook
 */
export interface UseCollaborationResult {
  /**
   * Current connection status
   */
  connectionStatus: CollaborationConnectionStatus;
  /**
   * Whether connected to realtime channels
   */
  isConnected: boolean;
  /**
   * Refresh members list
   */
  refreshMembers: () => Promise<void>;
  /**
   * Refresh activity log
   */
  refreshActivity: () => Promise<void>;
}

/**
 * Map DB activity to collaboration store activity entry
 */
function mapActivityToEntry(activity: {
  id: number;
  project_id: string;
  actor_user_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
  actor_avatar_url?: string;
}): ActivityLogEntry {
  // Map action to activity type
  const actionMap: Record<string, ActivityType> = {
    create: "entity_created",
    update: "entity_updated",
    delete: "entity_deleted",
    join: "member_joined",
    leave: "member_left",
    comment: "comment_added",
  };

  const type = actionMap[activity.action] || "document_updated";

  return {
    id: activity.id.toString(),
    type,
    projectId: activity.project_id,
    userId: activity.actor_user_id || "",
    userName: activity.actor_name,
    userAvatarUrl: activity.actor_avatar_url,
    targetId: activity.entity_id || undefined,
    targetType: activity.entity_table,
    targetName: (activity.metadata?.["name"] as string) || undefined,
    details: activity.metadata,
    createdAt: activity.created_at,
  };
}

/**
 * Map DB member to collaboration store member
 */
function mapMemberToProjectMember(member: {
  id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  invited_at: string;
  accepted_at: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}, projectId: string): ProjectMember {
  return {
    id: member.id,
    userId: member.user_id,
    projectId,
    role: member.role,
    email: member.email || "",
    name: member.name || undefined,
    avatarUrl: member.avatar_url || undefined,
    joinedAt: member.accepted_at || member.invited_at,
    invitedBy: undefined,
  };
}

/**
 * Hook to manage real-time collaboration for a project
 *
 * @param projectId - The project ID to collaborate on, or null if no project
 * @returns Collaboration controls and status
 *
 * @example
 * ```tsx
 * function ProjectView({ projectId }: { projectId: string }) {
 *   const { isConnected, refreshMembers } = useCollaboration(projectId);
 *
 *   return (
 *     <div>
 *       <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
 *       <button onClick={refreshMembers}>Refresh Members</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCollaboration(projectId: string | null): UseCollaborationResult {
  // Store actions
  const setMembers = useCollaborationStore((s) => s.setMembers);
  const addMember = useCollaborationStore((s) => s.addMember);
  const removeMember = useCollaborationStore((s) => s.removeMember);
  const updatePresence = useCollaborationStore((s) => s.updatePresence);
  const upsertPresence = useCollaborationStore((s) => s.upsertPresence);
  const removePresence = useCollaborationStore((s) => s.removePresence);
  const setActivity = useCollaborationStore((s) => s.setActivity);
  const addActivity = useCollaborationStore((s) => s.addActivity);
  const setMyRole = useCollaborationStore((s) => s.setMyRole);
  const setConnected = useCollaborationStore((s) => s.setConnected);
  const setConnectionError = useCollaborationStore((s) => s.setConnectionError);
  const reset = useCollaborationStore((s) => s.reset);
  const isConnected = useCollaborationStore((s) => s.isConnected);

  // Current user
  const currentUser = useAuthStore((s) => s.user);

  // Channel references
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const changesChannelRef = useRef<RealtimeChannel | null>(null);
  const connectionStatusRef = useRef<CollaborationConnectionStatus>("disconnected");

  /**
   * Fetch project members
   */
  const refreshMembers = useCallback(async () => {
    if (!projectId) return;

    try {
      const members = await getProjectMembersWithProfiles(projectId);
      const mappedMembers = members.map((m: DBMemberWithProfile) => mapMemberToProjectMember(m, projectId));
      setMembers(mappedMembers);

      // Set current user's role
      if (currentUser) {
        const myMembership = members.find((m: DBMemberWithProfile) => m.user_id === currentUser.id);
        setMyRole(myMembership?.role || null);
      }
    } catch (error) {
      console.error("[Collaboration] Failed to fetch members:", error);
    }
  }, [projectId, currentUser, setMembers, setMyRole]);

  /**
   * Fetch project activity
   */
  const refreshActivity = useCallback(async () => {
    if (!projectId) return;

    try {
      const activity = await getProjectActivityWithActors(projectId, { limit: 50 });
      const mappedActivity = activity.map(mapActivityToEntry);
      setActivity(mappedActivity);
    } catch (error) {
      console.error("[Collaboration] Failed to fetch activity:", error);
    }
  }, [projectId, setActivity]);

  /**
   * Set up realtime subscriptions
   */
  useEffect(() => {
    if (!projectId || !currentUser) {
      reset();
      return;
    }

    const supabase = getSupabaseClient();
    connectionStatusRef.current = "connecting";

    // Create presence channel
    const presenceChannel = supabase.channel(`project:${projectId}:presence`, {
      config: {
        presence: {
          key: currentUser.id,
        },
      },
    });

    // Create changes channel for Postgres changes
    const changesChannel = supabase.channel(`project:${projectId}:changes`);

    // Handle presence sync
    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState();
      const presenceList: CollaboratorPresence[] = [];

      for (const [userId, presences] of Object.entries(state)) {
        const presence = (presences as Array<{
          name?: string;
          avatarUrl?: string;
          color?: string;
          cursor?: { from: number; to: number };
          documentId?: string;
          lastSeen?: string;
        }>)[0];
        if (presence) {
          presenceList.push({
            id: userId,
            name: presence.name || "Unknown",
            avatarUrl: presence.avatarUrl,
            color: presence.color || generateCollaboratorColor(),
            cursor: presence.cursor,
            documentId: presence.documentId,
            lastSeen: presence.lastSeen || new Date().toISOString(),
          });
        }
      }

      updatePresence(presenceList);
    });

    // Handle presence join
    presenceChannel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      const presence = (newPresences as Array<{
        name?: string;
        avatarUrl?: string;
        color?: string;
        cursor?: { from: number; to: number };
        documentId?: string;
      }>)[0];
      if (presence) {
        upsertPresence({
          id: key,
          name: presence.name || "Unknown",
          avatarUrl: presence.avatarUrl,
          color: presence.color || generateCollaboratorColor(),
          cursor: presence.cursor,
          documentId: presence.documentId,
          lastSeen: new Date().toISOString(),
        });
      }
    });

    // Handle presence leave
    presenceChannel.on("presence", { event: "leave" }, ({ key }) => {
      removePresence(key);
    });

    // Subscribe to entity changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changesChannel as any).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "entities",
        filter: `project_id=eq.${projectId}`,
      },
      (payload: PostgresChangesPayload<{ id: string; name?: string }>) => {
        // Add to activity log
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
        const activityType: ActivityType =
          eventType === "INSERT" ? "entity_created" :
          eventType === "UPDATE" ? "entity_updated" : "entity_deleted";

        const entityData = payload.new || payload.old;
        if (entityData) {
          addActivity({
            id: `${Date.now()}-entity-${eventType.toLowerCase()}`,
            type: activityType,
            projectId,
            userId: currentUser.id,
            targetId: entityData.id,
            targetType: "entity",
            targetName: entityData.name,
            createdAt: new Date().toISOString(),
          });
        }
      }
    );

    // Subscribe to document changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changesChannel as any).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "documents",
        filter: `project_id=eq.${projectId}`,
      },
      (payload: PostgresChangesPayload<{ id: string; title?: string }>) => {
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
        const activityType: ActivityType =
          eventType === "INSERT" ? "document_created" : "document_updated";

        const docData = payload.new || payload.old;
        if (docData) {
          addActivity({
            id: `${Date.now()}-document-${eventType.toLowerCase()}`,
            type: activityType,
            projectId,
            userId: currentUser.id,
            targetId: docData.id,
            targetType: "document",
            targetName: docData.title,
            createdAt: new Date().toISOString(),
          });
        }
      }
    );

    // Subscribe to relationship changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changesChannel as any).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "relationships",
        filter: `project_id=eq.${projectId}`,
      },
      (payload: PostgresChangesPayload<{ id: string }>) => {
        const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
        const activityType: ActivityType =
          eventType === "INSERT" ? "relationship_created" : "relationship_deleted";

        const relData = payload.new || payload.old;
        if (relData) {
          addActivity({
            id: `${Date.now()}-relationship-${eventType.toLowerCase()}`,
            type: activityType,
            projectId,
            userId: currentUser.id,
            targetId: relData.id,
            targetType: "relationship",
            createdAt: new Date().toISOString(),
          });
        }
      }
    );

    // Subscribe to member changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changesChannel as any).on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "project_members",
        filter: `project_id=eq.${projectId}`,
      },
      (payload: PostgresChangesPayload<{
        id: string;
        user_id: string;
        role: "owner" | "editor" | "viewer";
        invited_at: string;
        accepted_at: string | null;
      }>) => {
        const eventType = payload.eventType;

        if (eventType === "INSERT" && payload.new) {
          // New member added - refresh to get profile info
          refreshMembers();
        } else if (eventType === "DELETE" && payload.old) {
          removeMember(payload.old.id);
        } else if (eventType === "UPDATE" && payload.new) {
          // Role changed - refresh to update
          refreshMembers();
        }
      }
    );

    // Subscribe to presence channel
    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track our presence
        await presenceChannel.track({
          name: currentUser.name || currentUser.email,
          avatarUrl: currentUser.avatarUrl,
          color: generateCollaboratorColor(),
          lastSeen: new Date().toISOString(),
        });
      }
    });

    // Subscribe to changes channel
    changesChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        connectionStatusRef.current = "connected";
        setConnected(true);
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        connectionStatusRef.current = "error";
        setConnectionError("Failed to connect to collaboration channel");
      }
    });

    // Store channel references
    presenceChannelRef.current = presenceChannel;
    changesChannelRef.current = changesChannel;

    // Initial data fetch
    refreshMembers();
    refreshActivity();

    // Cleanup on unmount or project change
    return () => {
      connectionStatusRef.current = "disconnected";

      if (presenceChannelRef.current) {
        presenceChannelRef.current.unsubscribe();
        presenceChannelRef.current = null;
      }

      if (changesChannelRef.current) {
        changesChannelRef.current.unsubscribe();
        changesChannelRef.current = null;
      }

      reset();
    };
  }, [
    projectId,
    currentUser,
    setConnected,
    setConnectionError,
    updatePresence,
    upsertPresence,
    removePresence,
    addActivity,
    addMember,
    removeMember,
    refreshMembers,
    refreshActivity,
    reset,
  ]);

  return {
    connectionStatus: connectionStatusRef.current,
    isConnected,
    refreshMembers,
    refreshActivity,
  };
}

export default useCollaboration;
