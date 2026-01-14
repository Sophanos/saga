/**
 * AI Usage Tracking
 *
 * Tracks token usage, costs, and provides usage statistics per user/project/thread.
 */

import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// ============================================================
// Internal mutation for usage handler
// ============================================================

export const trackUsage = internalMutation({
  args: {
    userId: v.string(),
    projectId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    provider: v.optional(v.string()),
    endpoint: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    costMicros: v.optional(v.number()),
    billingMode: v.string(),
    latencyMs: v.optional(v.number()),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", {
      userId: args.userId,
      projectId: args.projectId as Id<"projects"> | undefined,
      threadId: args.threadId,
      agentName: args.agentName,
      provider: args.provider,
      endpoint: args.endpoint,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      costMicros: args.costMicros,
      billingMode: args.billingMode,
      latencyMs: args.latencyMs,
      success: args.success,
      errorMessage: args.errorMessage,
      createdAt: Date.now(),
    });

    if (args.billingMode === "managed") {
      const periodStartMs = getStartOfMonth();
      const existing = await ctx.db
        .query("billingUsagePeriods")
        .withIndex("by_user_period", (q) =>
          q.eq("userId", args.userId).eq("periodStartMs", periodStartMs)
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          tokensUsedManaged: existing.tokensUsedManaged + args.totalTokens,
          callsUsed: existing.callsUsed + 1,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("billingUsagePeriods", {
          userId: args.userId,
          periodStartMs,
          tokensUsedManaged: args.totalTokens,
          callsUsed: 1,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// ============================================================
// Usage queries
// ============================================================

/**
 * Get user's total usage for current billing period
 */
export const getUserUsage = query({
  args: {
    userId: v.string(),
    periodStartMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const periodStart = args.periodStartMs ?? getStartOfMonth();

    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", args.userId).gte("createdAt", periodStart)
      )
      .collect();

    const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
    const totalCostMicros = usage.reduce((sum, u) => sum + (u.costMicros ?? 0), 0);
    const requestCount = usage.length;

    // Group by model
    const byModel = usage.reduce(
      (acc, u) => {
        if (!acc[u.model]) {
          acc[u.model] = { tokens: 0, cost: 0, count: 0 };
        }
        acc[u.model].tokens += u.totalTokens;
        acc[u.model].cost += u.costMicros ?? 0;
        acc[u.model].count += 1;
        return acc;
      },
      {} as Record<string, { tokens: number; cost: number; count: number }>
    );

    return {
      totalTokens,
      totalCostMicros,
      totalCostDollars: totalCostMicros / 1_000_000,
      requestCount,
      byModel,
      periodStart,
    };
  },
});

/**
 * Get usage for a specific thread
 */
export const getThreadUsage = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
    const totalCostMicros = usage.reduce((sum, u) => sum + (u.costMicros ?? 0), 0);

    return {
      totalTokens,
      totalCostMicros,
      totalCostDollars: totalCostMicros / 1_000_000,
      requestCount: usage.length,
      messages: usage.map((u) => ({
        model: u.model,
        tokens: u.totalTokens,
        cost: u.costMicros,
        createdAt: u.createdAt,
      })),
    };
  },
});

/**
 * Get project-level usage summary
 */
export const getProjectUsage = query({
  args: {
    projectId: v.id("projects"),
    periodStartMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const periodStart = args.periodStartMs ?? getStartOfMonth();

    const allUsage = await ctx.db
      .query("aiUsage")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const usage = allUsage.filter((u) => u.createdAt >= periodStart);

    const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
    const totalCostMicros = usage.reduce((sum, u) => sum + (u.costMicros ?? 0), 0);

    // Group by agent
    const byAgent = usage.reduce(
      (acc, u) => {
        const agent = u.agentName ?? "unknown";
        if (!acc[agent]) {
          acc[agent] = { tokens: 0, cost: 0, count: 0 };
        }
        acc[agent].tokens += u.totalTokens;
        acc[agent].cost += u.costMicros ?? 0;
        acc[agent].count += 1;
        return acc;
      },
      {} as Record<string, { tokens: number; cost: number; count: number }>
    );

    return {
      totalTokens,
      totalCostMicros,
      totalCostDollars: totalCostMicros / 1_000_000,
      requestCount: usage.length,
      byAgent,
      periodStart,
    };
  },
});

// ============================================================
// Helpers
// ============================================================

function getStartOfMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}
