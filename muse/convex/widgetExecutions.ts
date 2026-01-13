import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { verifyProjectEditor } from "./lib/auth";

const widgetExecutionSource = v.object({
  type: v.union(v.literal("document"), v.literal("entity"), v.literal("memory")),
  id: v.string(),
  title: v.optional(v.string()),
  manual: v.boolean(),
  addedAt: v.number(),
  sourceUpdatedAt: v.optional(v.number()),
});

export const createInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    userId: v.string(),
    widgetId: v.string(),
    widgetVersion: v.string(),
    widgetType: v.union(v.literal("inline"), v.literal("artifact")),
    documentId: v.optional(v.id("documents")),
    selectionText: v.optional(v.string()),
    selectionRange: v.optional(v.object({ from: v.number(), to: v.number() })),
    parameters: v.optional(v.any()),
    status: v.string(),
    model: v.optional(v.string()),
    output: v.optional(v.string()),
    sources: v.array(widgetExecutionSource),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("widgetExecutions", {
      projectId: args.projectId,
      userId: args.userId,
      widgetId: args.widgetId,
      widgetVersion: args.widgetVersion,
      widgetType: args.widgetType,
      documentId: args.documentId,
      selectionText: args.selectionText,
      selectionRange: args.selectionRange,
      parameters: args.parameters,
      status: args.status,
      model: args.model,
      output: args.output,
      sources: args.sources,
      error: args.error,
      startedAt: args.startedAt,
      completedAt: args.completedAt,
    });
  },
});

export const patchInternal = internalMutation({
  args: {
    executionId: v.id("widgetExecutions"),
    patch: v.object({
      status: v.optional(v.string()),
      output: v.optional(v.string()),
      error: v.optional(v.string()),
      completedAt: v.optional(v.number()),
      sources: v.optional(v.array(widgetExecutionSource)),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.executionId, args.patch);
    return args.executionId;
  },
});

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
