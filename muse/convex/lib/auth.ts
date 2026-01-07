/**
 * Authentication helpers for Convex functions
 *
 * Provides utilities for validating user identity and project access.
 * Uses Supabase JWT tokens passed through Convex auth.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type AuthContext = QueryCtx | MutationCtx;

/**
 * Get the authenticated user's ID from Supabase JWT
 * @throws Error if not authenticated
 */
export async function getAuthUserId(ctx: AuthContext): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated");
  }
  // Supabase JWT uses 'subject' for user ID
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
 * Verify user has access to a project (owner check)
 * @throws Error if project not found or user doesn't own it
 * @returns The user ID
 */
export async function verifyProjectAccess(
  ctx: AuthContext,
  projectId: Id<"projects">
): Promise<string> {
  const userId = await getAuthUserId(ctx);
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.ownerId !== userId) {
    throw new Error("Access denied");
  }

  return userId;
}

/**
 * Verify user has access to a document via its project
 * @throws Error if document/project not found or user doesn't own it
 * @returns The user ID and project ID
 */
export async function verifyDocumentAccess(
  ctx: AuthContext,
  documentId: Id<"documents">
): Promise<{ userId: string; projectId: Id<"projects"> }> {
  const userId = await getAuthUserId(ctx);
  const document = await ctx.db.get(documentId);

  if (!document) {
    throw new Error("Document not found");
  }

  const project = await ctx.db.get(document.projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.ownerId !== userId) {
    throw new Error("Access denied");
  }

  return { userId, projectId: document.projectId };
}

/**
 * Verify user has access to an entity via its project
 * @throws Error if entity/project not found or user doesn't own it
 * @returns The user ID and project ID
 */
export async function verifyEntityAccess(
  ctx: AuthContext,
  entityId: Id<"entities">
): Promise<{ userId: string; projectId: Id<"projects"> }> {
  const userId = await getAuthUserId(ctx);
  const entity = await ctx.db.get(entityId);

  if (!entity) {
    throw new Error("Entity not found");
  }

  const project = await ctx.db.get(entity.projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.ownerId !== userId) {
    throw new Error("Access denied");
  }

  return { userId, projectId: entity.projectId };
}

/**
 * Verify user has access to a relationship via its project
 * @throws Error if relationship/project not found or user doesn't own it
 * @returns The user ID and project ID
 */
export async function verifyRelationshipAccess(
  ctx: AuthContext,
  relationshipId: Id<"relationships">
): Promise<{ userId: string; projectId: Id<"projects"> }> {
  const userId = await getAuthUserId(ctx);
  const relationship = await ctx.db.get(relationshipId);

  if (!relationship) {
    throw new Error("Relationship not found");
  }

  const project = await ctx.db.get(relationship.projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  if (project.ownerId !== userId) {
    throw new Error("Access denied");
  }

  return { userId, projectId: relationship.projectId };
}
