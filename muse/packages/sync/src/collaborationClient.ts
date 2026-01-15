/**
 * CollaborationClient
 * Handles real-time collaboration features using Supabase Realtime
 */

import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { useCollaborationStore, generateCollaboratorColor } from "@mythos/state";
import type { CollaboratorPresence, ActivityLogEntry, ProjectMember } from "@mythos/state";
import type { DocumentChannel } from "./types";

type RealtimeSubscribeState = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

/**
 * Presence payload for Supabase Realtime
 */
interface PresencePayload {
  id: string;
  name: string;
  avatarUrl?: string;
  color: string;
  documentId?: string;
  cursor?: { from: number; to: number };
}

/**
 * CollaborationClient manages real-time presence and collaboration
 */
export class CollaborationClient {
  private supabase: SupabaseClient;
  private projectChannels: Map<string, RealtimeChannel> = new Map();
  private documentChannels: Map<string, RealtimeChannel> = new Map();
  private userId: string | null = null;
  private userName: string = "Anonymous";
  private userAvatarUrl?: string;
  private userColor: string;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.userColor = generateCollaboratorColor();
  }

  /**
   * Set the current user info for presence
   */
  setUser(userId: string, name: string, avatarUrl?: string): void {
    this.userId = userId;
    this.userName = name;
    this.userAvatarUrl = avatarUrl;
  }

  /**
   * Connect to a project for collaboration
   */
  async connectProject(projectId: string): Promise<void> {
    if (this.projectChannels.has(projectId)) {
      return;
    }

    const store = useCollaborationStore.getState();

    // Fetch project members
    const { data: members, error: membersError } = await this.supabase
      .from("project_members")
      .select(`
        id,
        user_id,
        project_id,
        role,
        joined_at,
        invited_by,
        users:user_id (
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq("project_id", projectId);

    if (!membersError && members) {
      const mappedMembers: ProjectMember[] = members.map((m: Record<string, unknown>) => {
        const user = m["users"] as Record<string, unknown> | null;
        const meta = user?.["raw_user_meta_data"] as Record<string, unknown> | null;
        return {
          id: m["id"] as string,
          userId: m["user_id"] as string,
          projectId: m["project_id"] as string,
          role: m["role"] as ProjectMember["role"],
          email: (user?.["email"] as string) || "",
          name: (meta?.["name"] as string) || (meta?.["full_name"] as string) || undefined,
          avatarUrl: (meta?.["avatar_url"] as string) || undefined,
          joinedAt: m["joined_at"] as string,
          invitedBy: (m["invited_by"] as string) || undefined,
        };
      });
      store.setMembers(mappedMembers);

      // Set current user's role
      const myMembership = mappedMembers.find((m) => m.userId === this.userId);
      if (myMembership) {
        store.setMyRole(myMembership.role);
      }
    }

    // Fetch recent activity
    const { data: activity, error: activityError } = await this.supabase
      .from("activity_log")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!activityError && activity) {
      const mappedActivity: ActivityLogEntry[] = activity.map((a: Record<string, unknown>) => ({
        id: a["id"] as string,
        type: a["type"] as ActivityLogEntry["type"],
        projectId: a["project_id"] as string,
        userId: a["user_id"] as string,
        userName: a["user_name"] as string | undefined,
        userAvatarUrl: a["user_avatar_url"] as string | undefined,
        targetId: a["target_id"] as string | undefined,
        targetType: a["target_type"] as string | undefined,
        targetName: a["target_name"] as string | undefined,
        details: a["details"] as Record<string, unknown> | undefined,
        createdAt: a["created_at"] as string,
      }));
      store.setActivity(mappedActivity);
    }

    // Create presence channel
    const channel = this.supabase.channel(`project-presence:${projectId}`, {
      config: {
        presence: {
          key: this.userId || "anonymous",
        },
      },
    });

    // Track presence
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresencePayload>();
        const presenceList: CollaboratorPresence[] = [];

        for (const [userId, presences] of Object.entries(state)) {
          if (userId === this.userId) continue;

          const presence = presences[0];
          if (presence) {
            presenceList.push({
              id: userId,
              name: presence.name,
              avatarUrl: presence.avatarUrl,
              color: presence.color,
              documentId: presence.documentId,
              cursor: presence.cursor,
              lastSeen: new Date().toISOString(),
            });
          }
        }

        store.updatePresence(presenceList);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }: { key: string; newPresences: PresencePayload[] }) => {
        const presence = newPresences[0];
        if (presence && key !== this.userId) {
          store.upsertPresence({
            id: key,
            name: presence.name,
            avatarUrl: presence.avatarUrl,
            color: presence.color,
            documentId: presence.documentId,
            cursor: presence.cursor,
            lastSeen: new Date().toISOString(),
          });
        }
      })
      .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        if (key !== this.userId) {
          store.removePresence(key);
        }
      })
      .subscribe(async (status: RealtimeSubscribeState) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            id: this.userId,
            name: this.userName,
            avatarUrl: this.userAvatarUrl,
            color: this.userColor,
          } as PresencePayload);

          store.setConnected(true);
        }
      });

    // Subscribe to activity log changes
    this.supabase
      .channel(`activity:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_log",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const a = payload.new as Record<string, unknown>;
          store.addActivity({
            id: a["id"] as string,
            type: a["type"] as ActivityLogEntry["type"],
            projectId: a["project_id"] as string,
            userId: a["user_id"] as string,
            userName: a["user_name"] as string | undefined,
            userAvatarUrl: a["user_avatar_url"] as string | undefined,
            targetId: a["target_id"] as string | undefined,
            targetType: a["target_type"] as string | undefined,
            targetName: a["target_name"] as string | undefined,
            details: a["details"] as Record<string, unknown> | undefined,
            createdAt: a["created_at"] as string,
          });
        }
      )
      .subscribe();

    this.projectChannels.set(projectId, channel);
  }

  /**
   * Disconnect from a project
   */
  async disconnectProject(projectId: string): Promise<void> {
    const channel = this.projectChannels.get(projectId);
    if (channel) {
      await this.supabase.removeChannel(channel);
      this.projectChannels.delete(projectId);
    }

    // Disconnect all document channels for this project
    for (const [key, docChannel] of this.documentChannels.entries()) {
      if (key.startsWith(`${projectId}:`)) {
        await this.supabase.removeChannel(docChannel);
        this.documentChannels.delete(key);
      }
    }

    const store = useCollaborationStore.getState();
    store.setConnected(false);
    store.reset();
  }

  /**
   * Connect to a document for real-time collaboration
   */
  async connectDocument(projectId: string, documentId: string): Promise<DocumentChannel> {
    const channelKey = `${projectId}:${documentId}`;

    // Update presence with current document
    const projectChannel = this.projectChannels.get(projectId);
    if (projectChannel) {
      await projectChannel.track({
        id: this.userId,
        name: this.userName,
        avatarUrl: this.userAvatarUrl,
        color: this.userColor,
        documentId,
      } as PresencePayload);
    }

    // Create document-specific channel for cursor/operation sync
    const docChannel = this.supabase.channel(`document:${channelKey}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    const cursorCallbacks: Array<(userId: string, position: { from: number; to: number }) => void> = [];
    const operationCallbacks: Array<(userId: string, operation: unknown) => void> = [];

    docChannel
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const { userId, position } = payload as { userId: string; position: { from: number; to: number } };
        cursorCallbacks.forEach((cb) => cb(userId, position));

        // Update presence store
        const store = useCollaborationStore.getState();
        const existing = store.presence.find((p) => p.id === userId);
        if (existing) {
          store.upsertPresence({
            ...existing,
            cursor: position,
            lastSeen: new Date().toISOString(),
          });
        }
      })
      .on("broadcast", { event: "operation" }, ({ payload }) => {
        const { userId, operation } = payload as { userId: string; operation: unknown };
        operationCallbacks.forEach((cb) => cb(userId, operation));
      })
      .subscribe();

    this.documentChannels.set(channelKey, docChannel);

    return {
      sendCursor: (position: { from: number; to: number }) => {
        docChannel.send({
          type: "broadcast",
          event: "cursor",
          payload: { userId: this.userId, position },
        });
      },

      sendOperation: (operation: unknown) => {
        docChannel.send({
          type: "broadcast",
          event: "operation",
          payload: { userId: this.userId, operation },
        });
      },

      onCursor: (callback: (userId: string, position: { from: number; to: number }) => void) => {
        cursorCallbacks.push(callback);
        return () => {
          const index = cursorCallbacks.indexOf(callback);
          if (index > -1) cursorCallbacks.splice(index, 1);
        };
      },

      onOperation: (callback: (userId: string, operation: unknown) => void) => {
        operationCallbacks.push(callback);
        return () => {
          const index = operationCallbacks.indexOf(callback);
          if (index > -1) operationCallbacks.splice(index, 1);
        };
      },

      disconnect: () => {
        this.supabase.removeChannel(docChannel);
        this.documentChannels.delete(channelKey);

        // Update presence to remove document
        if (projectChannel) {
          projectChannel.track({
            id: this.userId,
            name: this.userName,
            avatarUrl: this.userAvatarUrl,
            color: this.userColor,
            documentId: undefined,
          } as PresencePayload);
        }
      },
    };
  }

  /**
   * Log an activity
   */
  async logActivity(
    projectId: string,
    type: ActivityLogEntry["type"],
    targetId?: string,
    targetType?: string,
    targetName?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.supabase.from("activity_log").insert({
      project_id: projectId,
      user_id: this.userId,
      user_name: this.userName,
      user_avatar_url: this.userAvatarUrl,
      type,
      target_id: targetId,
      target_type: targetType,
      target_name: targetName,
      details,
    });
  }

  /**
   * Invite a member to the project
   */
  async inviteMember(
    projectId: string,
    email: string,
    role: "editor" | "viewer"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user exists
      const { data: existingUser } = await this.supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

      if (!existingUser) {
        // Send invitation email (handled by edge function or external service)
        const { error } = await this.supabase.functions.invoke("invite-member", {
          body: { projectId, email, role },
        });

        if (error) throw error;
        return { success: true };
      }

      // Add as project member
      const { error } = await this.supabase.from("project_members").insert({
        project_id: projectId,
        user_id: existingUser.id,
        role,
        invited_by: this.userId,
      });

      if (error) throw error;

      // Log activity
      await this.logActivity(projectId, "member_joined", existingUser.id, "user", email);

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to invite member";
      return { success: false, error: message };
    }
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(
    projectId: string,
    memberId: string,
    role: "editor" | "viewer"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from("project_members")
        .update({ role })
        .eq("id", memberId)
        .eq("project_id", projectId);

      if (error) throw error;

      // Update local store
      useCollaborationStore.getState().updateMemberRole(memberId, role);

      // Log activity
      await this.logActivity(projectId, "member_role_changed", memberId, "member", undefined, { role });

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update role";
      return { success: false, error: message };
    }
  }

  /**
   * Remove a member from the project
   */
  async removeMember(projectId: string, memberId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from("project_members")
        .delete()
        .eq("id", memberId)
        .eq("project_id", projectId);

      if (error) throw error;

      // Update local store
      useCollaborationStore.getState().removeMember(memberId);

      // Log activity
      await this.logActivity(projectId, "member_left", memberId, "member");

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove member";
      return { success: false, error: message };
    }
  }
}

export default CollaborationClient;
