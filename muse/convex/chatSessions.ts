/**
 * Chat Sessions
 *
 * Per-user chat history for a project with message persistence.
 */

import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId, verifyProjectAccess } from "./lib/auth";

async function getSessionByThread(ctx: QueryCtx | MutationCtx, threadId: string) {
  return await ctx.db
    .query("chatSessions")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .unique();
}

function assertSessionAccess(
  session: { projectId: Id<"projects">; userId: string } | null,
  projectId: Id<"projects">,
  userId: string
) {
  if (!session) {
    throw new Error("Session not found");
  }
  if (session.projectId !== projectId || session.userId !== userId) {
    throw new Error("Access denied");
  }
}

// ============================================================
// QUERIES
// ============================================================

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const { userId } = await verifyProjectAccess(ctx, projectId);

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", projectId).eq("userId", userId)
      )
      .collect();

    return sessions.sort((a, b) => {
      const aTime = a.lastMessageAt ?? a.updatedAt;
      const bTime = b.lastMessageAt ?? b.updatedAt;
      return bTime - aTime;
    });
  },
});

export const getByThread = query({
  args: {
    projectId: v.id("projects"),
    threadId: v.string(),
  },
  handler: async (ctx, { projectId, threadId }) => {
    const userId = await getAuthUserId(ctx);
    await verifyProjectAccess(ctx, projectId);

    const session = await getSessionByThread(ctx, threadId);
    if (!session) return null;

    assertSessionAccess(session, projectId, userId);
    return session;
  },
});

export const listMessages = query({
  args: {
    projectId: v.id("projects"),
    threadId: v.string(),
  },
  handler: async (ctx, { projectId, threadId }) => {
    const userId = await getAuthUserId(ctx);
    await verifyProjectAccess(ctx, projectId);

    const session = await getSessionByThread(ctx, threadId);
    assertSessionAccess(session, projectId, userId);

    return await ctx.db
      .query("chatMessages")
      .withIndex("by_thread_createdAt", (q) => q.eq("threadId", threadId))
      .order("asc")
      .collect();
  },
});

// ============================================================
// MUTATIONS
// ============================================================

export const ensureSession = mutation({
  args: {
    projectId: v.id("projects"),
    threadId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, threadId, name }) => {
    const userId = await getAuthUserId(ctx);
    await verifyProjectAccess(ctx, projectId);

    const existing = await getSessionByThread(ctx, threadId);
    if (existing) {
      assertSessionAccess(existing, projectId, userId);
      return existing;
    }

    const now = Date.now();
    const id = await ctx.db.insert("chatSessions", {
      projectId,
      userId,
      threadId,
      name,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});

export const createMessage = mutation({
  args: {
    projectId: v.id("projects"),
    threadId: v.string(),
    messageId: v.optional(v.string()),
    role: v.string(),
    content: v.string(),
    mentions: v.optional(v.any()),
    tool: v.optional(v.any()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    await verifyProjectAccess(ctx, args.projectId);

    let session = await getSessionByThread(ctx, args.threadId);
    if (!session) {
      const now = Date.now();
      const sessionId = await ctx.db.insert("chatSessions", {
        projectId: args.projectId,
        userId,
        threadId: args.threadId,
        name: undefined,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      session = await ctx.db.get(sessionId);
    }

    assertSessionAccess(session, args.projectId, userId);

    const createdAt = args.createdAt ?? Date.now();

    const messageId = await ctx.db.insert("chatMessages", {
      projectId: args.projectId,
      sessionId: session!._id,
      threadId: args.threadId,
      userId,
      messageId: args.messageId,
      role: args.role,
      content: args.content,
      mentions: args.mentions,
      tool: args.tool,
      createdAt,
    });

    await ctx.db.patch(session!._id, {
      messageCount: (session!.messageCount ?? 0) + 1,
      lastMessageAt: createdAt,
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

export const updateSession = mutation({
  args: {
    projectId: v.id("projects"),
    threadId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { projectId, threadId, name }) => {
    const userId = await getAuthUserId(ctx);
    await verifyProjectAccess(ctx, projectId);

    const session = await getSessionByThread(ctx, threadId);
    assertSessionAccess(session, projectId, userId);

    await ctx.db.patch(session!._id, {
      name,
      updatedAt: Date.now(),
    });

    return session!._id;
  },
});

export const removeSession = mutation({
  args: {
    projectId: v.id("projects"),
    threadId: v.string(),
  },
  handler: async (ctx, { projectId, threadId }) => {
    const userId = await getAuthUserId(ctx);
    await verifyProjectAccess(ctx, projectId);

    const session = await getSessionByThread(ctx, threadId);
    assertSessionAccess(session, projectId, userId);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session_createdAt", (q) => q.eq("sessionId", session!._id))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(session!._id);
    return session!._id;
  },
});
