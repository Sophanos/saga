/**
 * useCollaboration hook
 * Manages real-time collaboration for a project via Convex Presence.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useConvex, useConvexConnectionState, useMutation, useQuery } from "convex/react";
import usePresence from "@convex-dev/presence/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  useCollaborationStore,
  generateCollaboratorColor,
  type ProjectMember,
  type CollaboratorPresence,
  type ActivityLogEntry,
} from "@mythos/state";
import { useAuthStore } from "../stores/auth";
import { useMythosStore } from "../stores";

const PRESENCE_INTERVAL_MS = 10_000;

interface MemberWithProfile {
  id: string;
  userId: string;
  projectId: string;
  role: "owner" | "editor" | "viewer";
  invitedAt?: number;
  acceptedAt?: number;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface PresenceEntry {
  userId: string;
  online: boolean;
  lastDisconnected: number;
  data?: unknown;
  name?: string;
  image?: string;
}

interface ActivityRecord {
  _id: string;
  projectId: string;
  documentId?: string;
  actorType?: string;
  actorUserId?: string;
  actorAgentId?: string;
  actorName?: string;
  action: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
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

function mapMemberToProjectMember(member: MemberWithProfile): ProjectMember {
  const joinedAt = member.acceptedAt ?? member.invitedAt ?? Date.now();
  return {
    id: member.id,
    userId: member.userId,
    projectId: member.projectId,
    role: member.role,
    email: member.email || "",
    name: member.name || undefined,
    avatarUrl: member.avatarUrl || undefined,
    joinedAt: new Date(joinedAt).toISOString(),
    invitedBy: undefined,
  };
}

function mapPresenceToCollaboratorPresence(
  entry: PresenceEntry,
  fallbackColor: string
): CollaboratorPresence {
  const data = (entry.data as Record<string, unknown> | undefined) ?? {};
  const name = (data["name"] as string | undefined) ?? entry.name ?? "Unknown";
  const avatarUrl =
    (data["avatarUrl"] as string | undefined) ??
    (data["image"] as string | undefined) ??
    entry.image ??
    undefined;
  const color = (data["color"] as string | undefined) ?? fallbackColor;
  const cursor = data["cursor"] as { from: number; to: number } | undefined;
  const documentId = data["documentId"] as string | undefined;
  const status = data["status"] as string | undefined;
  const isAi = data["isAi"] as boolean | undefined;
  const lastSeen = entry.online
    ? new Date().toISOString()
    : new Date(entry.lastDisconnected).toISOString();

  return {
    id: entry.userId,
    name,
    avatarUrl,
    color,
    cursor,
    documentId,
    status,
    isAi,
    lastSeen,
  };
}

function mapActivityToEntry(activity: ActivityRecord): ActivityLogEntry {
  return {
    id: activity._id,
    type: activity.action as ActivityLogEntry["type"],
    projectId: activity.projectId,
    documentId: activity.documentId,
    actorType: activity.actorType as ActivityLogEntry["actorType"],
    actorUserId: activity.actorUserId,
    actorAgentId: activity.actorAgentId,
    actorName: activity.actorName,
    userId: activity.actorUserId,
    userName: activity.actorName,
    summary: activity.summary,
    details: activity.metadata,
    createdAt: new Date(activity.createdAt).toISOString(),
  };
}

/**
 * Hook to manage real-time collaboration for a project
 */
