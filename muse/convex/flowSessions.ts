/**
 * Flow Sessions - Convex mutations and queries for Flow Mode session tracking
 *
 * Records writing sessions for analytics and user insights.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Record a completed flow session
 */
export const record = mutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.optional(v.id("documents")),

    // Timing
    startedAtMs: v.number(),
    endedAtMs: v.number(),
    durationSeconds: v.number(),

    // Word metrics
    startingWordCount: v.number(),
    endingWordCount: v.number(),
    wordsWritten: v.number(),

    // Timer stats
    completedPomodoros: v.number(),
    totalFocusedSeconds: v.number(),

    // Session settings
    focusLevel: v.optional(v.string()),
    typewriterScrolling: v.optional(v.boolean()),
    timerMode: v.optional(v.string()),

    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    const now = Date.now();

    // Verify project access
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Insert the flow session
    const sessionId = await ctx.db.insert("flowSessions", {
      projectId: args.projectId,
      documentId: args.documentId,
      userId,

      startedAtMs: args.startedAtMs,
      endedAtMs: args.endedAtMs,
      durationSeconds: args.durationSeconds,

      startingWordCount: args.startingWordCount,
      endingWordCount: args.endingWordCount,
      wordsWritten: args.wordsWritten,

      completedPomodoros: args.completedPomodoros,
      totalFocusedSeconds: args.totalFocusedSeconds,

      focusLevel: args.focusLevel,
      typewriterScrolling: args.typewriterScrolling,
      timerMode: args.timerMode,

      createdAt: now,
      metadata: args.metadata,
    });

    // Optionally emit to activity log
    await ctx.db.insert("activityLog", {
      projectId: args.projectId,
      documentId: args.documentId,
      actorType: "user",
      actorUserId: userId,
      action: "flow_session_completed",
      summary: `Completed flow session: ${args.wordsWritten} words in ${Math.round(args.durationSeconds / 60)} minutes`,
      metadata: {
        sessionId,
        wordsWritten: args.wordsWritten,
        durationMinutes: Math.round(args.durationSeconds / 60),
        completedPomodoros: args.completedPomodoros,
      },
      createdAt: now,
    });

    return sessionId;
  },
});

/**
 * List flow sessions for a project
 */
export const listByProject = query({
  args: {
    projectId: v.id("projects"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const limit = args.limit ?? 20;

    const sessions = await ctx.db
      .query("flowSessions")
      .withIndex("by_project_createdAt", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(limit);

    return sessions;
  },
});

/**
 * List flow sessions for the current user across all projects
 */
export const listByUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const limit = args.limit ?? 20;

    const sessions = await ctx.db
      .query("flowSessions")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return sessions;
  },
});

/**
 * Get aggregated stats for a project
 */
export const getProjectStats = query({
  args: {
    projectId: v.id("projects"),
    days: v.optional(v.number()), // Filter to last N days
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;
    const days = args.days ?? 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("flowSessions")
      .withIndex("by_project_user_createdAt", (q) =>
        q.eq("projectId", args.projectId).eq("userId", userId)
      )
      .filter((q) => q.gte(q.field("createdAt"), cutoff))
      .collect();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalWordsWritten: 0,
        totalMinutes: 0,
        totalPomodoros: 0,
        averageWordsPerSession: 0,
        averageMinutesPerSession: 0,
        streakDays: 0,
      };
    }

    const totalWordsWritten = sessions.reduce((sum, s) => sum + s.wordsWritten, 0);
    const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
    const totalPomodoros = sessions.reduce((sum, s) => sum + s.completedPomodoros, 0);

    // Calculate streak (consecutive days with sessions)
    const uniqueDays = new Set(
      sessions.map((s) => new Date(s.startedAtMs).toDateString())
    );
    const sortedDays = Array.from(uniqueDays).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    let streakDays = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

    if (sortedDays[0] === today || sortedDays[0] === yesterday) {
      streakDays = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prevDay = new Date(sortedDays[i - 1]);
        const currDay = new Date(sortedDays[i]);
        const diffDays = Math.floor(
          (prevDay.getTime() - currDay.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (diffDays === 1) {
          streakDays++;
        } else {
          break;
        }
      }
    }

    return {
      totalSessions: sessions.length,
      totalWordsWritten,
      totalMinutes: Math.round(totalSeconds / 60),
      totalPomodoros,
      averageWordsPerSession: Math.round(totalWordsWritten / sessions.length),
      averageMinutesPerSession: Math.round(totalSeconds / 60 / sessions.length),
      streakDays,
    };
  },
});

/**
 * Get user's overall stats
 */
export const getUserStats = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const userId = identity.subject;
    const days = args.days ?? 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const sessions = await ctx.db
      .query("flowSessions")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .filter((q) => q.gte(q.field("createdAt"), cutoff))
      .collect();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalWordsWritten: 0,
        totalMinutes: 0,
        totalPomodoros: 0,
        projectCount: 0,
      };
    }

    const totalWordsWritten = sessions.reduce((sum, s) => sum + s.wordsWritten, 0);
    const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
    const totalPomodoros = sessions.reduce((sum, s) => sum + s.completedPomodoros, 0);
    const uniqueProjects = new Set(sessions.map((s) => s.projectId));

    return {
      totalSessions: sessions.length,
      totalWordsWritten,
      totalMinutes: Math.round(totalSeconds / 60),
      totalPomodoros,
      projectCount: uniqueProjects.size,
    };
  },
});
