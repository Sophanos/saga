/**
 * Authentication helpers for Convex functions
 *
 * Provides utilities for validating user identity and project access.
 * Uses Convex Auth JWT tokens passed through Convex auth.
 */

import {
  getAuthUserId as convexGetAuthUserId,
} from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type AuthContext = QueryCtx | MutationCtx;
export type ProjectRole = "owner" | "editor" | "viewer";

export type Visibility =
  | { scope: "project" }
  | { scope: "role"; minRole: ProjectRole }
  | { scope: "users"; userIds: string[] }
  | { scope: "private"; userId: string };

/**
 * Get the authenticated user's ID from Convex Auth JWT
 * @throws Error if not authenticated
 * @returns User ID as string (for backward compatibility with ownerId fields)
 */
export async function getAuthUserId(ctx: AuthContext): Promise<string> {
  const userId = await convexGetAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  // Convert Id<"users"> to string for compatibility with existing ownerId fields
  return userId as string;
}

/**
 * Get the authenticated user's document ID
 * @throws Error if not authenticated
 * @returns User document ID
 */
export async function getAuthUserDocId(ctx: AuthContext): Promise<Id<"users">> {
  const userId = await convexGetAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthenticated");
  }
  return userId;
}

/**
 * Get user identity if authenticated, null otherwise
 * Use this for optional auth scenarios
 */
export async function getOptionalAuthUserId(ctx: AuthContext): Promise<string | null> {
  const userId = await convexGetAuthUserId(ctx);
  return userId ? (userId as string) : null;
}

/**
 * Get user by ID from the users table
 * @returns User document or null if not found
 */
export async function getUserById(ctx: AuthContext, userId: string): Promise<{
  _id: Id<"users">;
  name?: string;
  email?: string;
  image?: string;
} | null> {
  try {
    const user = await ctx.db.get(userId as Id<"users">);
    return user;
  } catch {
    return null;
  }
}

/**
 * Verify user has access to a project via membership or org/team role
 * @throws Error if project not found or user isn't a member
 * @returns The user ID and role
 */
export async function verifyProjectAccess(
  ctx: AuthContext,
  projectId: Id<"projects">
): Promise<{ userId: string; role: ProjectRole }> {
  const userId = await getAuthUserId(ctx);
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const member = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_user", (q) =>
      q.eq("projectId", projectId).eq("userId", userId)
    )
    .unique();

  if (member) {
    return { userId, role: member.role };
  }

  if (project.teamId) {
    const teamId = project.teamId;
    const teamMember = await ctx.db
      .query("teamMembers")
      .withIndex("by_team_user", (q) =>
        q.eq("teamId", teamId).eq("userId", userId)
      )
      .unique();

    if (teamMember) {
      return {
        userId,
        role: teamMember.role === "lead" ? "editor" : "viewer",
      };
    }
  }

  if (project.orgId) {
    const orgId = project.orgId;
    const orgMember = await ctx.db
      .query("organizationMembers")
      .withIndex("by_org_user", (q) =>
        q.eq("orgId", orgId).eq("userId", userId)
      )
      .unique();

    if (orgMember) {
      let role: ProjectRole = "viewer";
      if (orgMember.role === "owner") {
        role = "owner";
      } else if (orgMember.role === "admin") {
        role = "editor";
      }

      return { userId, role };
    }
  }

  throw new Error("Access denied");
}

/**
 * Verify user owns the project
 * @throws Error if project not found or user doesn't own it
 * @returns The user ID
 */
export async function verifyProjectOwner(
  ctx: AuthContext,
  projectId: Id<"projects">
): Promise<string> {
  const { userId, role } = await verifyProjectAccess(ctx, projectId);

  if (role !== "owner") {
    throw new Error("Owner access required");
  }

  return userId;
}

/**
 * Verify user can edit the project (owner or editor)
 * @throws Error if project not found or user doesn't have edit access
 * @returns The user ID
 */
export async function verifyProjectEditor(
  ctx: AuthContext,
  projectId: Id<"projects">
): Promise<string> {
  const { userId, role } = await verifyProjectAccess(ctx, projectId);

  if (role === "viewer") {
    throw new Error("Edit access denied");
  }

  return userId;
}

/**
 * Verify user has access to a document via its project
 * @throws Error if document/project not found or user doesn't have access
 * @returns The user ID and project ID
 */
export async function verifyDocumentAccess(
  ctx: AuthContext,
  documentId: Id<"documents">
): Promise<{ userId: string; projectId: Id<"projects"> }> {
  const document = await ctx.db.get(documentId);

  if (!document) {
    throw new Error("Document not found");
  }

  const { userId } = await verifyProjectAccess(ctx, document.projectId);

  return { userId, projectId: document.projectId };
}

/**
 * Verify user has access to an entity via its project
 * @throws Error if entity/project not found or user doesn't have access
 * @returns The user ID and project ID
 */
export async function verifyEntityAccess(
  ctx: AuthContext,
  entityId: Id<"entities">
): Promise<{ userId: string; projectId: Id<"projects"> }> {
  const entity = await ctx.db.get(entityId);

  if (!entity) {
    throw new Error("Entity not found");
  }

  const { userId } = await verifyProjectAccess(ctx, entity.projectId);

  return { userId, projectId: entity.projectId };
}

/**
 * Verify user has access to a relationship via its project
 * @throws Error if relationship/project not found or user doesn't have access
 * @returns The user ID and project ID
 */
export async function verifyRelationshipAccess(
  ctx: AuthContext,
  relationshipId: Id<"relationships">
): Promise<{ userId: string; projectId: Id<"projects"> }> {
  const relationship = await ctx.db.get(relationshipId);

  if (!relationship) {
    throw new Error("Relationship not found");
  }

  const { userId } = await verifyProjectAccess(ctx, relationship.projectId);

  return { userId, projectId: relationship.projectId };
}

function resolveRoleRank(role: ProjectRole): number {
  switch (role) {
    case "owner":
      return 3;
    case "editor":
      return 2;
    default:
      return 1;
  }
}

export function isVisibleToUser(args: {
  visibility?: Visibility;
  userId: string;
  role: ProjectRole;
}): boolean {
  const { visibility, userId, role } = args;
  if (!visibility) return true;

  switch (visibility.scope) {
    case "project":
      return true;
    case "role":
      return resolveRoleRank(role) >= resolveRoleRank(visibility.minRole);
    case "users":
      return visibility.userIds.includes(userId);
    case "private":
      return visibility.userId === userId;
    default:
      return false;
  }
}
