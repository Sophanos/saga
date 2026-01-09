/**
 * Collaboration Module
 *
 * Project members and invitations management.
 * Provides RLS-like permission helpers and CRUD operations.
 */

import { v } from "convex/values";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { verifyProjectAccess } from "./lib/auth";

// ============================================================
// INTERNAL PERMISSION HELPERS
// ============================================================

export const isProjectMember = internalQuery({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, { projectId, userId }) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();
    return !!member;
  },
});

export const isProjectEditor = internalQuery({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, { projectId, userId }) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();
    return member?.role === "owner" || member?.role === "editor";
  },
});

export const isProjectOwner = internalQuery({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, { projectId, userId }) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();
    return member?.isOwner === true;
  },
});

export const getMemberRole = internalQuery({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, { projectId, userId }) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();
    return member?.role ?? null;
  },
});

// ============================================================
// QUERIES
// ============================================================

export const listProjectMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const listProjectMembersWithProfiles = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await verifyProjectAccess(ctx, projectId);

    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    const uniqueUserIds = Array.from(new Set(members.map((member) => member.userId)));
    const users = await Promise.all(
      uniqueUserIds.map(async (userId) =>
        ctx.db
          .query("users" as any)
          .filter((q: any) => q.eq(q.field("id"), userId))
          .first()
      )
    );

    const userById = new Map<string, any>();
    for (const user of users) {
      if (user?.id) {
        userById.set(user.id, user);
      }
    }

    return members.map((member) => {
      const user = userById.get(member.userId);
      return {
        id: member._id,
        userId: member.userId,
        projectId: member.projectId,
        role: member.role,
        invitedAt: member.invitedAt,
        acceptedAt: member.acceptedAt,
        name: user?.name ?? user?.email ?? null,
        email: user?.email ?? null,
        avatarUrl: user?.image ?? user?.avatarUrl ?? null,
      };
    });
  },
});

export const getProjectMember = query({
  args: { projectId: v.id("projects"), userId: v.string() },
  handler: async (ctx, { projectId, userId }) => {
    return ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();
  },
});

export const listUserProjects = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const listProjectInvitations = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return ctx.db
      .query("projectInvitations")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", projectId).eq("status", "pending")
      )
      .collect();
  },
});

export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return ctx.db
      .query("projectInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
  },
});

export const listUserInvitations = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const invitations = await ctx.db
      .query("projectInvitations")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .collect();
    return invitations.filter((i) => i.status === "pending");
  },
});

// ============================================================
// MUTATIONS
// ============================================================

export const addProjectMember = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    invitedBy: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, userId, role, invitedBy }) => {
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();

    if (existing) {
      throw new Error("User is already a project member");
    }

    const now = Date.now();
    return ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role,
      isOwner: role === "owner",
      invitedBy,
      invitedAt: invitedBy ? now : undefined,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addProjectMemberInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    invitedBy: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, userId, role, invitedBy }) => {
    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    return ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role,
      isOwner: role === "owner",
      invitedBy,
      invitedAt: invitedBy ? now : undefined,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateMemberRole = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, { projectId, userId, role }) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();

    if (!member) {
      throw new Error("Member not found");
    }

    if (member.isOwner) {
      throw new Error("Cannot change owner role");
    }

    await ctx.db.patch(member._id, {
      role,
      updatedAt: Date.now(),
    });
  },
});

export const removeProjectMember = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
  },
  handler: async (ctx, { projectId, userId }) => {
    const member = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .unique();

    if (!member) {
      throw new Error("Member not found");
    }

    if (member.isOwner) {
      throw new Error("Cannot remove project owner");
    }

    await ctx.db.delete(member._id);
  },
});

export const createInvitation = mutation({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    invitedBy: v.string(),
  },
  handler: async (ctx, { projectId, email, role, invitedBy }) => {
    const normalizedEmail = email.toLowerCase();

    // Check for existing pending invitation
    const existing = await ctx.db
      .query("projectInvitations")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", projectId).eq("status", "pending")
      )
      .collect();

    if (existing.some((i) => i.email === normalizedEmail)) {
      throw new Error("Invitation already pending for this email");
    }

    const token = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    return ctx.db.insert("projectInvitations", {
      projectId,
      email: normalizedEmail,
      role,
      token,
      status: "pending",
      invitedBy,
      expiresAt,
      createdAt: now,
    });
  },
});

export const acceptInvitation = mutation({
  args: {
    token: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { token, userId }) => {
    const invitation = await ctx.db
      .query("projectInvitations")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();

    if (!invitation) {
      throw new Error("Invitation not found");
    }

    if (invitation.status !== "pending") {
      throw new Error(`Invitation is ${invitation.status}`);
    }

    if (Date.now() > invitation.expiresAt) {
      await ctx.db.patch(invitation._id, { status: "expired" });
      throw new Error("Invitation has expired");
    }

    const now = Date.now();

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedAt: now,
      acceptedBy: userId,
    });

    await ctx.db.insert("projectMembers", {
      projectId: invitation.projectId,
      userId,
      role: invitation.role,
      isOwner: false,
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.createdAt,
      acceptedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return invitation.projectId;
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("projectInvitations") },
  handler: async (ctx, { invitationId }) => {
    await ctx.db.patch(invitationId, { status: "revoked" });
  },
});

// ============================================================
// INTERNAL CLEANUP
// ============================================================

export const expireOldInvitations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("projectInvitations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    let expiredCount = 0;
    for (const inv of pending) {
      if (inv.expiresAt < now) {
        await ctx.db.patch(inv._id, { status: "expired" });
        expiredCount++;
      }
    }

    return { expiredCount };
  },
});

export const removeProjectMembersInternal = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    const invitations = await ctx.db
      .query("projectInvitations")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    for (const inv of invitations) {
      await ctx.db.delete(inv._id);
    }

    return { deleted: members.length + invitations.length };
  },
});
