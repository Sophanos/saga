/**
 * Pulse Signals API
 *
 * Ambient intelligence signals that surface during work:
 * - Entity detection (new character/location mentioned)
 * - Voice drift (style inconsistency)
 * - Consistency issues (contradictions, timeline errors)
 * - Suggestions (AI-generated recommendations)
 *
 * These are pull-based: user opens Inbox to review, no popups.
 */

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// =============================================================================
// Queries
// =============================================================================

/**
 * List pulse signals for a project.
 * Returns unread and recent signals, sorted by creation time (newest first).
 */
export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    status: v.optional(
      v.union(
        v.literal("unread"),
        v.literal("read"),
        v.literal("dismissed"),
        v.literal("actioned")
      )
    ),
    signalType: v.optional(
      v.union(
        v.literal("entity_detected"),
        v.literal("voice_drift"),
        v.literal("consistency_issue"),
        v.literal("suggestion")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, status, signalType, limit = 50 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let q;

    if (status) {
      q = ctx.db
        .query("pulseSignals")
        .withIndex("by_project_status_createdAt", (q) =>
          q.eq("projectId", projectId).eq("status", status)
        )
        .order("desc");
    } else {
      q = ctx.db
        .query("pulseSignals")
        .withIndex("by_project_createdAt", (q) => q.eq("projectId", projectId))
        .order("desc");
    }

    const signals = await q.take(limit);

    // Filter by signal type if specified
    if (signalType) {
      return signals.filter((s) => s.signalType === signalType);
    }

    return signals;
  },
});

/**
 * Get count of unread signals for a project.
 */
export const getUnreadCount = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const signals = await ctx.db
      .query("pulseSignals")
      .withIndex("by_project_status_createdAt", (q) =>
        q.eq("projectId", projectId).eq("status", "unread")
      )
      .collect();

    return signals.length;
  },
});

/**
 * Get a single pulse signal by ID.
 */
export const get = query({
  args: {
    signalId: v.id("pulseSignals"),
  },
  handler: async (ctx, { signalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return ctx.db.get(signalId);
  },
});

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create a new pulse signal.
 * Usually called by AI agents when they detect something noteworthy.
 */
export const create = mutation({
  args: {
    projectId: v.id("projects"),
    signalType: v.union(
      v.literal("entity_detected"),
      v.literal("voice_drift"),
      v.literal("consistency_issue"),
      v.literal("suggestion")
    ),
    title: v.string(),
    description: v.optional(v.string()),
    targetDocumentId: v.optional(v.id("documents")),
    targetEntityId: v.optional(v.id("entities")),
    context: v.optional(v.string()),
    excerpt: v.optional(v.string()),
    confidence: v.optional(v.number()),
    sourceAgentId: v.optional(v.string()),
    sourceStreamId: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    return ctx.db.insert("pulseSignals", {
      ...args,
      status: "unread",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Mark a signal as read.
 */
export const markRead = mutation({
  args: {
    signalId: v.id("pulseSignals"),
  },
  handler: async (ctx, { signalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const signal = await ctx.db.get(signalId);
    if (!signal) throw new Error("Signal not found");

    await ctx.db.patch(signalId, {
      status: "read",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark all signals as read for a project.
 */
export const markAllRead = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const signals = await ctx.db
      .query("pulseSignals")
      .withIndex("by_project_status_createdAt", (q) =>
        q.eq("projectId", projectId).eq("status", "unread")
      )
      .collect();

    const now = Date.now();

    await Promise.all(
      signals.map((signal) =>
        ctx.db.patch(signal._id, {
          status: "read",
          updatedAt: now,
        })
      )
    );

    return { updated: signals.length };
  },
});

/**
 * Dismiss a signal (user doesn't want to act on it).
 */
export const dismiss = mutation({
  args: {
    signalId: v.id("pulseSignals"),
  },
  handler: async (ctx, { signalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const signal = await ctx.db.get(signalId);
    if (!signal) throw new Error("Signal not found");

    await ctx.db.patch(signalId, {
      status: "dismissed",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Mark a signal as actioned (user took action on it).
 */
export const markActioned = mutation({
  args: {
    signalId: v.id("pulseSignals"),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { signalId, metadata }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const signal = await ctx.db.get(signalId);
    if (!signal) throw new Error("Signal not found");

    await ctx.db.patch(signalId, {
      status: "actioned",
      metadata: metadata ?? signal.metadata,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete old dismissed signals (cleanup).
 */
export const cleanupDismissed = mutation({
  args: {
    projectId: v.id("projects"),
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, { projectId, olderThanDays = 7 }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const signals = await ctx.db
      .query("pulseSignals")
      .withIndex("by_project_status_createdAt", (q) =>
        q.eq("projectId", projectId).eq("status", "dismissed")
      )
      .collect();

    const toDelete = signals.filter((s) => s.createdAt < cutoff);

    await Promise.all(toDelete.map((signal) => ctx.db.delete(signal._id)));

    return { deleted: toDelete.length };
  },
});
