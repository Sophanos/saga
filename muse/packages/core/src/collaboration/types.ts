/**
 * Collaboration Types
 *
 * Types for multi-user collaboration features including:
 * - Project members and roles
 * - Project invitations
 * - Activity logging
 */

/**
 * Role a user can have on a project
 */
export type ProjectRole = "owner" | "editor" | "viewer";

/**
 * A member of a project with their role
 */
export interface ProjectMember {
  /** Unique member record ID */
  id: string;
  /** Project this membership belongs to */
  projectId: string;
  /** User who is a member */
  userId: string;
  /** Role the user has on the project */
  role: ProjectRole;
  /** When the user was invited */
  invitedAt: string;
  /** When the user accepted the invitation (undefined if pending) */
  acceptedAt?: string;
  /** Optional user profile information */
  user?: {
    name?: string;
    avatarUrl?: string;
    email?: string;
  };
}

/**
 * An invitation to join a project
 */
export interface ProjectInvitation {
  /** Unique invitation ID */
  id: string;
  /** Project the invitation is for */
  projectId: string;
  /** Email address the invitation was sent to */
  email: string;
  /** Role the invitee will have upon accepting */
  role: ProjectRole;
  /** Unique token for accepting the invitation */
  token: string;
  /** When the invitation expires */
  expiresAt: string;
  /** When the invitation was created */
  invitedAt: string;
  /** When the invitation was accepted (undefined if pending) */
  acceptedAt?: string;
}

/**
 * Type of action performed in an activity log entry
 */
export type ActivityAction = "insert" | "update" | "delete";

/**
 * Raw database activity log entry
 * Note: For UI-friendly activity types, use ActivityLogEntry from @mythos/core/activity
 */
export interface DbActivityLogEntry {
  /** Unique log entry ID */
  id: number;
  /** Project this activity belongs to */
  projectId: string;
  /** User who performed the action (undefined for system actions) */
  actorUserId?: string;
  /** Type of action performed */
  action: ActivityAction;
  /** Database table the entity belongs to */
  entityTable: string;
  /** ID of the affected entity */
  entityId: string;
  /** State of the entity before the action (for updates/deletes) */
  beforeData?: Record<string, unknown>;
  /** State of the entity after the action (for inserts/updates) */
  afterData?: Record<string, unknown>;
  /** When the action occurred */
  createdAt: string;
  /** Optional actor profile information */
  actor?: {
    name?: string;
    avatarUrl?: string;
  };
}

/**
 * Permissions available for each role
 */
export const ROLE_PERMISSIONS = {
  owner: {
    canEdit: true,
    canDelete: true,
    canInvite: true,
    canManageMembers: true,
    canTransferOwnership: true,
  },
  editor: {
    canEdit: true,
    canDelete: false,
    canInvite: true,
    canManageMembers: false,
    canTransferOwnership: false,
  },
  viewer: {
    canEdit: false,
    canDelete: false,
    canInvite: false,
    canManageMembers: false,
    canTransferOwnership: false,
  },
} as const;

/**
 * Helper to check if a role has a specific permission
 */
export function hasPermission(
  role: ProjectRole,
  permission: keyof (typeof ROLE_PERMISSIONS)["owner"]
): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Human-readable labels for roles
 */
export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

/**
 * Helper type for creating new project members
 */
export type CreateProjectMember = Omit<ProjectMember, "id" | "invitedAt" | "acceptedAt" | "user">;

/**
 * Helper type for creating new invitations
 */
export type CreateProjectInvitation = Omit<
  ProjectInvitation,
  "id" | "token" | "invitedAt" | "acceptedAt"
>;
