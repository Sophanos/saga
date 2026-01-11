/**
 * Template Builder Sessions
 *
 * Stores onboarding thread continuity for AI template builder.
 */

import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getAuthUserId } from "./lib/auth";

async function getSessionByThread(ctx: QueryCtx | MutationCtx, threadId: string) {
  return await ctx.db
    .query("templateBuilderSessions")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .unique();
}

function assertSessionOwner(
  session: { userId: string } | null,
  userId: string
): void {
  if (!session) {
    throw new Error("Session not found");
  }
  if (session.userId !== userId) {
    throw new Error("Access denied");
  }
}

async function upsertSession(
  ctx: MutationCtx,
  args: {
    userId: string;
    threadId: string;
    projectType?: string;
    phase?: string;
    partialDraft?: unknown;
    detectedElements?: unknown;
  }
): Promise<string> {
  const existing = await getSessionByThread(ctx, args.threadId);
  const now = Date.now();

  if (existing) {
    assertSessionOwner(existing, args.userId);
    const patch: Record<string, unknown> = { updatedAt: now };

    if (args.projectType !== undefined) patch["projectType"] = args.projectType;
    if (args.phase !== undefined) patch["phase"] = args.phase;
    if (args.partialDraft !== undefined) patch["partialDraft"] = args.partialDraft;
    if (args.detectedElements !== undefined) patch["detectedElements"] = args.detectedElements;

    await ctx.db.patch(existing._id, patch);
    return existing._id;
  }

  return await ctx.db.insert("templateBuilderSessions", {
    userId: args.userId,
    threadId: args.threadId,
    projectType: args.projectType,
    phase: args.phase ?? "discovery",
    partialDraft: args.partialDraft,
    detectedElements: args.detectedElements,
    createdAt: now,
    updatedAt: now,
  });
}

// ============================================================
// QUERIES
// ============================================================

export const getLatestForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const sessions = await ctx.db
      .query("templateBuilderSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (sessions.length === 0) return null;

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  },
});

// ============================================================
// MUTATIONS
// ============================================================

export const upsertByThread = mutation({
  args: {
    threadId: v.string(),
    projectType: v.optional(v.string()),
    phase: v.optional(v.string()),
    partialDraft: v.optional(v.any()),
    detectedElements: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return await upsertSession(ctx, { userId, ...args });
  },
});

// ============================================================
// INTERNAL
// ============================================================

export const upsertInternal = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    projectType: v.optional(v.string()),
    phase: v.optional(v.string()),
    partialDraft: v.optional(v.any()),
    detectedElements: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await upsertSession(ctx, args);
  },
});

export const assertThreadOwner = internalQuery({
  args: { threadId: v.string(), userId: v.string() },
  handler: async (ctx, { threadId, userId }) => {
    const session = await getSessionByThread(ctx, threadId);
    assertSessionOwner(session, userId);
    return { threadId, userId };
  },
});
