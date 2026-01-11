import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyProjectEditor } from "./lib/auth";

export const recordInlineApply = mutation({
  args: {
    executionId: v.id("widgetExecutions"),
    originalText: v.string(),
    appliedText: v.string(),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) {
      throw new Error("Widget execution not found");
    }

    await verifyProjectEditor(ctx, execution.projectId);

    if (execution.widgetType !== "inline") {
      throw new Error("Only inline executions can be recorded");
    }

    await ctx.db.patch(args.executionId, {
      originalText: args.originalText,
      appliedText: args.appliedText,
      appliedAt: Date.now(),
    });

    return { executionId: args.executionId };
  },
});

export const getForRevert = query({
  args: {
    executionId: v.id("widgetExecutions"),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) {
      throw new Error("Widget execution not found");
    }

    await verifyProjectEditor(ctx, execution.projectId);

    if (execution.widgetType !== "inline") {
      throw new Error("Only inline executions can be reverted");
    }

    if (!execution.originalText || !execution.appliedText) {
      throw new Error("No revert data available");
    }

    return {
      executionId: execution._id,
      originalText: execution.originalText,
      appliedText: execution.appliedText,
      widgetId: execution.widgetId,
      appliedAt: execution.appliedAt ?? null,
    };
  },
});
