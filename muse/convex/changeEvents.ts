import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

export const getChangeEventInternal = internalQuery({
  args: {
    id: v.id("changeEvents"),
  },
  handler: async (ctx, { id }) => {
    return ctx.db.get(id);
  },
});

export const createChangeEventInternal = internalMutation({
  args: {
    projectId: v.id("projects"),
    actorUserId: v.string(),
    source: v.union(
      v.literal("knowledge_pr_approved"),
      v.literal("document_update"),
      v.literal("graph_mutation"),
      v.literal("memory_change")
    ),
    sourceSuggestionId: v.optional(v.id("knowledgeSuggestions")),
    sourceDocumentId: v.optional(v.id("documents")),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    operation: v.string(),
    beforeHash: v.optional(v.string()),
    afterHash: v.optional(v.string()),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<Id<"changeEvents">> => {
    return await ctx.db.insert("changeEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
