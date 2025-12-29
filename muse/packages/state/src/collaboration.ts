/**
 * Collaboration state store
 * Platform-agnostic real-time collaboration state
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

/**
 * Project role types for collaboration
 */
export type ProjectRole = "owner" | "editor" | "viewer";

/**
 * Project member representation
 */
export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: ProjectRole;
  email: string;
  name?: string;
  avatarUrl?: string;
  joinedAt: string;
  invitedBy?: string;
}

/**
 * Real-time presence for collaborators
 */
export interface CollaboratorPresence {
  id: string;
  name: string;
  avatarUrl?: string;
  color: string;
  cursor?: { from: number; to: number };
  documentId?: string;
  lastSeen: string;
}

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

/**
 * Collaboration state interface
 */
export interface CollaborationState {
  // Project members
  members: ProjectMember[];

  // Real-time presence
  presence: CollaboratorPresence[];

  // Activity log
  activity: ActivityLogEntry[];

  // Current user's role in the project
  myRole: ProjectRole | null;

  // Read-only mode flag
  isReadOnly: boolean;

  // Connection status
  isConnected: boolean;
  connectionError: string | null;

  // Actions
  setMembers: (members: ProjectMember[]) => void;
  addMember: (member: ProjectMember) => void;
  removeMember: (memberId: string) => void;
  updateMemberRole: (memberId: string, role: ProjectRole) => void;
  updatePresence: (presence: CollaboratorPresence[]) => void;
  upsertPresence: (presence: CollaboratorPresence) => void;
  removePresence: (userId: string) => void;
  addActivity: (entry: ActivityLogEntry) => void;
  setActivity: (entries: ActivityLogEntry[]) => void;
  setMyRole: (role: ProjectRole | null) => void;
  setReadOnly: (isReadOnly: boolean) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  reset: () => void;
}

/**
 * Generate a random collaborator color
 */
export function generateCollaboratorColor(): string {
  const colors = [
    "#F87171", // red
    "#FB923C", // orange
    "#FBBF24", // amber
    "#A3E635", // lime
    "#34D399", // emerald
    "#22D3EE", // cyan
    "#60A5FA", // blue
    "#A78BFA", // violet
    "#F472B6", // pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

const initialState = {
  members: [],
  presence: [],
  activity: [],
  myRole: null,
  isReadOnly: false,
  isConnected: false,
  connectionError: null,
};

/**
 * Collaboration store
 */
export const useCollaborationStore = create<CollaborationState>()(
  immer((set) => ({
    ...initialState,

    setMembers: (members) =>
      set((state) => {
        state.members = members;
      }),

    addMember: (member) =>
      set((state) => {
        const existingIndex = state.members.findIndex((m) => m.id === member.id);
        if (existingIndex === -1) {
          state.members.push(member);
        } else {
          state.members[existingIndex] = member;
        }
      }),

    removeMember: (memberId) =>
      set((state) => {
        state.members = state.members.filter((m) => m.id !== memberId);
      }),

    updateMemberRole: (memberId, role) =>
      set((state) => {
        const member = state.members.find((m) => m.id === memberId);
        if (member) {
          member.role = role;
        }
      }),

    updatePresence: (presence) =>
      set((state) => {
        state.presence = presence;
      }),

    upsertPresence: (presence) =>
      set((state) => {
        const existingIndex = state.presence.findIndex((p) => p.id === presence.id);
        if (existingIndex === -1) {
          state.presence.push(presence);
        } else {
          state.presence[existingIndex] = presence;
        }
      }),

    removePresence: (userId) =>
      set((state) => {
        state.presence = state.presence.filter((p) => p.id !== userId);
      }),

    addActivity: (entry) =>
      set((state) => {
        // Keep activity log limited to last 100 entries
        state.activity = [entry, ...state.activity].slice(0, 100);
      }),

    setActivity: (entries) =>
      set((state) => {
        state.activity = entries;
      }),

    setMyRole: (role) =>
      set((state) => {
        state.myRole = role;
        state.isReadOnly = role === "viewer";
      }),

    setReadOnly: (isReadOnly) =>
      set((state) => {
        state.isReadOnly = isReadOnly;
      }),

    setConnected: (connected) =>
      set((state) => {
        state.isConnected = connected;
        if (connected) {
          state.connectionError = null;
        }
      }),

    setConnectionError: (error) =>
      set((state) => {
        state.connectionError = error;
        if (error) {
          state.isConnected = false;
        }
      }),

    reset: () => set(initialState),
  }))
);

// Selectors
export const useProjectMembers = () => useCollaborationStore((s) => s.members);
export const useCollaboratorPresence = () => useCollaborationStore((s) => s.presence);
export const useActivityLog = () => useCollaborationStore((s) => s.activity);
export const useMyRole = () => useCollaborationStore((s) => s.myRole);
export const useIsReadOnly = () => useCollaborationStore((s) => s.isReadOnly);
export const useIsConnected = () => useCollaborationStore((s) => s.isConnected);

// Computed selectors
export const useActiveCollaborators = () =>
  useCollaborationStore((s) => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    return s.presence.filter((p) => p.lastSeen > fiveMinutesAgo);
  });

export const useCollaboratorsInDocument = (documentId: string) =>
  useCollaborationStore((s) =>
    s.presence.filter((p) => p.documentId === documentId)
  );

export const useMemberById = (memberId: string) =>
  useCollaborationStore((s) => s.members.find((m) => m.id === memberId));

export const useMembersByRole = (role: ProjectRole) =>
  useCollaborationStore((s) => s.members.filter((m) => m.role === role));

export const useRecentActivity = (limit = 10) =>
  useCollaborationStore((s) => s.activity.slice(0, limit));