export function useCollaboration(projectId: string): UseCollaborationResult {
  // Store actions
  const setMembers = useCollaborationStore((s) => s.setMembers);
  const updatePresence = useCollaborationStore((s) => s.updatePresence);
  const setActivity = useCollaborationStore((s) => s.setActivity);
  const setMyRole = useCollaborationStore((s) => s.setMyRole);
  const setConnected = useCollaborationStore((s) => s.setConnected);
  const setConnectionError = useCollaborationStore((s) => s.setConnectionError);
  const isConnected = useCollaborationStore((s) => s.isConnected);

  // Current user
  const currentUser = useAuthStore((s) => s.user);
  const currentDocument = useMythosStore((s) => s.document.currentDocument);

  const convex = useConvex();
  const connectionState = useConvexConnectionState();

  const colorRef = useRef<string>(generateCollaboratorColor());

  // Connection status as state so UI re-renders when status changes
  const [connectionStatus, setConnectionStatus] = useState<CollaborationConnectionStatus>("disconnected");

  const members = useQuery(api.collaboration.listProjectMembersWithProfiles, { projectId: projectId as Id<"projects"> });
  const activity = useQuery(api.activity.listByProject, { projectId: projectId as Id<"projects">, limit: 50 });
  const presenceState = usePresence(api.presence, `project:${projectId}`, currentUser?.id ?? "", PRESENCE_INTERVAL_MS);
  const updatePresenceMutation = useMutation(api.presence.update);

  const refreshMembers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const nextMembers = await convex.query(api.collaboration.listProjectMembersWithProfiles, { projectId: projectId as Id<"projects"> });
      const mappedMembers = nextMembers.map(mapMemberToProjectMember);
      setMembers(mappedMembers);

      const myMembership = nextMembers.find((m: { userId: string }) => m.userId === currentUser.id);
      setMyRole(myMembership?.role ?? null);
    } catch (error) {
      console.error("[Collaboration] Failed to fetch members:", error);
    }
  }, [convex, projectId, currentUser, setMembers, setMyRole]);

  const refreshActivity = useCallback(async () => {
    try {
      const entries = await convex.query(api.activity.listByProject, { projectId: projectId as Id<"projects">, limit: 50 });
      setActivity(entries.map(mapActivityToEntry));
    } catch (error) {
      console.error("[Collaboration] Failed to fetch activity:", error);
    }
  }, [convex, projectId, setActivity]);

  // Sync members from query
  useEffect(() => {
    if (!members || !currentUser) return;
    const mappedMembers = members.map(mapMemberToProjectMember);
    setMembers(mappedMembers);

    const myMembership = members.find((m: { userId: string }) => m.userId === currentUser.id);
    setMyRole(myMembership?.role ?? null);
  }, [members, currentUser, setMembers, setMyRole]);

  // Sync activity from query
  useEffect(() => {
    if (!activity) return;
    setActivity(activity.map(mapActivityToEntry));
  }, [activity, setActivity]);

  // Update presence data for current user
  useEffect(() => {
    if (!currentUser) return;
    const roomId = `project:${projectId}`;
    const payload = {
      name: currentUser.name ?? currentUser.email ?? "Unknown",
      avatarUrl: currentUser.avatarUrl,
      color: colorRef.current,
      documentId: currentDocument?.id,
      status: "online" as const,
      isAi: false,
    };

    updatePresenceMutation({ roomId, data: payload }).catch((error) => {
      console.error("[Collaboration] Failed to update presence:", error);
    });
  }, [projectId, currentUser, currentDocument?.id, updatePresenceMutation]);

  // Sync presence into store
  useEffect(() => {
    if (!presenceState) return;
    const mappedPresence = presenceState
      .filter((entry) => entry.online)
      .map((entry) => mapPresenceToCollaboratorPresence(entry as PresenceEntry, colorRef.current));
    updatePresence(mappedPresence);
  }, [presenceState, updatePresence]);

  // Connection status based on Convex connection state
  useEffect(() => {
    if (!currentUser) {
      setConnectionStatus("disconnected");
      setConnected(false);
      return;
    }

    const stateStr = String(connectionState);
    if (stateStr === "Connected") {
      setConnectionStatus("connected");
      setConnected(true);
      setConnectionError(null);
    } else if (stateStr === "Connecting" || stateStr === "Reconnecting") {
      setConnectionStatus("connecting");
    } else if (stateStr === "Disconnected") {
      setConnectionStatus("disconnected");
      setConnected(false);
    } else {
      setConnectionStatus("error");
      setConnectionError("Failed to connect to collaboration channel");
    }
  }, [connectionState, currentUser, setConnected, setConnectionError]);

  return {
    connectionStatus,
    isConnected,
    refreshMembers,
    refreshActivity,
  };
}

export default useCollaboration;
