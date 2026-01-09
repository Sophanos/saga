/**
 * Authentication helpers for Convex functions
 *
 * Provides utilities for validating user identity and project access.
 * Uses Better Auth JWT tokens passed through Convex auth.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type AuthContext = QueryCtx | MutationCtx;

/**
 * Get the authenticated user's ID from Better Auth JWT
 * @throws Error if not authenticated
 */
export async function getAuthUserId(ctx: AuthContext): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  return identity.subject;
}

/**
 * Get user identity if authenticated, null otherwise
 * Use this for optional auth scenarios
 */
export async function getOptionalAuthUserId(ctx: AuthContext): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

/**
 * Verify user has access to a project via membership
 * @throws Error if project not found or user isn't a member
 * @returns The user ID and role
 */
export async function verifyProjectAccess(
  ctx: AuthContext,
  projectId: Id<"projects">
): Promise<{ userId: string; role: "owner" | "editor" | "viewer" }> {
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

  if (!member) {
    throw new Error("Access denied");
  }

  return { userId, role: member.role };
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
