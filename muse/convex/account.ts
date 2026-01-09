/**
 * Account Management
 *
 * User account operations including complete account deletion.
 * Account deletion cascades through all user data:
 * - Projects owned by user (full cascade delete)
 * - Project memberships
 * - Subscriptions and events
 * - AI usage records
 * - Saga threads
 * - Presence records
 */

import { v } from "convex/values";
import { mutation, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./lib/auth";

/**
 * Delete the current user's account and all associated data.
 * This is a destructive operation that cannot be undone.
 */
export const deleteMyAccount = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; deletedProjects: number }> => {
    // Get user identity directly in action context
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const userId = identity.subject;

    // Run the deletion cascade in a mutation
    // @ts-ignore Convex internal API types are too deep for this callsite.
    const result = await ctx.runMutation((internal as any).account.deleteUserDataInternal, {
      userId,
    });

    return result;
  },
});

/**
 * Internal mutation that performs the actual account deletion cascade.
 * Called by the action after authentication.
 */
export const deleteUserDataInternal = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }): Promise<{ success: boolean; deletedProjects: number }> => {
    let deletedProjects = 0;

    // 1. Find all projects owned by this user
    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    // 2. Delete each owned project (full cascade)
    for (const project of ownedProjects) {
      await ctx.runMutation(internal.projects.removeInternal, { id: project._id });
      deletedProjects++;
    }

    // 3. Remove user from projects where they are a member (not owner)
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const membership of memberships) {
      await ctx.db.delete(membership._id);
    }

    // 4. Delete subscriptions
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const sub of subscriptions) {
      await ctx.db.delete(sub._id);
    }

    // 5. Delete subscription events
    const subEvents = await ctx.db
      .query("subscriptionEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const event of subEvents) {
      await ctx.db.delete(event._id);
    }

    // 6. Delete AI usage records (user-scoped, not project-scoped)
    const aiUsage = await ctx.db
      .query("aiUsage")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const usage of aiUsage) {
      await ctx.db.delete(usage._id);
    }

    // 7. Delete presence records
    const presence = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const p of presence) {
      await ctx.db.delete(p._id);
    }

    // 8. Delete saga threads (user-scoped)
    // Note: project-scoped threads are deleted with project cascade
    // This catches any orphaned threads
    const threads = await ctx.db.query("sagaThreads").collect();
    const userThreads = threads.filter((t) => t.createdBy === userId);

    for (const thread of userThreads) {
      await ctx.db.delete(thread._id);
    }

    // 9. Delete generation streams (by user)
    const streams = await ctx.db
      .query("generationStreams")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    for (const stream of streams) {
      await ctx.db.delete(stream._id);
    }

    return { success: true, deletedProjects };
  },
});

/**
 * Get account deletion preview - shows what will be deleted.
 * Useful for confirmation UI.
 */
export const getDeletePreview = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    // Count owned projects
    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    // Count memberships (non-owner)
    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const nonOwnerMemberships = memberships.filter((m) => !m.isOwner);

    // Count documents across owned projects
    let documentCount = 0;
    let entityCount = 0;

    for (const project of ownedProjects) {
      const docs = await ctx.db
        .query("documents")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      documentCount += docs.length;

      const entities = await ctx.db
        .query("entities")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      entityCount += entities.length;
    }

    return {
      ownedProjectCount: ownedProjects.length,
      sharedProjectMemberships: nonOwnerMemberships.length,
      documentCount,
      entityCount,
    };
  },
});
